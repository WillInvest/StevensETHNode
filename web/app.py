from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from web.db import get_pool, close_pool
from web.routers import tables, browse, extraction, mempool, query, stats, export, saved_queries
from web.routers import sci as sci_router
from web.routers import auth as auth_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await get_pool()
    yield
    await close_pool()


app = FastAPI(
    title="Stevens Blockchain Analytics",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
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


@app.get("/api/health")
async def health():
    return {"status": "ok"}
