import asyncio
import json

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from urllib.request import Request, urlopen

router = APIRouter(tags=["mempool"])

RPC_URL = "http://127.0.0.1:8545"


def _rpc_call(method: str, params: list = None):
    """Synchronous JSON-RPC call."""
    payload = json.dumps({
        "jsonrpc": "2.0",
        "method": method,
        "params": params or [],
        "id": 1,
    }).encode()
    req = Request(RPC_URL, data=payload, headers={"Content-Type": "application/json"})
    with urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read())
    if "error" in data:
        return None
    return data.get("result")


def _rpc_batch(calls: list[tuple[str, list]]):
    """Batch JSON-RPC call. Each call is (method, params)."""
    payload = json.dumps([
        {"jsonrpc": "2.0", "method": m, "params": p, "id": i}
        for i, (m, p) in enumerate(calls)
    ]).encode()
    req = Request(RPC_URL, data=payload, headers={"Content-Type": "application/json"})
    with urlopen(req, timeout=15) as resp:
        results = json.loads(resp.read())
    return {r["id"]: r.get("result") for r in results}


def _hex_to_int(h):
    if h is None:
        return 0
    return int(h, 16) if isinstance(h, str) else h


def _wei_to_gwei(wei):
    return round(wei / 1e9, 2)


def _wei_to_eth(wei):
    return round(wei / 1e18, 6)


