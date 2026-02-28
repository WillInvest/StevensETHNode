"""ETH Distribution API Router

Endpoint for Uniswap V3 WETH/USDC liquidity distribution across price ticks.
Serves the EthDistribution.jsx frontend page.

Cache strategy: all fee-tier results are pre-warmed on startup and refreshed
every REFRESH_INTERVAL seconds in a background task, so dropdown switches
always hit warm cache.
"""

import asyncio
import logging
import sys
import time
from typing import Any

from fastapi import APIRouter, Query

logger = logging.getLogger(__name__)

router = APIRouter(tags=["eth-distribution"])

# --- Cache ---
_cache: dict[str, Any] = {}
CACHE_TTL = 300  # seconds — generous since background task keeps it fresh
REFRESH_INTERVAL = 90  # seconds between background refreshes
_bg_task: asyncio.Task | None = None

# WETH/USDC pool configs (subset of POOL_CONFIGS from tick_liquidity.py)
WETH_USDC_POOLS = {
    "500": {
        "name": "ETH/USDC 0.05%",
        "address": "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640",
        "fee_label": "0.05%",
    },
    "3000": {
        "name": "ETH/USDC 0.3%",
        "address": "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",
        "fee_label": "0.3%",
    },
}


def _fetch_pool_ticks(pool_address: str) -> dict:
    """Fetch tick liquidity for a single pool (blocking RPC call).

    Uses price_pct_range=0.3 so the bitmap scan only covers ±30% around the
    current price, reducing RPC calls from ~700 to ~4 for the 0.05% pool.
    """
    sys.path.insert(0, "/home/hfu11/stevens-blockchain")
    from importlib import import_module

    mod = import_module(
        "protocols-live-state.dex.uniswap-v3.extractors.tick_liquidity"
    )
    get_tick_liquidity = mod.get_tick_liquidity

    df = get_tick_liquidity(pool_address, price_pct_range=0.3)
    current_price = df.attrs.get("current_price", 0)

    ticks = []
    for _, row in df.iterrows():
        ticks.append({
            "price": round(row["price"], 2),
            "liquidity_usd": round(row["liquidity_usd"], 2),
            "is_current_tick": bool(row["is_current_tick"]),
        })

    return {
        "current_price": round(current_price, 2),
        "tick_count": len(ticks),
        "ticks": ticks,
    }


def _merge_pool_ticks(pool_results: list[dict]) -> list[dict]:
    """Align ticks by price across pools and sum liquidity_usd."""
    price_map: dict[float, dict] = {}

    for result in pool_results:
        for tick in result["ticks"]:
            p = tick["price"]
            if p not in price_map:
                price_map[p] = {
                    "price": p,
                    "liquidity_usd": 0.0,
                    "is_current_tick": False,
                }
            price_map[p]["liquidity_usd"] += tick["liquidity_usd"]
            if tick["is_current_tick"]:
                price_map[p]["is_current_tick"] = True

    merged = sorted(price_map.values(), key=lambda t: t["price"])
    for t in merged:
        t["liquidity_usd"] = round(t["liquidity_usd"], 2)
    return merged


async def _refresh_fee_tier(fee_tier: str) -> dict:
    """Fetch fresh data for a single fee_tier and update the cache."""
    pool_results = []
    pools_meta = []

    if fee_tier == "all":
        targets = list(WETH_USDC_POOLS.items())
    else:
        targets = [(fee_tier, WETH_USDC_POOLS[fee_tier])]

    if len(targets) > 1:
        # Parallel fetch for multiple pools
        coros = [
            asyncio.to_thread(_fetch_pool_ticks, pool_info["address"])
            for _tier, pool_info in targets
        ]
        results = await asyncio.gather(*coros, return_exceptions=True)
        for (_tier, pool_info), result in zip(targets, results):
            if isinstance(result, Exception):
                logger.error("Failed to fetch ticks for %s: %s", pool_info["name"], result)
            else:
                pool_results.append(result)
                pools_meta.append({
                    "name": pool_info["name"],
                    "current_price": result["current_price"],
                    "tick_count": result["tick_count"],
                })
    else:
        _tier, pool_info = targets[0]
        try:
            result = await asyncio.to_thread(
                _fetch_pool_ticks, pool_info["address"]
            )
            pool_results.append(result)
            pools_meta.append({
                "name": pool_info["name"],
                "current_price": result["current_price"],
                "tick_count": result["tick_count"],
            })
        except Exception as exc:
            logger.error(
                "Failed to fetch ticks for %s: %s", pool_info["name"], exc
            )

    if not pool_results:
        return {
            "fee_tier": fee_tier,
            "fee_label": "All Fee Tiers" if fee_tier == "all" else WETH_USDC_POOLS.get(fee_tier, {}).get("fee_label", fee_tier),
            "current_price": 0,
            "total_liquidity_usd": 0,
            "tick_count": 0,
            "ticks": [],
            "pools": [],
        }

    if fee_tier == "all" and len(pool_results) > 1:
        ticks = _merge_pool_ticks(pool_results)
    else:
        ticks = pool_results[0]["ticks"]

    current_price = pool_results[0]["current_price"]
    total_liquidity = sum(t["liquidity_usd"] for t in ticks)

    fee_label = "All Fee Tiers" if fee_tier == "all" else WETH_USDC_POOLS[fee_tier]["fee_label"]

    data = {
        "fee_tier": fee_tier,
        "fee_label": fee_label,
        "current_price": current_price,
        "total_liquidity_usd": round(total_liquidity, 2),
        "tick_count": len(ticks),
        "ticks": ticks,
        "pools": pools_meta,
    }

    _cache[f"eth_dist_{fee_tier}"] = {"data": data, "ts": time.time()}
    return data


