"""ETH Distribution API Router

Endpoint for Uniswap V3 WETH/USDC liquidity distribution across price ticks.
Serves the EthDistribution.jsx frontend page.

Cache strategy: all fee-tier results are pre-warmed on startup and refreshed
every REFRESH_INTERVAL seconds in a background task, so dropdown switches
always hit warm cache.
"""

import asyncio
import json
import logging
import os as _os
import sys
import time
from typing import Any

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

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
    "10000": {
        "name": "ETH/USDC 1%",
        "address": "0x7BeA39867e4169DBe237d55C8242a8f2fcDcc387",
        "fee_label": "1%",
    },
}


def _fetch_pool_ticks(pool_address: str, block_identifier: str | int = "latest") -> dict:
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

    df = get_tick_liquidity(pool_address, price_pct_range=0.3, block_identifier=block_identifier)
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


async def _refresh_fee_tier(fee_tier: str, block_identifier: str | int = "latest") -> dict:
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
            asyncio.to_thread(_fetch_pool_ticks, pool_info["address"], block_identifier)
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
                _fetch_pool_ticks, pool_info["address"], block_identifier
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
        "block_number": _latest_block.get("number") if _latest_block else None,
        "block_timestamp": _latest_block.get("timestamp") if _latest_block else None,
        "pool_addresses": [pool_info["address"] for _tier, pool_info in targets],
        "updated_at": time.time(),
    }

    _cache[f"eth_dist_{fee_tier}"] = {"data": data, "ts": time.time()}
    return data


async def _refresh_all_tiers():
    """Refresh cache for every fee tier (individual pools first, then merged)."""
    # Fetch individual pools in parallel — "all" reuses their RPC data anyway,
    # but keeping it simple: just refresh each key independently.
    for tier in ["500", "3000", "10000", "all"]:
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


# --- Block-by-block WebSocket updates ---
_latest_block: dict[str, Any] = {}
_block_listener_task: asyncio.Task | None = None
_ws_clients: set[WebSocket] = set()
ERIGON_WS_URL = "ws://127.0.0.1:8546"
PERSIST_TICK_SNAPSHOTS = _os.environ.get("PERSIST_TICK_SNAPSHOTS", "").lower() in ("true", "1", "yes")
SNAPSHOT_PERSIST_INTERVAL = 100  # persist tick snapshot every N blocks


async def _erigon_block_listener():
    """Connect to Erigon WS, subscribe to newHeads, refresh ticks on each block."""
    import websockets

    backoff = 1
    while True:
        try:
            async with websockets.connect(ERIGON_WS_URL, ping_interval=30, ping_timeout=10) as ws:
                # Subscribe to newHeads
                sub_msg = json.dumps({
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "eth_subscribe",
                    "params": ["newHeads"],
                })
                await ws.send(sub_msg)
                resp = json.loads(await ws.recv())
                sub_id = resp.get("result")
                logger.info("Subscribed to newHeads (sub_id=%s)", sub_id)
                backoff = 1  # reset on successful connect

                async for raw_msg in ws:
                    try:
                        msg = json.loads(raw_msg)
                        params = msg.get("params", {})
                        result = params.get("result", {})
                        if not result:
                            continue

                        block_hex = result.get("number", "0x0")
                        block_number = int(block_hex, 16)
                        timestamp_hex = result.get("timestamp", "0x0")
                        block_timestamp = int(timestamp_hex, 16)

                        _latest_block["number"] = block_number
                        _latest_block["timestamp"] = block_timestamp

                        logger.debug("New block %d (ts=%d)", block_number, block_timestamp)

                        # Refresh all tiers at this block
                        try:
                            await _refresh_all_tiers_at_block(block_number)
                        except Exception as exc:
                            logger.error("Block refresh failed at %d: %s", block_number, exc)

                        # Broadcast to WebSocket clients
                        await _broadcast_to_ws_clients()

                        # Phase 4: periodic snapshot persistence
                        if PERSIST_TICK_SNAPSHOTS and block_number % SNAPSHOT_PERSIST_INTERVAL == 0:
                            asyncio.create_task(_persist_tick_snapshot(block_number, block_timestamp))

                    except (json.JSONDecodeError, KeyError, ValueError) as exc:
                        logger.warning("Bad newHeads message: %s", exc)

        except asyncio.CancelledError:
            logger.info("Block listener cancelled")
            return
        except Exception as exc:
            logger.error("Block listener connection error: %s (reconnecting in %ds)", exc, backoff)
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 60)


async def _refresh_all_tiers_at_block(block_number: int):
    """Refresh all fee tier caches pinned to a specific block number."""
    for tier in ["500", "3000", "10000", "all"]:
        try:
            await _refresh_fee_tier(tier, block_identifier=block_number)
        except Exception as exc:
            logger.error("Block refresh failed for tier=%s block=%d: %s", tier, block_number, exc)


