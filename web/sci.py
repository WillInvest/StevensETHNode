"""Stevens Crypto Index (SCI) — calculation engine."""

import json
import math
from web.db import get_conn


# Component weights
WEIGHTS = {
    "dex": 0.25,
    "lending": 0.20,
    "liquidation": 0.15,
    "gas": 0.15,
    "network": 0.15,
    "bridge": 0.10,
}

# Rolling window: ~1 hour of blocks
WINDOW_BLOCKS = 300


def _clamp(val, lo=0, hi=100):
    return max(lo, min(hi, val))


def _z_to_score(z):
    """Map z-score to 0-100. Center at 50, 1 std = 15 points."""
    return _clamp(50 + z * 15, 0, 100)


async def _get_latest_block():
    async with get_conn() as conn:
        cur = await conn.execute(
            "SELECT MAX(block_num) FROM uniswap_v3_swaps"
        )
        row = await cur.fetchone()
        return row[0] if row and row[0] else 0


async def _safe_query(conn, sql, params=None):
    """Execute query and return scalar, defaulting to 0 on error."""
    try:
        cur = await conn.execute(sql, params or ())
        row = await cur.fetchone()
        return float(row[0]) if row and row[0] is not None else 0.0
    except Exception:
        return 0.0


async def _get_30d_stats(conn, table, column, current_block):
    """Get 30-day rolling mean and std for normalization."""
    blocks_30d = 30 * 24 * 300  # ~30 days of blocks
    start = current_block - blocks_30d
    # Sample hourly windows for efficiency
    sql = f"""
        SELECT AVG(cnt), STDDEV(cnt) FROM (
            SELECT (block_num / {WINDOW_BLOCKS}) AS bucket, COUNT(*) AS cnt
            FROM {table}
            WHERE block_num > %s
            GROUP BY bucket
        ) AS buckets
    """
    try:
        cur = await conn.execute(sql, (start,))
        row = await cur.fetchone()
        mean = float(row[0]) if row and row[0] else 1.0
        std = float(row[1]) if row and row[1] else 1.0
        return mean, max(std, 0.01)  # prevent division by zero
    except Exception:
        return 1.0, 1.0


async def compute_dex_score(conn, block_num):
    start = block_num - WINDOW_BLOCKS
    count = await _safe_query(
        conn,
        "SELECT COUNT(*) FROM uniswap_v3_swaps WHERE block_num BETWEEN %s AND %s",
        (start, block_num),
    )
    mean, std = await _get_30d_stats(conn, "uniswap_v3_swaps", "block_num", block_num)
    z = (count - mean) / std if std > 0 else 0
    return _z_to_score(z), {"swap_count": count, "mean_30d": mean, "std_30d": std}


async def compute_lending_score(conn, block_num):
    start = block_num - WINDOW_BLOCKS
    supply = await _safe_query(
        conn,
        "SELECT COUNT(*) FROM aave_v3_supply WHERE block_num BETWEEN %s AND %s",
        (start, block_num),
    )
    borrow = await _safe_query(
        conn,
        "SELECT COUNT(*) FROM aave_v3_borrow WHERE block_num BETWEEN %s AND %s",
        (start, block_num),
    )
    total = supply + borrow
    mean, std = await _get_30d_stats(conn, "aave_v3_supply", "block_num", block_num)
    z = (total - mean * 2) / (std * 2) if std > 0 else 0
    return _z_to_score(z), {"supply_count": supply, "borrow_count": borrow}


async def compute_liquidation_score(conn, block_num):
    start = block_num - WINDOW_BLOCKS
    count = await _safe_query(
        conn,
        "SELECT COUNT(*) FROM aave_v3_liquidation WHERE block_num BETWEEN %s AND %s",
        (start, block_num),
    )
    mean, std = await _get_30d_stats(conn, "aave_v3_liquidation", "block_num", block_num)
    z = (count - mean) / std if std > 0 else 0
    # Invert: more liquidations = lower health score
    return _clamp(100 - _z_to_score(z), 0, 100), {"liquidation_count": count}