async def _refresh_all_tiers():
    """Refresh cache for every fee tier (individual pools first, then merged)."""
    # Fetch individual pools in parallel — "all" reuses their RPC data anyway,
    # but keeping it simple: just refresh each key independently.
    for tier in ["500", "3000", "all"]:
        try:
            await _refresh_fee_tier(tier)
            logger.info("Cache refreshed for fee_tier=%s", tier)
        except Exception as exc:
            logger.error("Background refresh failed for fee_tier=%s: %s", tier, exc)


async def _background_refresh_loop():
    """Periodically refresh all fee-tier caches so users never wait."""
    while True:
        try:
            await _refresh_all_tiers()
        except Exception as exc:
            logger.error("Background refresh cycle failed: %s", exc)
        await asyncio.sleep(REFRESH_INTERVAL)


async def start_background_refresh():
    """Start the background refresh task (call from app lifespan)."""
    global _bg_task
    if _bg_task is None or _bg_task.done():
        _bg_task = asyncio.create_task(_background_refresh_loop())
        logger.info("ETH distribution background refresh started (interval=%ds)", REFRESH_INTERVAL)


def stop_background_refresh():
    """Cancel the background refresh task (call from app shutdown)."""
    global _bg_task
    if _bg_task and not _bg_task.done():
        _bg_task.cancel()
        logger.info("ETH distribution background refresh stopped")
        _bg_task = None


LIQ_CACHE_TTL = 60  # liquidation data refreshes more often (Hyperliquid is fast)


def _fetch_liquidation_map() -> dict:
    """Fetch estimated liquidation map from Hyperliquid (blocking)."""
    sys.path.insert(0, "/home/hfu11/stevens-blockchain")
    from importlib import import_module

    mod = import_module(
        "protocols-live-state.perps.hyperliquid.extractors.liquidation_estimator"
    )
    result = mod.estimate_liquidation_map(coin="ETH", price_pct_range=0.30, num_bars=120)
    return result.to_dict()


def _fetch_cascade_sim() -> dict:
    """Run cascade simulation on estimated liquidation data (blocking)."""
    sys.path.insert(0, "/home/hfu11/stevens-blockchain")
    from importlib import import_module

    mod = import_module(
        "protocols-live-state.perps.hyperliquid.extractors.liquidation_estimator"
    )
    return mod.estimate_cascade_liquidations(coin="ETH", price_pct_range=0.30, num_bars=120)


@router.get("/eth-distribution/ticks")
async def get_eth_distribution_ticks(
    fee_tier: str = Query("all", pattern="^(500|3000|all)$"),
):
    """Get Uniswap V3 WETH/USDC tick-level liquidity distribution."""
    cache_key = f"eth_dist_{fee_tier}"
    now = time.time()
    if cache_key in _cache and (now - _cache[cache_key]["ts"]) < CACHE_TTL:
        return _cache[cache_key]["data"]

    # Cache miss (shouldn't happen often with background refresh running)
    return await _refresh_fee_tier(fee_tier)


@router.get("/eth-distribution/liquidation-map")
async def get_liquidation_map():
    """Get estimated Hyperliquid ETH liquidation heatmap data."""
    cache_key = "liq_map"
    now = time.time()
    if cache_key in _cache and (now - _cache[cache_key]["ts"]) < LIQ_CACHE_TTL:
        return _cache[cache_key]["data"]

    try:
        data = await asyncio.to_thread(_fetch_liquidation_map)
        _cache[cache_key] = {"data": data, "ts": time.time()}
        return data
    except Exception as exc:
        logger.error("Liquidation map fetch failed: %s", exc)
        return {"error": str(exc), "bars": []}


@router.get("/eth-distribution/cascade-sim")
async def get_cascade_sim():
    """Run cascade liquidation simulation on Hyperliquid ETH positions."""
    cache_key = "cascade_sim"
    now = time.time()
    if cache_key in _cache and (now - _cache[cache_key]["ts"]) < LIQ_CACHE_TTL:
        return _cache[cache_key]["data"]

    try:
        data = await asyncio.to_thread(_fetch_cascade_sim)
        _cache[cache_key] = {"data": data, "ts": time.time()}
        return data
    except Exception as exc:
        logger.error("Cascade sim failed: %s", exc)
        return {"error": str(exc), "bars": []}
