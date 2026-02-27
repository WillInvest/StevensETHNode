import asyncio
import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional

from web.extraction import (
    POOLS,
    DEFAULT_CHUNK_SIZE,
    get_chain_head,
    start_extraction,
    get_job_progress,
    get_all_jobs,
    _jobs,
)

router = APIRouter(tags=["extraction"])


@router.get("/extraction/pools")
async def list_pools():
    """List supported pools with chain head info."""
    head = await get_chain_head()
    pools = []
    for pool_id, info in POOLS.items():
        pools.append({
            "pool_id": pool_id,
            "label": info["label"],
            "contract": info["contract"],
            "deploy_block": info["deploy_block"],
            "chain_head": head,
            "total_blocks": head - info["deploy_block"],
        })
    return {"pools": pools, "chain_head": head}


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
