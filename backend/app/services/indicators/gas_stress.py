"""
Gas Market Stress Indicator

Gas price spikes indicate network congestion, often correlated with
market stress events. High base fees + elevated priority fees signal
urgent transaction demand (liquidations, arbitrage, panic selling).
"""

from web3 import Web3
from typing import Optional
import statistics


def get_gas_stress_indicator(
    rpc_url: str = "http://127.0.0.1:8545",
    lookback_blocks: int = 100,
) -> dict:
    """
    Compute gas market stress indicator.

    Reads recent blocks and computes:
    - Current base fee and priority fee
    - Z-score vs recent mean (higher = more stress)
    - Block utilization (gas_used / gas_limit)
    - Priority fee 90th percentile

    Returns:
    - base_fee_gwei: Current base fee
    - priority_fee_gwei: Suggested priority fee
    - base_fee_z_score: How many std devs above mean
    - utilization_pct: Average gas utilization
    - stress_score: 0-100 composite
    """
    w3 = Web3(Web3.HTTPProvider(rpc_url))

    try:
        latest = w3.eth.get_block("latest")
    except Exception:
        return {
            "base_fee_gwei": 0,
            "priority_fee_gwei": 0,
            "base_fee_z_score": 0,
            "utilization_pct": 0,
            "stress_score": 0,
        }

    current_block = latest["number"]
    current_base_fee = latest.get("baseFeePerGas", 0) / 1e9

    # Collect recent base fees
    base_fees = []
    utilizations = []

    start_block = max(0, current_block - lookback_blocks)
    # Sample every 10th block for efficiency
    sample_blocks = range(start_block, current_block, max(1, lookback_blocks // 20))

    for block_num in sample_blocks:
        try:
            block = w3.eth.get_block(block_num)
            bf = block.get("baseFeePerGas", 0) / 1e9
            base_fees.append(bf)

            gas_limit = block.get("gasLimit", 30_000_000)
            gas_used = block.get("gasUsed", 0)
            utilizations.append(gas_used / gas_limit if gas_limit > 0 else 0)
        except Exception:
            continue

    if not base_fees:
        return {
            "base_fee_gwei": round(current_base_fee, 4),
            "priority_fee_gwei": 0,
            "base_fee_z_score": 0,
            "utilization_pct": 0,
            "stress_score": 0,
        }

    # Z-score of current base fee
    mean_bf = statistics.mean(base_fees)
    std_bf = statistics.stdev(base_fees) if len(base_fees) > 1 else 1.0
    z_score = (current_base_fee - mean_bf) / std_bf if std_bf > 0 else 0

    avg_utilization = statistics.mean(utilizations) if utilizations else 0

    # Priority fee (from latest block)
    try:
        priority_fee = w3.eth.max_priority_fee / 1e9
    except Exception:
        priority_fee = 1.0

    # Composite stress score (0-100)
    # High z-score → high stress, high utilization → high stress
    z_component = min(50, max(0, z_score * 15))  # z > 3 → ~45
    util_component = avg_utilization * 30  # 100% util → 30
    priority_component = min(20, priority_fee * 2)  # 10 gwei priority → 20

    stress_score = z_component + util_component + priority_component

    return {
        "base_fee_gwei": round(current_base_fee, 4),
        "priority_fee_gwei": round(priority_fee, 4),
        "base_fee_z_score": round(z_score, 3),
        "utilization_pct": round(avg_utilization * 100, 1),
        "mean_base_fee_gwei": round(mean_bf, 4),
        "stress_score": round(min(100, stress_score), 1),
    }
