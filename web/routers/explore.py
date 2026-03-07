"""Explore router — hierarchical protocol navigation API.

Endpoints:
    GET /api/explore/registry
    GET /api/explore/pools/{protocol}/{version}
    GET /api/explore/pool/{protocol}/{version}/{address}
    GET /api/explore/pool/{protocol}/{version}/{address}/events
    GET /api/explore/pool/{protocol}/{version}/{address}/stats
"""

from __future__ import annotations

import logging
import re
from typing import Any

from fastapi import APIRouter, HTTPException, Query

from web.db import get_conn
from web.services import pool_resolver

_ETH_ADDR_RE = re.compile(r"^0x[0-9a-fA-F]{40}$")


def _validate_address(address: str) -> str:
    """Validate and normalise an Ethereum address; raise 400 if malformed."""
    addr = address.strip().lower()
    if not _ETH_ADDR_RE.match(addr):
        raise HTTPException(400, f"Invalid Ethereum address: {address!r}")
    return addr

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/explore", tags=["explore"])

# ---------------------------------------------------------------------------
# Static protocol registry
# ---------------------------------------------------------------------------

_REGISTRY = {
    "categories": [
        {
            "id": "dex",
            "label": "Decentralized Exchange",
            "protocols": [
                {
                    "id": "uniswap",
                    "label": "Uniswap",
                    "versions": [
                        {
                            "id": "v3",
                            "label": "V3",
                            "active": True,
                            "tabs": ["swaps", "liquidity", "stats", "query"],
                        },
                        {"id": "v2", "label": "V2", "comingSoon": True},
                        {"id": "v4", "label": "V4", "comingSoon": True},
                    ],
                },
                {"id": "curve", "label": "Curve", "comingSoon": True},
            ],
        },
        {
            "id": "lending",
            "label": "Decentralized Lending",
            "comingSoon": True,
            "protocols": [
                {"id": "aave", "label": "Aave V3", "comingSoon": True},
                {"id": "compound", "label": "Compound V3", "comingSoon": True},
            ],
        },
    ]
}

# Supported active protocol/version combos -> DB schema
_ACTIVE_VERSIONS: dict[tuple[str, str], str] = {
    ("uniswap", "v3"): "uniswap_v3",
}


def _get_schema(protocol: str, version: str) -> str:
    key = (protocol.lower(), version.lower())
    schema = _ACTIVE_VERSIONS.get(key)
    if not schema:
        raise HTTPException(404, f"Protocol {protocol}/{version} not found or not yet active")
    return schema


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/registry")
async def get_registry() -> dict[str, Any]:
    """Static protocol hierarchy for sidebar rendering."""
    return {"success": True, "data": _REGISTRY}


