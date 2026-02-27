#!/usr/bin/env python3
"""Backfill block_timestamp for uniswap_v3.swap_events from Erigon RPC."""
import json
import os
import sys
import time
from datetime import datetime, timezone
from urllib.request import Request, urlopen

import psycopg2
from psycopg2.extras import execute_values

DB_URL = os.environ.get("ETHNODE_DATABASE_URL", "dbname=ethnode user=ethnode")
RPC_URL = os.environ.get("ERIGON_RPC_URL", "http://127.0.0.1:8545")
BATCH_SIZE = 100  # blocks per RPC batch call


def rpc_batch(block_numbers: list[int]) -> dict[int, datetime]:
    """Fetch timestamps for a batch of blocks via JSON-RPC batch call."""
    payload = json.dumps([
        {
            "jsonrpc": "2.0",
            "method": "eth_getBlockByNumber",
            "params": [hex(b), False],
            "id": i,
        }
        for i, b in enumerate(block_numbers)
    ]).encode()

    req = Request(RPC_URL, data=payload, headers={"Content-Type": "application/json"})
    with urlopen(req, timeout=60) as resp:
        results = json.loads(resp.read())

    timestamps = {}
    for r in results:
        if r.get("result") and r["result"].get("number"):
            block_num = int(r["result"]["number"], 16)
            ts = int(r["result"]["timestamp"], 16)
            timestamps[block_num] = datetime.fromtimestamp(ts, tz=timezone.utc)
    return timestamps


def main():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    # Get all distinct blocks missing timestamps
    cur.execute("""
        SELECT DISTINCT block FROM uniswap_v3.swap_events
        WHERE block_timestamp IS NULL
        ORDER BY block
    """)
    blocks = [row[0] for row in cur.fetchall()]

    if not blocks:
        print("All block_timestamps already populated.")
        return

    total = len(blocks)
    print(f"Backfilling timestamps for {total} blocks...")
    updated_rows = 0
    start = time.time()

    for i in range(0, total, BATCH_SIZE):
        batch = blocks[i : i + BATCH_SIZE]
        try:
            timestamps = rpc_batch(batch)
        except Exception as e:
            print(f"\nRPC error at batch starting block {batch[0]}: {e}", file=sys.stderr)
            continue

        if not timestamps:
            print(f"\nWarning: empty response for batch starting at block {batch[0]}")
            continue

        # Batch update using a temp approach
        for block_num, ts in timestamps.items():
            cur.execute(
                "UPDATE uniswap_v3.swap_events SET block_timestamp = %s WHERE block = %s AND block_timestamp IS NULL",
                (ts, block_num),
            )
            updated_rows += cur.rowcount

        conn.commit()

        done = min(i + BATCH_SIZE, total)
        elapsed = time.time() - start
        rate = done / elapsed if elapsed > 0 else 0
        eta = (total - done) / rate if rate > 0 else 0
        pct = done * 100 // total
        sys.stdout.write(f"\r  {done}/{total} blocks ({pct}%) — {updated_rows} rows updated — {rate:.0f} blk/s — ETA {eta:.0f}s  ")
        sys.stdout.flush()

    conn.commit()
    cur.close()
    conn.close()
    elapsed = time.time() - start
    print(f"\nDone. {updated_rows} rows updated across {total} blocks in {elapsed:.1f}s.")


if __name__ == "__main__":
    main()
