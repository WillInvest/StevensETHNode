#!/usr/bin/env python3
"""Historical SCI backfill — compute SCI at hourly intervals."""

import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from web.db import get_pool, get_conn, close_pool
from web.sci import compute_sci_for_block

# Hourly = ~300 blocks
INTERVAL = 300


async def main():
    await get_pool()

    async with get_conn() as conn:
        # Ensure table exists
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS sci_snapshots (
                id SERIAL PRIMARY KEY,
                block_num BIGINT NOT NULL,
                block_timestamp TIMESTAMPTZ,
                dex_score NUMERIC(6,2),
                lending_score NUMERIC(6,2),
                liquidation_score NUMERIC(6,2),
                gas_score NUMERIC(6,2),
                network_score NUMERIC(6,2),
                bridge_score NUMERIC(6,2),
                sci_score NUMERIC(6,2) NOT NULL,
                raw_metrics JSONB,
                created_at TIMESTAMPTZ DEFAULT now()
            )
        """)

        # Get block range
        cur = await conn.execute("SELECT MIN(block_num), MAX(block_num) FROM uniswap_v3_swaps")
        row = await cur.fetchone()
        if not row or not row[0]:
            print("No swap data found")
            return
        start_block, end_block = int(row[0]), int(row[1])

        # Check last computed block
        cur = await conn.execute("SELECT MAX(block_num) FROM sci_snapshots")
        row = await cur.fetchone()
        last_computed = int(row[0]) if row and row[0] else start_block

        block = max(last_computed + INTERVAL, start_block + INTERVAL)
        total = (end_block - block) // INTERVAL
        count = 0

        print(f"Computing SCI from block {block} to {end_block} ({total} snapshots)")

        while block <= end_block:
            result = await compute_sci_for_block(block)
            if result:
                await conn.execute(
                    """INSERT INTO sci_snapshots
                       (block_num, dex_score, lending_score, liquidation_score,
                        gas_score, network_score, bridge_score, sci_score, raw_metrics)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                    (
                        result["block_num"],
                        result["dex_score"],
                        result["lending_score"],
                        result["liquidation_score"],
                        result["gas_score"],
                        result["network_score"],
                        result["bridge_score"],
                        result["sci_score"],
                        json.dumps(result["raw_metrics"]),
                    ),
                )
                count += 1
                if count % 10 == 0:
                    print(f"  [{count}/{total}] Block {block}: SCI = {result['sci_score']}")

            block += INTERVAL

        print(f"Done. Computed {count} SCI snapshots.")

    await close_pool()


if __name__ == "__main__":
    asyncio.run(main())