async def _broadcast_to_ws_clients():
    """Push latest tick data to all connected WebSocket clients."""
    if not _ws_clients:
        return

    dead = set()
    for ws in _ws_clients:
        try:
            # Get client's preferred fee tier from state
            fee_tier = getattr(ws, "_fee_tier", "all")
            cache_key = f"eth_dist_{fee_tier}"
            if cache_key in _cache:
                data = _cache[cache_key]["data"]
                msg = json.dumps({
                    "type": "tick_update",
                    "block_number": _latest_block.get("number"),
                    "block_timestamp": _latest_block.get("timestamp"),
                    "updated_at": time.time(),
                    "data": data,
                })
                await ws.send_text(msg)
        except Exception:
            dead.add(ws)
    _ws_clients -= dead


async def start_block_listener():
    """Start the Erigon newHeads WebSocket listener."""
    global _block_listener_task
    if _block_listener_task is None or _block_listener_task.done():
        _block_listener_task = asyncio.create_task(_erigon_block_listener())
        logger.info("Erigon block listener started (ws=%s)", ERIGON_WS_URL)


def stop_block_listener():
    """Cancel the block listener task."""
    global _block_listener_task
    if _block_listener_task and not _block_listener_task.done():
        _block_listener_task.cancel()
        logger.info("Erigon block listener stopped")
        _block_listener_task = None


LIQ_CACHE_TTL = 60  # liquidation data refreshes more often (Hyperliquid is fast)
POSITION_SCAN_INTERVAL = 300  # seconds between full position scans (5 min)
FALLBACK_ADDRESS_THRESHOLD = 1_000  # fall back to estimator below this many known addresses

_DB_URL = _os.environ.get(
    "ETHNODE_DATABASE_URL",
    "postgres://ethnode:changeme@localhost:5432/ethnode",
)

_liq_scan_task: asyncio.Task | None = None


def _fetch_liquidation_map_exact() -> dict:
    """Return exact liquidation map from DB positions; fall back to estimator.

    Blocking — runs via asyncio.to_thread.

    Checks whether enough addresses have been harvested to trust the DB data.
    If yes, builds the distribution from real positions.
    If no (bootstrap phase), falls back to the OI-distribution estimator.

    Always adds:
      source:          "exact" | "estimated"
      coverage_pct:    % of total OI covered by known addresses
      known_addresses: count of addresses in hl_known_addresses
    """
    sys.path.insert(0, "/home/hfu11/stevens-blockchain")
    from importlib import import_module

    mod_scanner = import_module(
        "protocols-live-state.perps.hyperliquid.extractors.position_scanner"
    )
    mod_estimator = import_module(
        "protocols-live-state.perps.hyperliquid.extractors.liquidation_estimator"
    )

    try:
        addr_count = mod_scanner.get_known_address_count(_DB_URL)
    except Exception:
        addr_count = 0

    if addr_count >= FALLBACK_ADDRESS_THRESHOLD:
        try:
            result, coverage_pct = mod_scanner.build_exact_liquidation_map(
                coin="ETH",
                num_bars=120,
                price_pct_range=0.30,
                database_url=_DB_URL,
            )
            data = result.to_dict()
            data["source"] = "exact"
            data["coverage_pct"] = round(coverage_pct, 1)
            data["known_addresses"] = addr_count
            return data
        except Exception as exc:
            logger.warning("Exact map failed, falling back to estimator: %s", exc)

    # Fallback: OI-distribution estimation model
    result = mod_estimator.estimate_liquidation_map(
        coin="ETH", price_pct_range=0.30, num_bars=120
    )
    data = result.to_dict()
    data["source"] = "estimated"
    data["coverage_pct"] = 0.0
    data["known_addresses"] = addr_count
    return data


async def _position_scanner_loop() -> None:
    """Background task: batch-scan all known HL addresses every 5 minutes."""
    sys.path.insert(0, "/home/hfu11/stevens-blockchain")
    from importlib import import_module

    mod = import_module(
        "protocols-live-state.perps.hyperliquid.extractors.position_scanner"
    )

    while True:
        try:
            addresses = await asyncio.to_thread(
                mod.get_addresses_for_scan,
                _DB_URL,
                50_000,
            )
            if addresses:
                count = await asyncio.to_thread(
                    mod.batch_scan_positions,
                    addresses,
                    "ETH",
                    _DB_URL,
                    20,   # concurrency: 20 parallel API calls
                )
                logger.info(
                    "HL position scan complete: %d addresses → %d ETH positions",
                    len(addresses),
                    count,
                )
                # Refresh liquidation map cache immediately after a successful scan
                try:
                    data = await asyncio.to_thread(_fetch_liquidation_map_exact)
                    _cache["liq_map"] = {"data": data, "ts": time.time()}
                    logger.info(
                        "Liq map cache refreshed (source=%s, coverage=%.1f%%)",
                        data.get("source", "?"),
                        data.get("coverage_pct", 0.0),
                    )
                except Exception as exc:
                    logger.error("Post-scan cache refresh failed: %s", exc)
            else:
                logger.debug("HL position scanner: no addresses yet, waiting")
        except Exception as exc:
            logger.error("HL position scanner loop error: %s", exc)
        await asyncio.sleep(POSITION_SCAN_INTERVAL)


