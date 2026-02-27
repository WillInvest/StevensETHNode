import json
from urllib.request import Request, urlopen

from fastapi import APIRouter

from web.db import get_conn

router = APIRouter(tags=["monitoring"])

RPC_URL = "http://127.0.0.1:8545"


def _rpc_call(method, params=None):
    try:
        payload = json.dumps({"jsonrpc": "2.0", "method": method, "params": params or [], "id": 1}).encode()
        req = Request(RPC_URL, data=payload, headers={"Content-Type": "application/json"})
        with urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read())
        return data.get("result")
    except Exception:
        return None


@router.get("/monitoring/status")
async def monitoring_status():
    """System health: DB size, table sizes, indexer lag, Erigon health."""
    result = {"db": {}, "tables": [], "erigon": {}, "indexer_lag": None}

    # Database size
    async with get_conn() as conn:
        cur = await conn.execute(
            "SELECT pg_database_size(current_database())"
        )
        row = await cur.fetchone()
        db_bytes = row[0] if row else 0
        result["db"]["size_bytes"] = db_bytes
        result["db"]["size_mb"] = round(db_bytes / 1024 / 1024, 1)

        # Table sizes
        cur = await conn.execute("""
            SELECT schemaname, tablename, n_live_tup,
                   pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(tablename)) AS size_bytes
            FROM pg_stat_user_tables
            ORDER BY n_live_tup DESC
        """)
        for r in await cur.fetchall():
            result["tables"].append({
                "schema": r[0],
                "table": r[1],
                "row_count": r[2],
                "size_bytes": r[3],
                "size_mb": round(r[3] / 1024 / 1024, 1),
            })

        # Get latest indexed block
        cur = await conn.execute("SELECT MAX(block_num) FROM uniswap_v3_swaps")
        row = await cur.fetchone()
        latest_indexed = int(row[0]) if row and row[0] else 0

    # Erigon health
    chain_head = _rpc_call("eth_blockNumber")
    if chain_head:
        chain_head_num = int(chain_head, 16)
        result["erigon"]["chain_head"] = chain_head_num
        result["erigon"]["healthy"] = True
        result["indexer_lag"] = chain_head_num - latest_indexed
    else:
        result["erigon"]["healthy"] = False
        result["erigon"]["chain_head"] = None

    result["erigon"]["latest_indexed"] = latest_indexed

    syncing = _rpc_call("eth_syncing")
    result["erigon"]["syncing"] = syncing is not None and syncing is not False

    return result
