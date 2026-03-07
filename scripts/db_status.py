#!/usr/bin/env python3
"""Database status dashboard — shows what on-chain data you have across all protocols.

Usage:
    python3 scripts/db_status.py              # full status
    python3 scripts/db_status.py --protocol uniswap_v3   # single protocol
    python3 scripts/db_status.py --json       # machine-readable output
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.request
from dataclasses import dataclass, field

import psycopg
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

DB_URL = os.environ.get(
    "ETHNODE_DATABASE_URL",
    "postgres://ethnode:changeme@localhost:5432/ethnode",
)
RPC_URL = os.environ.get("ERIGON_RPC_URL", "http://127.0.0.1:8545")

# Well-known token symbols (lowercase address → symbol)
TOKEN_SYMBOLS = {
    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": "WETH",
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": "USDC",
    "0xdac17f958d2ee523a2206206994597c13d831ec7": "USDT",
    "0x6b175474e89094c44da98b954eedeac495271d0f": "DAI",
    "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599": "WBTC",
    "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984": "UNI",
    "0x514910771af9ca656af840dff83e8264ecf986ca": "LINK",
    "0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0": "wstETH",
    "0xae78736cd615f374d3085123a210448e74fc6393": "rETH",
    "0xcbcdf9626bc03e24f779434178a73a0b4bad62ed": "WBTC/USDC",  # known pool shortcut
}

# Fee tier display
FEE_LABELS = {
    100: "0.01%",
    500: "0.05%",
    3000: "0.30%",
    10000: "1.00%",
}

# ---------------------------------------------------------------------------
# Protocol Registry
# ---------------------------------------------------------------------------
# Each protocol defines:
#   - schema: DB schema (or "public")
#   - entity_name: what we call each tracked thing (pool, market, etc.)
#   - tables: list of (table_name, display_name, block_column_or_none)
#   - entity_column: column that identifies the entity in event tables
#   - custom_query: optional function for protocols that don't fit the pattern

PROTOCOLS = {
    "uniswap_v3": {
        "display_name": "Uniswap V3",
        "schema": "uniswap_v3",
        "entity_name": "Pool",
        "entity_column": "pool_id",
        "block_column": "block",
        "tables": [
            ("swap_events", "Swaps"),
            ("mint_events", "Mints"),
            ("burn_events", "Burns"),
        ],
    },
    "hyperliquid": {
        "display_name": "Hyperliquid",
        "schema": "public",
        "entity_name": "Table",
        "tables": [
            ("hl_known_addresses", "Known Addresses"),
            ("hl_positions", "Positions"),
        ],
        "custom": True,  # uses custom query logic
    },
}


# ---------------------------------------------------------------------------
# RPC helper
# ---------------------------------------------------------------------------

def get_chain_head(rpc_url: str) -> int | None:
    """Get latest block number from Erigon RPC."""
    try:
        payload = json.dumps({
            "jsonrpc": "2.0",
            "method": "eth_blockNumber",
            "params": [],
            "id": 1,
        }).encode()
        req = urllib.request.Request(
            rpc_url,
            data=payload,
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read())
        return int(data["result"], 16)
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Token resolution
# ---------------------------------------------------------------------------

def resolve_token_symbol(address: str, rpc_url: str) -> str:
    """Resolve token address to symbol. Uses lookup table, falls back to RPC symbol() call."""
    addr = address.lower()
    if addr in TOKEN_SYMBOLS:
        return TOKEN_SYMBOLS[addr]

    # Try ERC20 symbol() call: 0x95d89b41
    try:
        payload = json.dumps({
            "jsonrpc": "2.0",
            "method": "eth_call",
            "params": [{"to": addr, "data": "0x95d89b41"}, "latest"],
            "id": 1,
        }).encode()
        req = urllib.request.Request(
            rpc_url,
            data=payload,
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read())
        result = data.get("result", "0x")
        if result and len(result) > 2:
            # ABI-decode string: skip 0x + 64 bytes offset + 64 bytes length
            hex_str = result[2:]
            if len(hex_str) >= 192:
                str_len = int(hex_str[64:128], 16)
                symbol = bytes.fromhex(hex_str[128:128 + str_len * 2]).decode("utf-8", errors="replace").strip()
                if symbol:
                    TOKEN_SYMBOLS[addr] = symbol  # cache for this session
                    return symbol
    except Exception:
        pass

    return addr[:6] + ".." + addr[-4:]


def resolve_pool_pair(pool_addr: str, rpc_url: str) -> str:
    """Get token pair string for a Uniswap V3 pool via token0()/token1() RPC calls."""
    # token0() = 0x0dfe1681, token1() = 0xd21220a7
    token0_addr = _rpc_address_call(pool_addr, "0x0dfe1681", rpc_url)
    token1_addr = _rpc_address_call(pool_addr, "0xd21220a7", rpc_url)

    if not token0_addr or not token1_addr:
        return "?/?"

    sym0 = resolve_token_symbol(token0_addr, rpc_url)
    sym1 = resolve_token_symbol(token1_addr, rpc_url)
    return f"{sym0}/{sym1}"


def _rpc_address_call(to: str, data: str, rpc_url: str) -> str | None:
    """Call a view function that returns an address."""
    try:
        payload = json.dumps({
            "jsonrpc": "2.0",
            "method": "eth_call",
            "params": [{"to": to, "data": data}, "latest"],
            "id": 1,
        }).encode()
        req = urllib.request.Request(
            rpc_url,
            data=payload,
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            result = json.loads(resp.read()).get("result", "0x")
        if result and len(result) >= 66:
            return "0x" + result[-40:]
    except Exception:
        pass
    return None


def resolve_pool_fee(pool_addr: str, rpc_url: str) -> str:
    """Get fee tier label for a Uniswap V3 pool."""
    try:
        payload = json.dumps({
            "jsonrpc": "2.0",
            "method": "eth_call",
            "params": [{"to": pool_addr, "data": "0xddca3f43"}, "latest"],
            "id": 1,
        }).encode()
        req = urllib.request.Request(
            rpc_url,
            data=payload,
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            result = json.loads(resp.read()).get("result", "0x")
        fee = int(result, 16)
        return FEE_LABELS.get(fee, f"{fee / 10000}%")
    except Exception:
        return "?"


# ---------------------------------------------------------------------------
# Formatting helpers
# ---------------------------------------------------------------------------

def fmt_count(n: int) -> str:
    """Format a number with K/M suffix for readability."""
    if n >= 1_000_000:
        return f"{n / 1_000_000:.1f}M"
    elif n >= 1_000:
        return f"{n / 1_000:.1f}K"
    return f"{n:,}"


def fmt_block(b: int) -> str:
    """Format a block number as compact string."""
    if b >= 1_000_000:
        return f"{b / 1_000_000:.2f}M"
    return f"{b:,}"


# ---------------------------------------------------------------------------
# Protocol-specific queries
# ---------------------------------------------------------------------------

def query_uniswap_v3(conn: psycopg.Connection, config: dict, rpc_url: str, console: Console) -> dict:
    """Query Uniswap V3 protocol status."""
    schema = config["schema"]
    results = {"pools": []}

    with conn.cursor() as cur:
        # Get all unique pools across all tables
        cur.execute(f"""
            SELECT pool_id FROM (
                SELECT DISTINCT pool_id FROM {schema}.swap_events
                UNION
                SELECT DISTINCT pool_id FROM {schema}.mint_events
                UNION
                SELECT DISTINCT pool_id FROM {schema}.burn_events
            ) t ORDER BY pool_id
        """)
        pool_ids = [row[0].strip() for row in cur.fetchall()]

        if not pool_ids:
            return results

        for pool_id in pool_ids:
            pool_data = {"address": pool_id}

            # Resolve token pair and fee via RPC
            pool_data["pair"] = resolve_pool_pair(pool_id, rpc_url)
            pool_data["fee"] = resolve_pool_fee(pool_id, rpc_url)

            # Query each event table
            for table_name, display_name in config["tables"]:
                cur.execute(f"""
                    SELECT count(*), min(block), max(block)
                    FROM {schema}.{table_name}
                    WHERE pool_id = %s
                """, (pool_id,))
                count, min_block, max_block = cur.fetchone()
                pool_data[display_name.lower()] = {
                    "count": count or 0,
                    "min_block": min_block,
                    "max_block": max_block,
                }

            # Check sync_state for actual scan progress
            try:
                cur.execute("""
                    SELECT last_scanned_block FROM uniswap_v3.sync_state WHERE pool_id = %s
                """, (pool_id,))
                row = cur.fetchone()
                pool_data["last_scanned_block"] = row[0] if row else None
            except Exception:
                pool_data["last_scanned_block"] = None

            results["pools"].append(pool_data)

    return results


def query_hyperliquid(conn: psycopg.Connection, config: dict) -> dict:
    """Query Hyperliquid protocol status."""
    results = {}

    with conn.cursor() as cur:
        # Known addresses
        cur.execute("SELECT count(*), min(first_seen_at), max(last_active_at) FROM hl_known_addresses")
        count, first_seen, last_active = cur.fetchone()
        results["known_addresses"] = {
            "count": count or 0,
            "first_seen": str(first_seen) if first_seen else None,
            "last_active": str(last_active) if last_active else None,
        }

        # Positions
        cur.execute("""
            SELECT count(*), count(DISTINCT address), count(DISTINCT coin),
                   min(scanned_at), max(scanned_at)
            FROM hl_positions
        """)
        pos_count, addr_count, coin_count, first_scan, last_scan = cur.fetchone()
        results["positions"] = {
            "count": pos_count or 0,
            "unique_addresses": addr_count or 0,
            "unique_coins": coin_count or 0,
            "first_scan": str(first_scan) if first_scan else None,
            "last_scan": str(last_scan) if last_scan else None,
        }

        # Top coins by position count
        cur.execute("""
            SELECT coin, count(*) as cnt,
                   sum(CASE WHEN side = 'long' THEN 1 ELSE 0 END) as longs,
                   sum(CASE WHEN side = 'short' THEN 1 ELSE 0 END) as shorts
            FROM hl_positions
            GROUP BY coin ORDER BY cnt DESC LIMIT 10
        """)
        results["top_coins"] = [
            {"coin": row[0], "count": row[1], "longs": row[2], "shorts": row[3]}
            for row in cur.fetchall()
        ]

    return results


# ---------------------------------------------------------------------------
# Rendering
# ---------------------------------------------------------------------------

def render_uniswap_v3(data: dict, chain_head: int | None, console: Console) -> None:
    """Render Uniswap V3 status as Rich tables."""
    pools = data.get("pools", [])
    if not pools:
        console.print("  [dim]No data found[/]")
        return

    table = Table(box=None, padding=(0, 1), show_edge=False)
    table.add_column("Pool", style="bold")
    table.add_column("Pair", style="bold cyan")
    table.add_column("Fee", style="cyan", justify="right")
    table.add_column("Swaps", style="green", justify="right")
    table.add_column("Mints", style="yellow", justify="right")
    table.add_column("Burns", style="red", justify="right")
    table.add_column("Event Range", justify="center")
    table.add_column("Scanned To", justify="right")
    table.add_column("Status", justify="right")

    total_events = 0

    for p in pools:
        addr = p["address"]
        abbrev = f"{addr[:6]}..{addr[-4:]}"

        swaps = p.get("swaps", {})
        mints = p.get("mints", {})
        burns = p.get("burns", {})

        swap_count = swaps.get("count", 0)
        mint_count = mints.get("count", 0)
        burn_count = burns.get("count", 0)
        total_events += swap_count + mint_count + burn_count

        # Find overall block range across all event types
        all_mins = [v.get("min_block") for v in [swaps, mints, burns] if v.get("min_block")]
        all_maxs = [v.get("max_block") for v in [swaps, mints, burns] if v.get("max_block")]

        if all_mins and all_maxs:
            min_b = min(all_mins)
            max_b = max(all_maxs)
            event_range = f"{fmt_block(min_b)} → {fmt_block(max_b)}"
        else:
            event_range = "[dim]no events[/]"

        # Use sync_state for actual scan progress (accurate), fall back to max event block
        scanned_to = p.get("last_scanned_block")
        if scanned_to:
            scanned_str = fmt_block(scanned_to)
        elif all_maxs:
            scanned_str = f"[dim]~{fmt_block(max(all_maxs))}[/]"
        else:
            scanned_str = "[dim]never[/]"

        # Calculate behind based on scan progress, not event presence
        ref_block = scanned_to or (max(all_maxs) if all_maxs else None)
        if chain_head and ref_block:
            behind = chain_head - ref_block
            if behind <= 0:
                status_str = "[green]synced[/]"
            elif behind <= 100:
                status_str = f"[green]{fmt_count(behind)} behind[/]"
            elif behind <= 5000:
                status_str = f"[yellow]{fmt_count(behind)} behind[/]"
            else:
                status_str = f"[bold red]{fmt_count(behind)} behind[/]"
        else:
            status_str = "[dim]unknown[/]"

        table.add_row(
            abbrev,
            p.get("pair", "?/?"),
            p.get("fee", "?"),
            fmt_count(swap_count),
            fmt_count(mint_count),
            fmt_count(burn_count),
            event_range,
            scanned_str,
            status_str,
        )

    console.print(table)
    console.print(f"  [dim]Total events: {fmt_count(total_events)}[/]")


def render_hyperliquid(data: dict, console: Console) -> None:
    """Render Hyperliquid status as Rich tables."""
    addrs = data.get("known_addresses", {})
    pos = data.get("positions", {})

    # Summary row
    summary = Table(box=None, padding=(0, 1), show_edge=False, show_header=False)
    summary.add_column("key", style="bold cyan")
    summary.add_column("value")

    summary.add_row("Known Addresses", fmt_count(addrs.get("count", 0)))
    summary.add_row("Open Positions", fmt_count(pos.get("count", 0)))
    summary.add_row("Unique Traders", fmt_count(pos.get("unique_addresses", 0)))
    summary.add_row("Coins Tracked", str(pos.get("unique_coins", 0)))
    if addrs.get("last_active"):
        summary.add_row("Last Active", addrs["last_active"][:19])
    if pos.get("last_scan"):
        summary.add_row("Last Scan", pos["last_scan"][:19])

    console.print(summary)

    # Top coins table
    top_coins = data.get("top_coins", [])
    if top_coins:
        console.print()
        coin_table = Table(box=None, padding=(0, 1), show_edge=False, title="Top Coins by Positions")
        coin_table.add_column("Coin", style="bold")
        coin_table.add_column("Positions", justify="right")
        coin_table.add_column("Longs", style="green", justify="right")
        coin_table.add_column("Shorts", style="red", justify="right")

        for c in top_coins:
            coin_table.add_row(
                c["coin"],
                fmt_count(c["count"]),
                fmt_count(c["longs"]),
                fmt_count(c["shorts"]),
            )
        console.print(coin_table)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Show database status across all indexed protocols",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--protocol", "-p", help="Show only this protocol (e.g. uniswap_v3, hyperliquid)")
    parser.add_argument("--db", default=DB_URL, help="PostgreSQL connection URL")
    parser.add_argument("--rpc", default=RPC_URL, help="Erigon RPC URL")
    parser.add_argument("--json", action="store_true", dest="json_output", help="Output as JSON")
    args = parser.parse_args()

    console = Console()

    # Get chain head
    chain_head = get_chain_head(args.rpc)

    # Filter protocols
    if args.protocol:
        if args.protocol not in PROTOCOLS:
            console.print(f"[bold red]Unknown protocol:[/] {args.protocol}")
            console.print(f"Available: {', '.join(PROTOCOLS.keys())}")
            sys.exit(1)
        protocols_to_check = {args.protocol: PROTOCOLS[args.protocol]}
    else:
        protocols_to_check = PROTOCOLS

    all_data = {}

    with psycopg.connect(args.db) as conn:
        # Check which protocols actually have tables
        with conn.cursor() as cur:
            cur.execute("""
                SELECT schemaname, tablename
                FROM pg_tables
                WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
                ORDER BY schemaname, tablename
            """)
            existing_tables = {(r[0], r[1]) for r in cur.fetchall()}

        for proto_key, config in protocols_to_check.items():
            schema = config["schema"]

            # Check if protocol tables exist
            has_tables = False
            for table_name, _ in config["tables"]:
                if (schema, table_name) in existing_tables:
                    has_tables = True
                    break

            if not has_tables:
                continue

            if proto_key == "uniswap_v3":
                all_data[proto_key] = query_uniswap_v3(conn, config, args.rpc, console)
            elif proto_key == "hyperliquid":
                all_data[proto_key] = query_hyperliquid(conn, config)

    # Output
    if args.json_output:
        output = {"chain_head": chain_head, "protocols": all_data}
        print(json.dumps(output, indent=2, default=str))
        return

    # Rich output
    header = Text()
    header.append("Database Status", style="bold")
    if chain_head:
        header.append(f"  |  Chain head: {chain_head:,}", style="dim")

    console.print(Panel(header, style="blue"))

    if not all_data:
        console.print("[yellow]No protocol data found in database.[/]")
        return

    for proto_key, data in all_data.items():
        config = PROTOCOLS[proto_key]
        console.print(f"\n[bold blue]{'━' * 3} {config['display_name']} {'━' * 50}[/]")

        if proto_key == "uniswap_v3":
            render_uniswap_v3(data, chain_head, console)
        elif proto_key == "hyperliquid":
            render_hyperliquid(data, console)

    console.print()


if __name__ == "__main__":
    main()
