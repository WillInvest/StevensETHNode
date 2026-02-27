"""Mempool Capture

WebSocket listener that captures pending transactions from the Erigon
node's mempool. Appends to partitioned Parquet files by date.

Note: eth_pendingTransactions is NOT available on our Erigon node.
Instead we use txpool_content and newPendingTransactions subscription.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

OUTPUT_DIR = Path("data/mempool")
RPC_WS_URL = os.environ.get("ETH_WS_URL", "ws://127.0.0.1:8546")


async def capture_pending_transactions(
    ws_url: str = RPC_WS_URL,
    output_dir: Path = OUTPUT_DIR,
    batch_size: int = 100,
    flush_interval: int = 60,
):
    """Subscribe to newPendingTransactions and capture to Parquet.

    Each batch is flushed to a Parquet file partitioned by date.
    """
    try:
        import websockets
        import pandas as pd
    except ImportError:
        logger.error("websockets and pandas required for mempool capture")
        return

    output_dir.mkdir(parents=True, exist_ok=True)

    async with websockets.connect(ws_url) as ws:
        # Subscribe to pending transactions
        sub_msg = json.dumps({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "eth_subscribe",
            "params": ["newPendingTransactions"],
        })
        await ws.send(sub_msg)
        response = await ws.recv()
        sub_result = json.loads(response)
        logger.info("Subscribed to pending txs: %s", sub_result)

        batch = []
        last_flush = time.time()

        async for message in ws:
            data = json.loads(message)
            params = data.get("params", {})
            tx_hash = params.get("result")

            if tx_hash:
                batch.append({
                    "tx_hash": tx_hash,
                    "seen_at": int(time.time()),
                    "seen_at_ms": int(time.time() * 1000),
                })

            should_flush = (
                len(batch) >= batch_size
                or (time.time() - last_flush) >= flush_interval
            )

            if should_flush and batch:
                df = pd.DataFrame(batch)
                date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
                out_path = output_dir / f"pending_txs_{date_str}.parquet"

                if out_path.exists():
                    existing = pd.read_parquet(out_path)
                    df = pd.concat([existing, df], ignore_index=True)

                df.to_parquet(out_path, index=False)
                logger.info("Flushed %d pending tx hashes to %s", len(batch), out_path)
                batch.clear()
                last_flush = time.time()


async def snapshot_txpool(
    rpc_url: str = "http://127.0.0.1:8545",
) -> dict:
    """Take a snapshot of the current txpool via txpool_content RPC."""
    import urllib.request

    payload = json.dumps({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "txpool_content",
        "params": [],
    }).encode()

    req = urllib.request.Request(
        rpc_url,
        data=payload,
        headers={"Content-Type": "application/json"},
    )

    with urllib.request.urlopen(req, timeout=30) as resp:
        result = json.loads(resp.read())

    pool = result.get("result", {})
    pending = pool.get("pending", {})
    queued = pool.get("queued", {})

    pending_count = sum(len(txs) for txs in pending.values())
    queued_count = sum(len(txs) for txs in queued.values())

    return {
        "pending_count": pending_count,
        "queued_count": queued_count,
        "unique_senders_pending": len(pending),
        "unique_senders_queued": len(queued),
        "timestamp": int(time.time()),
    }


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(capture_pending_transactions())