@router.get("/pools/{protocol}/{version}")
async def list_pools(
    protocol: str,
    version: str,
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    """Return top pools for a protocol/version, sorted by swap count.

    Metadata is resolved via 3-tier cache (memory → DB → RPC).
    """
    schema = _get_schema(protocol, version)

    async with get_conn() as conn:
        cur = await conn.execute(
            f"""
            SELECT pool_id, count(*) AS swap_count
            FROM {schema}.swap_events
            GROUP BY pool_id
            ORDER BY swap_count DESC
            LIMIT %s
            """,
            (limit,),
        )
        rows = await cur.fetchall()

    if not rows:
        return {"success": True, "data": [], "meta": {"total": 0}}

    addresses = [row[0].strip() for row in rows]
    swap_counts = {row[0].strip(): row[1] for row in rows}

    meta_map = await pool_resolver.resolve_batch(addresses)

    pools = []
    for addr in addresses:
        meta = meta_map.get(addr)
        display_name = meta["display_name"] if meta else addr[:10] + "..."
        fee_label = meta["fee_label"] if meta else ""
        pools.append({
            "pool_address": addr,
            "display_name": display_name,
            "fee_label": fee_label,
            "swap_count": swap_counts[addr],
            "token0_symbol": meta["token0_symbol"] if meta else None,
            "token1_symbol": meta["token1_symbol"] if meta else None,
        })

    return {"success": True, "data": pools, "meta": {"total": len(pools)}}


@router.get("/pool/{protocol}/{version}/{address}")
async def get_pool_detail(
    protocol: str,
    version: str,
    address: str,
) -> dict[str, Any]:
    """Return metadata + summary stats for a single pool."""
    schema = _get_schema(protocol, version)
    addr = _validate_address(address)

    meta = await pool_resolver.resolve(addr)

    async with get_conn() as conn:
        counts_cur = await conn.execute(
            f"""
            SELECT
                (SELECT count(*) FROM {schema}.swap_events WHERE pool_id = %s) AS swap_count,
                (SELECT count(*) FROM {schema}.mint_events WHERE pool_id = %s) AS mint_count,
                (SELECT count(*) FROM {schema}.burn_events WHERE pool_id = %s) AS burn_count
            """,
            (addr, addr, addr),
        )
        counts = await counts_cur.fetchone()

    return {
        "success": True,
        "data": {
            "pool_address": addr,
            "metadata": meta,
            "swap_count": counts[0] if counts else 0,
            "mint_count": counts[1] if counts else 0,
            "burn_count": counts[2] if counts else 0,
        },
    }


@router.get("/pool/{protocol}/{version}/{address}/events")
async def get_pool_events(
    protocol: str,
    version: str,
    address: str,
    event_type: str = Query("swaps", pattern="^(swaps|mints|burns)$"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> dict[str, Any]:
    """Paginated events (swaps, mints, or burns) for a pool."""
    schema = _get_schema(protocol, version)
    addr = _validate_address(address)

    table_map = {"swaps": "swap_events", "mints": "mint_events", "burns": "burn_events"}
    table = table_map[event_type]

    async with get_conn() as conn:
        count_cur = await conn.execute(
            f"SELECT count(*) FROM {schema}.{table} WHERE pool_id = %s",
            (addr,),
        )
        total = (await count_cur.fetchone())[0]

        if event_type == "swaps":
            data_cur = await conn.execute(
                f"""
                SELECT block, tx_hash, sender, recipient,
                       amount0::text, amount1::text, tick,
                       block_timestamp
                FROM {schema}.{table}
                WHERE pool_id = %s
                ORDER BY block DESC, log_index DESC
                LIMIT %s OFFSET %s
                """,
                (addr, limit, offset),
            )
            cols = ["block", "tx_hash", "sender", "recipient",
                    "amount0", "amount1", "tick", "block_timestamp"]
        else:
            data_cur = await conn.execute(
                f"""
                SELECT block, tx_hash, amount0::text, amount1::text,
                       tick_lower, tick_upper, block_timestamp
                FROM {schema}.{table}
                WHERE pool_id = %s
                ORDER BY block DESC, log_index DESC
                LIMIT %s OFFSET %s
                """,
                (addr, limit, offset),
            )
            cols = ["block", "tx_hash", "amount0", "amount1",
                    "tick_lower", "tick_upper", "block_timestamp"]

        rows = [dict(zip(cols, row)) for row in await data_cur.fetchall()]

    return {
        "success": True,
        "data": rows,
        "meta": {"total": total, "limit": limit, "offset": offset},
    }


@router.get("/pool/{protocol}/{version}/{address}/stats")
async def get_pool_stats(
    protocol: str,
    version: str,
    address: str,
    days: int = Query(30, ge=1, le=365),
) -> dict[str, Any]:
    """Aggregate daily swap and liquidity stats for a pool."""
    schema = _get_schema(protocol, version)
    addr = _validate_address(address)

    async with get_conn() as conn:
        # Daily swap counts
        swap_cur = await conn.execute(
            f"""
            SELECT
                date_trunc('day', block_timestamp)::date AS day,
                count(*) AS swap_count
            FROM {schema}.swap_events
            WHERE pool_id = %s
              AND block_timestamp >= now() - (%s * interval '1 day')
            GROUP BY day
            ORDER BY day
            """,
            (addr, days),
        )
        daily_swaps = [
            {"day": str(row[0]), "swap_count": row[1]}
            for row in await swap_cur.fetchall()
        ]

        # Daily liquidity events
        liq_cur = await conn.execute(
            f"""
            SELECT
                date_trunc('day', block_timestamp)::date AS day,
                count(*) FILTER (WHERE type = 'mint') AS mints,
                count(*) FILTER (WHERE type = 'burn') AS burns
            FROM (
                SELECT block_timestamp, 'mint' AS type
                FROM {schema}.mint_events WHERE pool_id = %s
                UNION ALL
                SELECT block_timestamp, 'burn' AS type
                FROM {schema}.burn_events WHERE pool_id = %s
            ) ev
            WHERE block_timestamp >= now() - (%s * interval '1 day')
            GROUP BY day
            ORDER BY day
            """,
            (addr, addr, days),
        )
        daily_liquidity = [
            {"day": str(row[0]), "mints": row[1], "burns": row[2]}
            for row in await liq_cur.fetchall()
        ]

    return {
        "success": True,
        "data": {
            "daily_swaps": daily_swaps,
            "daily_liquidity": daily_liquidity,
        },
        "meta": {"days": days},
    }
