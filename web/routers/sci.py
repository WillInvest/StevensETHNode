import asyncio
import json

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from web.db import get_conn
from web.sci import compute_sci_for_block

router = APIRouter(tags=["sci"])


@router.get("/sci/current")
async def sci_current():
    """Get the latest SCI score and component breakdown."""
    result = await compute_sci_for_block()
    if result is None:
        return {"error": "No indexed data available yet"}
    return result


@router.get("/sci/history")
async def sci_history(days: int = Query(30, ge=1, le=365)):
    """Get historical SCI scores for charting."""
    async with get_conn() as conn:
        cur = await conn.execute(
            """SELECT block_num, block_timestamp, sci_score,
                      dex_score, lending_score, liquidation_score,
                      gas_score, network_score, bridge_score
               FROM sci_snapshots
               WHERE created_at > now() - interval '%s days'
               ORDER BY block_num ASC""",
            (days,),
        )
        rows = await cur.fetchall()

    return [
        {
            "block_num": r[0],
            "timestamp": r[1].isoformat() if r[1] else None,
            "sci_score": float(r[2]) if r[2] else None,
            "dex_score": float(r[3]) if r[3] else None,
            "lending_score": float(r[4]) if r[4] else None,
            "liquidation_score": float(r[5]) if r[5] else None,
            "gas_score": float(r[6]) if r[6] else None,
            "network_score": float(r[7]) if r[7] else None,
            "bridge_score": float(r[8]) if r[8] else None,
        }
        for r in rows
    ]


@router.get("/sci/stream")
async def sci_stream():
    """SSE: live SCI updates every 30 seconds."""
    async def event_generator():
        while True:
            try:
                data = await compute_sci_for_block()
                if data:
                    yield f"data: {json.dumps(data)}\n\n"
                else:
                    yield f"data: {json.dumps({'error': 'No data'})}\n\n"
            except Exception:
                yield f"data: {json.dumps({'error': 'Computation failed'})}\n\n"
            await asyncio.sleep(30)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
