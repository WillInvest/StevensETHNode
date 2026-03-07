import asyncio
import json
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from web.db import get_pool, close_pool
from web.routers import tables, browse, extraction, mempool, query, stats, export, saved_queries
from web.routers import sci as sci_router
from web.routers import auth as auth_router
from web.routers import monitoring
from web.routers import fear_index
from web.routers import eth_distribution
from web.routers import explore as explore_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await get_pool()

    # All background tasks disabled for development.
    # Erigon WS (8546) is down, and background refresh burns CPU.
    # Re-enable selectively when needed:
    #   from web.routers.eth_distribution import (
    #       start_background_refresh, stop_background_refresh,
    #       start_block_listener, stop_block_listener,
    #   )
    #   from web.routers.eth_distribution import start_position_scan, stop_position_scan
    #   await start_background_refresh()
    #   await start_block_listener()
    #   await start_position_scan()

    yield
    await close_pool()


app = FastAPI(
    title="Stevens Blockchain Analytics",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tables.router, prefix="/api")
app.include_router(browse.router, prefix="/api")
app.include_router(extraction.router, prefix="/api")
app.include_router(mempool.router, prefix="/api")
app.include_router(query.router, prefix="/api")
app.include_router(stats.router, prefix="/api")
app.include_router(export.router, prefix="/api")
app.include_router(saved_queries.router, prefix="/api")
app.include_router(sci_router.router, prefix="/api")
app.include_router(auth_router.router, prefix="/api")
app.include_router(monitoring.router, prefix="/api")
app.include_router(fear_index.router, prefix="/api")
app.include_router(eth_distribution.router, prefix="/api")
app.include_router(explore_router.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok"}


# --- WebSocket for live ETH distribution updates ---
@app.websocket("/ws/eth-distribution")
async def eth_dist_ws(ws: WebSocket):
    """Proxy to eth_distribution router WebSocket handler."""
    from web.routers.eth_distribution import eth_distribution_ws
    await eth_distribution_ws(ws)


# --- WebSocket for live fear index updates ---
_ws_clients: set[WebSocket] = set()


@app.websocket("/ws/fear-index")
async def fear_index_ws(ws: WebSocket):
    """WebSocket endpoint for real-time fear index updates.

    Pushes updated fear index value to connected clients every 30 seconds.
    """
    await ws.accept()
    _ws_clients.add(ws)
    try:
        while True:
            # Keep connection alive; push updates from broadcast task
            await ws.receive_text()
    except WebSocketDisconnect:
        _ws_clients.discard(ws)
    except Exception:
        _ws_clients.discard(ws)


async def _broadcast_fear_index():
    """Background task that broadcasts fear index to WebSocket clients."""
    while True:
        await asyncio.sleep(30)
        if not _ws_clients:
            continue
        try:
            from web.routers.fear_index import _compute_fear_index
            data = _compute_fear_index()
            message = json.dumps(data)
            dead = set()
            for ws in _ws_clients:
                try:
                    await ws.send_text(message)
                except Exception:
                    dead.add(ws)
            _ws_clients -= dead
        except Exception:
            pass
