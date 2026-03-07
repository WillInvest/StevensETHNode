"""
F = ∫ P(x) · I_cascade(x) dx — The Crypto Fear Index

Computes the probability-weighted expected liquidation cascade damage.
Unlike traditional VIX (expected magnitude of movement), this measures
expected systemic cascade damage — the risk-neutral anticipation of
how much damage a price move would cause.
"""

import numpy as np
import pandas as pd
from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime

from .probability import DistributionResult
from .cascade import (
    CascadeResult,
    run_stress_test_grid,
    simulate_cascade,
    StaticLiquidationMap,
)


@dataclass
class FearIndexResult:
    """Complete fear index computation result."""
    value: float  # 0-100 normalized score
    raw_value: float  # unnormalized integral (USD)
    components: dict  # per-protocol contributions
    implied_vol: float
    max_cascade_depth: float
    distribution_skew: float
    timestamp: Optional[datetime] = None
    block_number: Optional[int] = None

    def to_api_dict(self) -> dict:
        return {
            "value": round(self.value, 2),
            "raw_value": round(self.raw_value, 2),
            "components": {k: round(v, 2) for k, v in self.components.items()},
            "implied_vol": round(self.implied_vol, 4),
            "max_cascade_depth": round(self.max_cascade_depth, 2),
            "distribution_skew": round(self.distribution_skew, 4),
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "block_number": self.block_number,
        }


# Historical normalization percentiles (calibrated from backtesting)
# These define the 0-100 scaling. Values below p5 → 0, above p95 → 100.
DEFAULT_NORMALIZATION = {
    "p5": 1_000_000,      # $1M raw integral → very low fear
    "p50": 50_000_000,    # $50M raw integral → moderate
    "p95": 500_000_000,   # $500M raw integral → extreme fear
}