async def start_position_scan() -> None:
    """Start the HL position scanner background task (call from app lifespan)."""
    global _liq_scan_task
    if _liq_scan_task is None or _liq_scan_task.done():
        _liq_scan_task = asyncio.create_task(_position_scanner_loop())
        logger.info(
            "HL position scanner started (interval=%ds)", POSITION_SCAN_INTERVAL
        )


def stop_position_scan() -> None:
    """Cancel the HL position scanner background task."""
    global _liq_scan_task
    if _liq_scan_task and not _liq_scan_task.done():
        _liq_scan_task.cancel()
        logger.info("HL position scanner stopped")
        _liq_scan_task = None


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
    fee_tier: str = Query("all", pattern="^(500|3000|10000|all)$"),
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
    """Get Hyperliquid ETH liquidation heatmap — exact data when available."""
    cache_key = "liq_map"
    now = time.time()
    if cache_key in _cache and (now - _cache[cache_key]["ts"]) < LIQ_CACHE_TTL:
        return _cache[cache_key]["data"]

    try:
        data = await asyncio.to_thread(_fetch_liquidation_map_exact)
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


# --- WebSocket endpoint for live tick updates ---

@router.websocket("/eth-distribution/ws")
async def eth_distribution_ws(ws: WebSocket):
    """WebSocket endpoint for block-by-block ETH distribution updates.

    Client sends fee tier preference on connect (e.g. "all", "500").
    Server pushes tick_update messages on each new block.
    Client can send a new fee tier mid-session to switch without reconnecting.
    """
    await ws.accept()
    ws._fee_tier = "all"  # type: ignore[attr-defined]
    _ws_clients.add(ws)
    logger.info("WS client connected (total=%d)", len(_ws_clients))

    # Send initial cached data immediately
    cache_key = f"eth_dist_{ws._fee_tier}"
    if cache_key in _cache:
        try:
            await ws.send_text(json.dumps({
                "type": "tick_update",
                "block_number": _latest_block.get("number"),
                "block_timestamp": _latest_block.get("timestamp"),
                "updated_at": time.time(),
                "data": _cache[cache_key]["data"],
            }))
        except Exception:
            pass

    try:
        while True:
            msg = await ws.receive_text()
            # Client can send a fee tier preference
            try:
                parsed = json.loads(msg)
                new_tier = parsed.get("fee_tier", "all")
                if new_tier in ("all", "500", "3000", "10000"):
                    ws._fee_tier = new_tier  # type: ignore[attr-defined]
                    # Send data for new tier immediately
                    ck = f"eth_dist_{new_tier}"
                    if ck in _cache:
                        await ws.send_text(json.dumps({
                            "type": "tick_update",
                            "block_number": _latest_block.get("number"),
                            "block_timestamp": _latest_block.get("timestamp"),
                            "updated_at": time.time(),
                            "data": _cache[ck]["data"],
                        }))
            except (json.JSONDecodeError, AttributeError):
                pass
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        _ws_clients.discard(ws)
        logger.info("WS client disconnected (total=%d)", len(_ws_clients))


# --- Phase 4: Periodic tick snapshot persistence ---

async def _persist_tick_snapshot(block_number: int, block_timestamp: int):
    """Persist current tick data to uniswap_v3_tick_snapshots table."""
    try:
        from web.db import get_conn

        for tier, pool_info in WETH_USDC_POOLS.items():
            cache_key = f"eth_dist_{tier}"
            if cache_key not in _cache:
                continue
            data = _cache[cache_key]["data"]
            ticks = data.get("ticks", [])
            if not ticks:
                continue

            pool_address = pool_info["address"].lower()
            current_price = data.get("current_price", 0)

            rows = []
            for t in ticks:
                rows.append((
                    pool_address,
                    block_number,
                    block_timestamp,
                    0,  # tick index not available from cache, use 0
                    t["price"],
                    t["liquidity_usd"],
                    t["liquidity_usd"],
                    0,  # liquidity_net not in cache
                    t["is_current_tick"],
                    current_price,
                ))

            if not rows:
                continue

            insert_sql = (
                "INSERT INTO uniswap_v3_tick_snapshots "
                "(pool_address, block_number, block_timestamp, tick, price, "
                " liquidity, liquidity_usd, liquidity_net, is_current_tick, current_price) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) "
                "ON CONFLICT (pool_address, block_number, tick) DO NOTHING"
            )

            async with get_conn() as conn:
                async with conn.cursor() as cur:
                    await cur.executemany(insert_sql, rows)
                await conn.commit()

        logger.info("Persisted tick snapshots at block %d", block_number)
    except Exception as exc:
        logger.error("Failed to persist tick snapshot at block %d: %s", block_number, exc)