def _get_mempool_snapshot():
    """Fetch all mempool data in a single batch RPC call."""
    results = _rpc_batch([
        ("eth_gasPrice", []),                                    # 0
        ("eth_maxPriorityFeePerGas", []),                        # 1
        ("eth_feeHistory", ["0x14", "latest", [10, 25, 50, 75, 90]]),  # 2 — last 20 blocks
        ("eth_getBlockByNumber", ["pending", True]),             # 3
        ("eth_getBlockByNumber", ["latest", True]),              # 4 — full txs for type analysis
        ("eth_blockNumber", []),                                 # 5
        ("txpool_status", []),                                   # 6
        ("txpool_content", []),                                  # 7
        ("eth_syncing", []),                                     # 8
    ])

    # Gas prices
    gas_price = _hex_to_int(results.get(0))
    priority_fee = _hex_to_int(results.get(1))

    # Fee history
    fee_history_raw = results.get(2) or {}
    base_fees = [_hex_to_int(f) for f in fee_history_raw.get("baseFeePerGas", [])]
    gas_ratios = fee_history_raw.get("gasUsedRatio", [])
    rewards = fee_history_raw.get("reward", [])
    oldest_block = _hex_to_int(fee_history_raw.get("oldestBlock", "0x0"))

    fee_history = []
    for i, base in enumerate(base_fees[:-1]):  # last entry is next block's base fee
        block_rewards = rewards[i] if i < len(rewards) else []
        ratio = gas_ratios[i] if i < len(gas_ratios) else 0
        # Estimate gas_used from ratio * 30M gas limit (approximate)
        est_gas_used = int(ratio * 30_000_000)
        burn_eth = _wei_to_eth(base * est_gas_used)
        fee_history.append({
            "block": oldest_block + i,
            "base_fee_gwei": _wei_to_gwei(base),
            "gas_used_ratio": round(ratio, 3),
            "burn_eth": burn_eth,
            "priority_p10_gwei": _wei_to_gwei(_hex_to_int(block_rewards[0])) if len(block_rewards) > 0 else 0,
            "priority_p25_gwei": _wei_to_gwei(_hex_to_int(block_rewards[1])) if len(block_rewards) > 1 else 0,
            "priority_p50_gwei": _wei_to_gwei(_hex_to_int(block_rewards[2])) if len(block_rewards) > 2 else 0,
            "priority_p75_gwei": _wei_to_gwei(_hex_to_int(block_rewards[3])) if len(block_rewards) > 3 else 0,
            "priority_p90_gwei": _wei_to_gwei(_hex_to_int(block_rewards[4])) if len(block_rewards) > 4 else 0,
        })

    # Next block base fee
    next_base_fee = base_fees[-1] if base_fees else 0

    # Pending block
    pending_block = results.get(3) or {}
    pending_txs = pending_block.get("transactions", [])
    latest_block = results.get(4) or {}
    block_number = _hex_to_int(results.get(5))

    # Analyze pending transactions
    tx_list = []
    total_value_wei = 0
    total_gas = 0
    contract_creates = 0
    high_value = []

    for tx in pending_txs:
        value = _hex_to_int(tx.get("value", "0x0"))
        gas = _hex_to_int(tx.get("gas", "0x0"))
        gas_price_tx = _hex_to_int(tx.get("gasPrice") or tx.get("maxFeePerGas") or "0x0")
        priority = _hex_to_int(tx.get("maxPriorityFeePerGas") or "0x0")
        to_addr = tx.get("to")
        from_addr = tx.get("from", "")
        tx_hash = tx.get("hash", "")
        input_data = tx.get("input", "0x")

        total_value_wei += value
        total_gas += gas

        if to_addr is None:
            contract_creates += 1

        entry = {
            "hash": tx_hash,
            "from": from_addr,
            "to": to_addr,
            "value_eth": _wei_to_eth(value),
            "gas": gas,
            "gas_price_gwei": _wei_to_gwei(gas_price_tx),
            "priority_gwei": _wei_to_gwei(priority),
            "is_contract_create": to_addr is None,
            "method_id": input_data[:10] if len(input_data) >= 10 else "0x",
        }

        if value > 1e18:  # > 1 ETH
            high_value.append(entry)

        tx_list.append(entry)

    # Sort high-value by ETH desc
    high_value.sort(key=lambda t: t["value_eth"], reverse=True)

    # Sort all by gas price desc for top gas bidders
    top_gas_bidders = sorted(tx_list, key=lambda t: t["gas_price_gwei"], reverse=True)[:10]

    # Latest block info
    latest_gas_used = _hex_to_int(latest_block.get("gasUsed", "0x0"))
    latest_gas_limit = _hex_to_int(latest_block.get("gasLimit", "0x0"))
    latest_base_fee = _hex_to_int(latest_block.get("baseFeePerGas", "0x0"))
    latest_txs = latest_block.get("transactions", [])
    latest_tx_count = len(latest_txs)
    latest_timestamp = _hex_to_int(latest_block.get("timestamp", "0x0"))

    # ETH burned in latest block (base_fee * gas_used)
    eth_burned = _wei_to_eth(latest_base_fee * latest_gas_used)

    # Tx type breakdown from latest block
    type_counts = {"legacy": 0, "eip2930": 0, "eip1559": 0, "blob": 0}
    for tx in latest_txs:
        tx_type = _hex_to_int(tx.get("type", "0x0")) if isinstance(tx, dict) else 0
        if tx_type == 0:
            type_counts["legacy"] += 1
        elif tx_type == 1:
            type_counts["eip2930"] += 1
        elif tx_type == 2:
            type_counts["eip1559"] += 1
        elif tx_type == 3:
            type_counts["blob"] += 1

    # Sync status
    sync_result = results.get(8)
    is_syncing = sync_result is not None and sync_result is not False
    sync_info = None
    if is_syncing and isinstance(sync_result, dict):
        sync_info = {
            "current_block": _hex_to_int(sync_result.get("currentBlock", "0x0")),
            "highest_block": _hex_to_int(sync_result.get("highestBlock", "0x0")),
        }

    # ---- txpool data (only available if Erigon started with txpool API) ----
    txpool = None
    txpool_status_raw = results.get(6)
    txpool_content_raw = results.get(7)

    if txpool_status_raw is not None:
        pool_pending = _hex_to_int(txpool_status_raw.get("pending", "0x0"))
        pool_queued = _hex_to_int(txpool_status_raw.get("queued", "0x0"))
        pool_base_fee = _hex_to_int(txpool_status_raw.get("baseFee", "0x0"))

        # Analyze txpool_content for per-account details
        top_senders = []
        nonce_gaps = []
        stuck_txs = 0

        if txpool_content_raw:
            pending_pool = txpool_content_raw.get("pending", {})
            queued_pool = txpool_content_raw.get("queued", {})

            # Per-account pending tx counts (top senders by volume)
            sender_counts = {}
            for addr, nonce_map in pending_pool.items():
                sender_counts[addr] = len(nonce_map)
            top_senders = sorted(
                [{"address": a, "pending_count": c} for a, c in sender_counts.items()],
                key=lambda x: x["pending_count"],
                reverse=True,
            )[:15]

            # Find nonce gaps (accounts with queued but indicating gaps)
            for addr, nonce_map in queued_pool.items():
                nonces = sorted(int(n) for n in nonce_map.keys())
                pending_nonces = sorted(int(n) for n in pending_pool.get(addr, {}).keys())
                max_pending = max(pending_nonces) if pending_nonces else -1
                gaps = []
                for nonce in nonces:
                    if nonce > max_pending + 1:
                        gaps.append(nonce)
                if gaps:
                    nonce_gaps.append({
                        "address": addr,
                        "queued_count": len(nonce_map),
                        "gap_nonces": gaps[:5],
                    })
                stuck_txs += len(nonce_map)

            nonce_gaps.sort(key=lambda x: x["queued_count"], reverse=True)
            nonce_gaps = nonce_gaps[:15]

        txpool = {
            "pending_count": pool_pending,
            "queued_count": pool_queued,
            "base_fee_count": pool_base_fee,
            "total": pool_pending + pool_queued,
            "stuck_txs": stuck_txs,
            "top_senders": top_senders,
            "nonce_gaps": nonce_gaps,
        }

    # Total burn from fee history (last 20 blocks)
    total_burn_20 = sum(b["burn_eth"] for b in fee_history)

    return {
        "block_number": block_number,
        "block_timestamp": latest_timestamp,
        "syncing": is_syncing,
        "sync_info": sync_info,
        "gas": {
            "price_gwei": _wei_to_gwei(gas_price),
            "priority_fee_gwei": _wei_to_gwei(priority_fee),
            "base_fee_gwei": _wei_to_gwei(latest_base_fee),
            "next_base_fee_gwei": _wei_to_gwei(next_base_fee),
        },
        "pending": {
            "tx_count": len(pending_txs),
            "total_value_eth": _wei_to_eth(total_value_wei),
            "total_gas": total_gas,
            "contract_creates": contract_creates,
        },
        "latest_block": {
            "number": block_number,
            "tx_count": latest_tx_count,
            "gas_used": latest_gas_used,
            "gas_limit": latest_gas_limit,
            "utilization": round(latest_gas_used / latest_gas_limit * 100, 1) if latest_gas_limit > 0 else 0,
            "eth_burned": eth_burned,
            "tx_types": type_counts,
            "timestamp": latest_timestamp,
        },
        "burn": {
            "latest_block_eth": eth_burned,
            "last_20_blocks_eth": round(total_burn_20, 6),
        },
        "high_value_txs": high_value[:20],
        "top_gas_bidders": top_gas_bidders,
        "fee_history": fee_history,
        "txpool": txpool,
    }


@router.get("/mempool/snapshot")
async def mempool_snapshot():
    """Full mempool snapshot: gas, pending txs, fee history."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _get_mempool_snapshot)


@router.get("/mempool/stream")
async def mempool_stream():
    """SSE: live mempool updates every 3 seconds."""
    async def event_generator():
        while True:
            try:
                loop = asyncio.get_event_loop()
                data = await loop.run_in_executor(None, _get_mempool_snapshot)
                yield f"data: {json.dumps(data)}\n\n"
            except Exception:
                yield f"data: {json.dumps({'error': 'RPC unavailable'})}\n\n"
            await asyncio.sleep(3)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
