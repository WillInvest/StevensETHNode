import asyncio
import json
import os

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional

from web.extraction import (
    POOLS,
    DEFAULT_CHUNK_SIZE,
    get_chain_head,
    start_extraction,
    pause_extraction,
    resume_extraction,
    get_job_progress,
    get_all_jobs,
    get_pool_coverage,
    _jobs,
)
from web.db import get_conn

router = APIRouter(tags=["extraction"])

_DB_URL = os.environ.get(
    "ETHNODE_DATABASE_URL",
    "postgres://ethnode:changeme@localhost:5432/ethnode",
)


@router.get("/extraction/pools")
async def list_pools():
    """List supported pools with chain head info and DB coverage."""
    head = await get_chain_head()
    pools = []
    for pool_id, info in POOLS.items():
        coverage = await get_pool_coverage(pool_id)
        pools.append({
            "pool_id": pool_id,
            "label": info["label"],
            "contract": info["contract"],
            "deploy_block": info["deploy_block"],
            "chain_head": head,
            "total_blocks": head - info["deploy_block"],
            **coverage,
        })
    return {"pools": pools, "chain_head": head}


@router.get("/extraction/coverage")
async def coverage():
    """Get DB coverage stats for all pools."""
    result = {}
    for pool_id in POOLS:
        result[pool_id] = await get_pool_coverage(pool_id)
    return {"coverage": result}


class StartRequest(BaseModel):
    pool_id: str
    end_block: Optional[int] = None
    chunk_size: int = Field(default=DEFAULT_CHUNK_SIZE, ge=100, le=100_000)


@router.post("/extraction/start")
async def start_job(req: StartRequest):
    """Start a Cryo extraction job for a pool."""
    try:
        job = await start_extraction(
            pool_id=req.pool_id,
            end_block=req.end_block,
            chunk_size=req.chunk_size,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    return get_job_progress(job)


class JobActionRequest(BaseModel):
    job_id: str


@router.post("/extraction/pause")
async def pause_job(req: JobActionRequest):
    """Pause a running extraction job."""
    if not pause_extraction(req.job_id):
        raise HTTPException(400, "Cannot pause: job not running or not found")
    return {"status": "paused", "job_id": req.job_id}


@router.post("/extraction/resume")
async def resume_job(req: JobActionRequest):
    """Resume a paused extraction job."""
    if not resume_extraction(req.job_id):
        raise HTTPException(400, "Cannot resume: job not paused or not found")
    return {"status": "running", "job_id": req.job_id}


@router.get("/extraction/jobs")
async def list_jobs():
    """List all extraction jobs with progress."""
    return {"jobs": get_all_jobs()}


@router.get("/extraction/stream")
async def stream_progress():
    """SSE endpoint: sends job progress every 2 seconds."""
    async def event_generator():
        while True:
            jobs_data = get_all_jobs()
            event = json.dumps({"jobs": jobs_data})
            yield f"data: {event}\n\n"
            await asyncio.sleep(2)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# --- Historical tick snapshot jobs ---

class SnapshotStartRequest(BaseModel):
    pool_address: str
    start_block: int
    end_block: int
    block_interval: int = Field(default=250, ge=1, le=10000)


@router.post("/extraction/snapshot/start")
async def start_snapshot_job(req: SnapshotStartRequest):
    """Start a historical tick snapshot extraction job."""
    if req.start_block >= req.end_block:
        raise HTTPException(400, "start_block must be less than end_block")

    # Create job record in DB
    async with get_conn() as conn:
        cur = await conn.execute(
            "INSERT INTO uniswap_v3_snapshot_jobs "
            "(pool_address, start_block, end_block, block_interval, status) "
            "VALUES (%s, %s, %s, %s, 'pending') RETURNING id",
            (req.pool_address.lower(), req.start_block, req.end_block, req.block_interval),
        )
        row = await cur.fetchone()
        job_id = row[0]
        await conn.commit()

    # Run in background thread
    import sys
    sys.path.insert(0, "/home/hfu11/stevens-blockchain")
    from scripts.snapshot_ticks import run_batch

    asyncio.create_task(asyncio.to_thread(
        run_batch,
        pool_address=req.pool_address,
        start_block=req.start_block,
        end_block=req.end_block,
        interval=req.block_interval,
        database_url=_DB_URL,
        job_id=job_id,
    ))

    return {"job_id": job_id, "status": "pending"}


@router.get("/extraction/snapshot/jobs")
async def list_snapshot_jobs():
    """List all historical snapshot jobs with progress."""
    async with get_conn() as conn:
        cur = await conn.execute(
            "SELECT id, pool_address, start_block, end_block, block_interval, "
            "status, progress_block, total_snapshots, error_message, "
            "created_at, finished_at "
            "FROM uniswap_v3_snapshot_jobs ORDER BY id DESC LIMIT 50"
        )
        rows = await cur.fetchall()

    jobs = []
    for row in rows:
        total_blocks = (row[3] - row[2]) // row[4] + 1
        progress_pct = 0
        if row[6] is not None and total_blocks > 0:
            done = (row[6] - row[2]) // row[4] + 1
            progress_pct = round(done / total_blocks * 100, 1)

        jobs.append({
            "id": row[0],
            "pool_address": row[1],
            "start_block": row[2],
            "end_block": row[3],
            "block_interval": row[4],
            "status": row[5],
            "progress_block": row[6],
            "total_snapshots": row[7],
            "error_message": row[8],
            "progress_pct": progress_pct,
            "created_at": row[9].isoformat() if row[9] else None,
            "finished_at": row[10].isoformat() if row[10] else None,
        })

    return {"jobs": jobs}
