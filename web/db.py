import os
from contextlib import asynccontextmanager
from psycopg_pool import AsyncConnectionPool

DATABASE_URL = os.environ.get(
    "ETHNODE_DATABASE_URL",
    "postgres://ethnode:ethnode@localhost:5432/ethnode",
)

_pool = None


async def get_pool():
    global _pool
    if _pool is None:
        _pool = AsyncConnectionPool(DATABASE_URL, min_size=2, max_size=10)
        await _pool.open()
    return _pool


async def close_pool():
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


@asynccontextmanager
async def get_conn():
    pool = await get_pool()
    async with pool.connection() as conn:
        yield conn