def compute_fear_index(
    implied_distribution: DistributionResult,
    liquidation_map: StaticLiquidationMap,
    tick_liquidity: Optional[pd.DataFrame] = None,
    implied_vol: float = 0.0,
    normalization: Optional[dict] = None,
    use_cascade: bool = True,
    dex_fraction: float = 0.3,
) -> FearIndexResult:
    """
    Compute the Crypto Fear Index.

    F_raw = Σ_k P(price reaches x_k) × TotalCascadeVolume(x_k) × Δx

    Only integrates over DOWNSIDE (x < current_price).

    Parameters:
    - implied_distribution: P(x) from Uniswap V3 LP positioning
    - liquidation_map: I(x) static liquidation map
    - tick_liquidity: For cascade simulation (optional)
    - implied_vol: Lambert formula IV (passed through to result)
    - normalization: Percentile bounds for 0-100 scaling
    - use_cascade: If True, use cascade-amplified I(x); else static
    - dex_fraction: Fraction of liquidation volume hitting DEXes

    Returns:
    - FearIndexResult
    """
    norm = normalization or DEFAULT_NORMALIZATION
    current_price = implied_distribution.current_price
    pdf = implied_distribution.pdf

    if pdf.empty or not liquidation_map.levels:
        return FearIndexResult(
            value=50.0,
            raw_value=0.0,
            components={"aave": 0, "maker": 0, "hyperliquid": 0, "lp_width": 0, "gas": 0, "bridge": 0},
            implied_vol=implied_vol,
            max_cascade_depth=0.0,
            distribution_skew=implied_distribution.skewness,
            timestamp=datetime.utcnow(),
        )

    # Only consider downside prices
    downside_pdf = pdf[pdf["price"] < current_price].copy()
    if downside_pdf.empty:
        return FearIndexResult(
            value=0.0,
            raw_value=0.0,
            components={"aave": 0, "maker": 0, "hyperliquid": 0, "lp_width": 0, "gas": 0, "bridge": 0},
            implied_vol=implied_vol,
            max_cascade_depth=0.0,
            distribution_skew=implied_distribution.skewness,
            timestamp=datetime.utcnow(),
        )

    # Numerical integration: F = Σ P(x_k) × I(x_k) × Δx
    raw_integral = 0.0
    component_integrals = {"aave": 0.0, "maker": 0.0, "hyperliquid": 0.0}
    max_cascade_depth = 0.0

    prices = downside_pdf["price"].values
    densities = downside_pdf["probability_density"].values

    for i in range(len(prices)):
        price = prices[i]
        prob_density = densities[i]

        # Compute Δx (bin width)
        if i < len(prices) - 1:
            dx = abs(prices[i + 1] - prices[i])
        else:
            dx = abs(prices[i] - prices[i - 1]) if i > 0 else 1.0

        probability = prob_density * dx

        if use_cascade and tick_liquidity is not None:
            # Use cascade simulation for this price level
            shock_pct = (current_price - price) / current_price * 100
            if shock_pct > 0.5:  # only simulate meaningful shocks
                result = simulate_cascade(
                    initial_shock_pct=shock_pct,
                    current_price=current_price,
                    tick_liquidity=tick_liquidity,
                    liquidation_map=liquidation_map,
                    dex_fraction=dex_fraction,
                    max_iterations=10,  # limit for performance
                )
                impact = result.total_liquidation_volume_usd
                max_cascade_depth = max(max_cascade_depth, result.total_cascade_depth_pct)

                # Per-protocol breakdown
                for r in result.liquidation_timeline:
                    for proto, val in r.protocol_breakdown.items():
                        if proto in component_integrals:
                            component_integrals[proto] += probability * val
            else:
                impact = 0.0
        else:
            # Use static liquidation map
            impact = liquidation_map.cumulative_at_price(price)

        raw_integral += probability * impact

    # Normalize to 0-100
    p5 = norm["p5"]
    p95 = norm["p95"]

    if raw_integral <= p5:
        normalized = (raw_integral / p5) * 20  # 0-20 range
    elif raw_integral >= p95:
        normalized = 80 + ((raw_integral - p95) / p95) * 20  # 80-100 range
        normalized = min(normalized, 100)
    else:
        # Linear interpolation between p5 and p95 → 20-80
        normalized = 20 + (raw_integral - p5) / (p95 - p5) * 60

    # Add LP width contribution to components
    lp_width_score = min(100, implied_distribution.std / current_price * 1000)
    component_integrals["lp_width"] = lp_width_score
    component_integrals["gas"] = 0.0  # filled by supplementary indicators
    component_integrals["bridge"] = 0.0  # filled by supplementary indicators

    return FearIndexResult(
        value=round(normalized, 2),
        raw_value=round(raw_integral, 2),
        components=component_integrals,
        implied_vol=implied_vol,
        max_cascade_depth=max_cascade_depth,
        distribution_skew=implied_distribution.skewness,
        timestamp=datetime.utcnow(),
    )


def compute_fear_index_timeseries(
    start_block: int,
    end_block: int,
    interval_blocks: int = 7200,  # ~1 day
    db_url: str = "postgresql://ethnode:changeme@localhost:5432/ethnode",
    rpc_url: str = "http://127.0.0.1:8545",
) -> pd.DataFrame:
    """
    Compute historical fear index by reconstructing on-chain state at each block.

    This is the KEY ADVANTAGE of having an archive node:
    - At each historical block, we can reconstruct:
      a. Uniswap tick liquidity (from events up to that block)
      b. Aave positions (from events up to that block)
      c. Maker vaults (from events up to that block)
    - Then compute P(x), I(x), and F at that block

    Returns DataFrame with columns:
    [block_number, timestamp, fear_value, raw_value, implied_vol, ...]
    """
    # This is a placeholder for the full historical computation
    # which requires archive node state reconstruction at each block.
    # In production, this would use eth_call with block parameter
    # to query historical contract state.

    blocks = list(range(start_block, end_block, interval_blocks))
    records = []

    for block in blocks:
        records.append({
            "block_number": block,
            "timestamp": None,  # Would be filled from block headers
            "fear_value": None,
            "raw_value": None,
            "implied_vol": None,
            "max_cascade_depth": None,
            "distribution_skew": None,
        })

    return pd.DataFrame(records)
