"""Uniswap V3 pool metadata resolver — 3-tier cache: memory → DB → Erigon RPC."""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Any

import httpx

from web.db import get_conn
from web.services.token_symbols import get_symbol, get_fee_label

logger = logging.getLogger(__name__)

RPC_URL = os.environ.get("ERIGON_RPC_URL", "http://127.0.0.1:8545")

# Function selectors for eth_call
_SEL_TOKEN0 = "0x0dfe1681"
_SEL_TOKEN1 = "0xd21220a7"
_SEL_FEE = "0xddca3f43"
_SEL_SYMBOL = "0x95d89b41"

# In-memory cache: pool_address (lowercase) -> metadata dict
_cache: dict[str, dict[str, Any]] = {}

# Background tasks kept alive to prevent GC before completion
_bg_tasks: set[asyncio.Task] = set()


def _decode_address(hex_result: str) -> str:
    """Decode a 32-byte padded address from eth_call result."""
    raw = hex_result.removeprefix("0x")
    # Last 40 hex chars = 20 bytes = address
    return "0x" + raw[-40:].lower()


def _decode_uint24(hex_result: str) -> int:
    """Decode a uint24 from eth_call result (right-aligned in 32 bytes)."""
    raw = hex_result.removeprefix("0x")
    return int(raw, 16)


def _decode_symbol(hex_result: str) -> str:
    """Decode ABI-encoded string or bytes32 symbol from eth_call result."""
    raw = hex_result.removeprefix("0x")
    if not raw:
        return "?"
    data = bytes.fromhex(raw)

    # Try ABI-encoded string: first 32 bytes are offset (should be 32),
    # next 32 bytes are length, then the UTF-8 payload.
    if len(data) >= 64:
        try:
            offset = int.from_bytes(data[:32], "big")
            if offset == 32:
                length = int.from_bytes(data[32:64], "big")
                if 0 < length <= 128:
                    return data[64 : 64 + length].decode("utf-8", errors="replace").strip("\x00")
        except Exception:
            pass

    # Fallback: treat as bytes32 (null-terminated)
    return data[:32].rstrip(b"\x00").decode("utf-8", errors="replace")


async def _eth_call(client: httpx.AsyncClient, to: str, data: str, rpc_id: int) -> str | None:
    """Execute a single eth_call, return hex result or None on error."""
    try:
        resp = await client.post(
            RPC_URL,
            json={
                "jsonrpc": "2.0",
                "method": "eth_call",
                "params": [{"to": to, "data": data}, "latest"],
                "id": rpc_id,
            },
            timeout=5.0,
        )
        result = resp.json().get("result")
        if result and result != "0x":
            return result
    except Exception as exc:
        logger.debug("eth_call failed for %s: %s", to, exc)
    return None


async def _resolve_via_rpc(pool_address: str) -> dict[str, Any] | None:
    """Resolve pool metadata from Erigon RPC. Returns None if RPC unavailable."""
    async with httpx.AsyncClient() as client:
        t0_raw, t1_raw, fee_raw = await asyncio.gather(
            _eth_call(client, pool_address, _SEL_TOKEN0, 1),
            _eth_call(client, pool_address, _SEL_TOKEN1, 2),
            _eth_call(client, pool_address, _SEL_FEE, 3),
        )

    if not (t0_raw and t1_raw and fee_raw):
        return None

    token0_address = _decode_address(t0_raw)
    token1_address = _decode_address(t1_raw)
    fee = _decode_uint24(fee_raw)

    # Resolve symbols: check known dict first, then RPC
    token0_symbol = get_symbol(token0_address)
    token1_symbol = get_symbol(token1_address)

    needs_rpc = [
        (token0_address, token0_symbol is None),
        (token1_address, token1_symbol is None),
    ]
    unknowns = [addr for addr, unknown in needs_rpc if unknown]

    if unknowns:
        async with httpx.AsyncClient() as client:
            results = await asyncio.gather(
                *[_eth_call(client, addr, _SEL_SYMBOL, i) for i, addr in enumerate(unknowns)]
            )
        sym_map = {addr: (_decode_symbol(r) if r else "?") for addr, r in zip(unknowns, results)}
        if token0_symbol is None:
            token0_symbol = sym_map.get(token0_address, "?")
        if token1_symbol is None:
            token1_symbol = sym_map.get(token1_address, "?")

    fee_label = get_fee_label(fee)
    return {
        "pool_address": pool_address.lower(),
        "token0_address": token0_address,
        "token1_address": token1_address,
        "token0_symbol": token0_symbol,
        "token1_symbol": token1_symbol,
        "fee": fee,
        "fee_label": fee_label,
        "display_name": f"{token0_symbol}/{token1_symbol}",
    }


async def _save_to_db(meta: dict[str, Any]) -> None:
    """Upsert pool metadata into uniswap_v3.pool_metadata."""
    try:
        async with get_conn() as conn:
            await conn.execute(
                """
                INSERT INTO uniswap_v3.pool_metadata
                    (pool_address, token0_address, token1_address, token0_symbol, token1_symbol, fee, fee_label)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (pool_address) DO UPDATE SET
                    token0_symbol = EXCLUDED.token0_symbol,
                    token1_symbol = EXCLUDED.token1_symbol,
                    resolved_at = now()
                """,
                (
                    meta["pool_address"],
                    meta["token0_address"],
                    meta["token1_address"],
                    meta["token0_symbol"],
                    meta["token1_symbol"],
                    meta["fee"],
                    meta["fee_label"],
                ),
            )
    except Exception as exc:
        logger.warning("Could not save pool_metadata for %s: %s", meta["pool_address"], exc)


async def resolve(pool_address: str) -> dict[str, Any] | None:
    """Resolve pool metadata: memory → DB → RPC (3-tier)."""
    addr = pool_address.lower()

    # Tier 1: in-memory cache
    if addr in _cache:
        return _cache[addr]

    # Tier 2: PostgreSQL
    try:
        async with get_conn() as conn:
            cur = await conn.execute(
                """
                SELECT pool_address, token0_address, token1_address,
                       token0_symbol, token1_symbol, fee, fee_label, display_name
                FROM uniswap_v3.pool_metadata
                WHERE pool_address = %s
                """,
                (addr,),
            )
            row = await cur.fetchone()
            if row:
                meta = dict(zip(
                    ["pool_address", "token0_address", "token1_address",
                     "token0_symbol", "token1_symbol", "fee", "fee_label", "display_name"],
                    row,
                ))
                _cache[addr] = meta
                return meta
    except Exception as exc:
        logger.warning("DB lookup failed for %s: %s", addr, exc)

    # Tier 3: Erigon RPC
    meta = await _resolve_via_rpc(addr)
    if meta:
        _cache[addr] = meta
        task = asyncio.create_task(_save_to_db(meta))
        _bg_tasks.add(task)
        task.add_done_callback(_bg_tasks.discard)
    return meta


async def resolve_batch(addresses: list[str]) -> dict[str, dict[str, Any]]:
    """Resolve multiple pools concurrently. Returns {address: metadata}."""
    results = await asyncio.gather(*[resolve(addr) for addr in addresses], return_exceptions=True)
    return {
        addr: meta
        for addr, meta in zip(addresses, results)
        if isinstance(meta, dict)
    }