async def compute_gas_score(conn, block_num):
    """Gas score based on recent gas utilization from fee history."""
    # Use a simple heuristic: more gas used = higher score
    start = block_num - WINDOW_BLOCKS
    count = await _safe_query(
        conn,
        "SELECT COUNT(*) FROM uniswap_v3_swaps WHERE block_num BETWEEN %s AND %s",
        (start, block_num),
    )
    # Proxy: tx density indicates gas demand
    mean, std = await _get_30d_stats(conn, "uniswap_v3_swaps", "block_num", block_num)
    z = (count - mean) / std if std > 0 else 0
    return _z_to_score(z * 0.8), {"tx_density": count}


async def compute_network_score(conn, block_num):
    start = block_num - WINDOW_BLOCKS
    transfers = await _safe_query(
        conn,
        "SELECT COUNT(*) FROM erc20_transfers WHERE block_num BETWEEN %s AND %s",
        (start, block_num),
    )
    mean, std = await _get_30d_stats(conn, "erc20_transfers", "block_num", block_num)
    z = (transfers - mean) / std if std > 0 else 0
    return _z_to_score(z), {"transfer_count": transfers}


async def compute_bridge_score(conn, block_num):
    start = block_num - WINDOW_BLOCKS
    arb = await _safe_query(
        conn,
        "SELECT COUNT(*) FROM arb_message_delivered WHERE block_num BETWEEN %s AND %s",
        (start, block_num),
    )
    op = await _safe_query(
        conn,
        "SELECT COUNT(*) FROM op_tx_deposited WHERE block_num BETWEEN %s AND %s",
        (start, block_num),
    )
    base = await _safe_query(
        conn,
        "SELECT COUNT(*) FROM base_tx_deposited WHERE block_num BETWEEN %s AND %s",
        (start, block_num),
    )
    total = arb + op + base
    mean, std = await _get_30d_stats(conn, "arb_message_delivered", "block_num", block_num)
    z = (total - mean * 3) / (std * 3) if std > 0 else 0
    return _z_to_score(z), {"arb": arb, "op": op, "base": base}


async def compute_sci_for_block(block_num=None):
    """Compute SCI score for a given block (or latest)."""
    async with get_conn() as conn:
        if block_num is None:
            block_num = await _get_latest_block()
        if block_num == 0:
            return None

        dex_score, dex_raw = await compute_dex_score(conn, block_num)
        lending_score, lending_raw = await compute_lending_score(conn, block_num)
        liq_score, liq_raw = await compute_liquidation_score(conn, block_num)
        gas_score, gas_raw = await compute_gas_score(conn, block_num)
        net_score, net_raw = await compute_network_score(conn, block_num)
        bridge_score, bridge_raw = await compute_bridge_score(conn, block_num)

        sci = (
            WEIGHTS["dex"] * dex_score
            + WEIGHTS["lending"] * lending_score
            + WEIGHTS["liquidation"] * liq_score
            + WEIGHTS["gas"] * gas_score
            + WEIGHTS["network"] * net_score
            + WEIGHTS["bridge"] * bridge_score
        )
        sci = round(sci, 2)

        raw_metrics = {
            "dex": dex_raw,
            "lending": lending_raw,
            "liquidation": liq_raw,
            "gas": gas_raw,
            "network": net_raw,
            "bridge": bridge_raw,
        }

        return {
            "block_num": block_num,
            "sci_score": sci,
            "dex_score": round(dex_score, 2),
            "lending_score": round(lending_score, 2),
            "liquidation_score": round(liq_score, 2),
            "gas_score": round(gas_score, 2),
            "network_score": round(net_score, 2),
            "bridge_score": round(bridge_score, 2),
            "raw_metrics": raw_metrics,
        }
