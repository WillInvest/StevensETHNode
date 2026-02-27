"""
I_cascade(x) — Dynamic Cascade Simulator

Models the feedback loop where liquidations push the price down further,
triggering more liquidations. This is the key innovation over a simple
static liquidation map.

Algorithm:
1. Apply initial shock: price_1 = current_price * (1 - shock_pct)
2. Compute liquidations triggered at price_1
3. Estimate sell-side impact of those liquidations on AMM liquidity
4. New price: price_2 = price_1 - amm_impact
5. Additional liquidations at price_2
6. Repeat until convergence (liquidation volume < threshold)
"""

import numpy as np
import pandas as pd
from dataclasses import dataclass, field
from typing import Optional

from .impact import StaticLiquidationMap


@dataclass
class CascadeRound:
    """One round of the cascade simulation."""
    round_num: int
    price_before: float
    price_after: float
    liquidation_volume_usd: float
    price_impact_pct: float
    protocol_breakdown: dict = field(default_factory=dict)


@dataclass
class CascadeResult:
    """Full result of a cascade simulation."""
    initial_shock_pct: float
    initial_price: float
    final_price: float
    total_cascade_depth_pct: float
    cascade_rounds: int
    total_liquidation_volume_usd: float
    amplification_factor: float  # total_depth / initial_shock
    liquidation_timeline: list[CascadeRound]
    converged: bool

    def to_api_dict(self) -> dict:
        """Convert to JSON-serializable dict for API responses."""
        return {
            "initial_shock_pct": self.initial_shock_pct,
            "initial_price": self.initial_price,
            "final_price": round(self.final_price, 2),
            "total_cascade_depth_pct": round(self.total_cascade_depth_pct, 2),
            "cascade_rounds": self.cascade_rounds,
            "total_liquidation_volume_usd": round(self.total_liquidation_volume_usd, 2),
            "amplification_factor": round(self.amplification_factor, 3),
            "converged": self.converged,
            "liquidation_timeline": [
                {
                    "round": r.round_num,
                    "price": round(r.price_after, 2),
                    "volume": round(r.liquidation_volume_usd, 2),
                    "impact_pct": round(r.price_impact_pct, 4),
                    "protocol_breakdown": {
                        k: round(v, 2) for k, v in r.protocol_breakdown.items()
                    },
                }
                for r in self.liquidation_timeline
            ],
        }


def compute_amm_market_impact(
    sell_volume_usd: float,
    tick_liquidity: Optional[pd.DataFrame],
    current_price: float,
) -> tuple[float, float]:
    """
    Given a forced sell of $sell_volume_usd worth of ETH,
    compute how far the price drops by walking down the Uniswap V3 tick ladder.

    This is DETERMINISTIC from current liquidity state:
    - Start at current price
    - At each tick, the pool can absorb: absorbable = liquidity * price_range
    - If sell_volume > absorbable, consume this tick and move to next
    - Continue until sell_volume is exhausted

    Parameters:
    - sell_volume_usd: Total USD value of forced selling
    - tick_liquidity: DataFrame with [tick, price, liquidity]
    - current_price: Current ETH price

    Returns:
    - (new_price, price_impact_pct)
    """
    if sell_volume_usd <= 0:
        return current_price, 0.0

    if tick_liquidity is None or tick_liquidity.empty:
        # Fallback: constant-product AMM approximation
        # Assume $500M effective liquidity (typical for ETH/USDC on Uniswap V3)
        effective_liquidity = 500_000_000
        # Price impact ≈ sell_volume / (2 * liquidity) for CPMM
        impact_pct = sell_volume_usd / (2 * effective_liquidity)
        new_price = current_price * (1 - impact_pct)
        return max(new_price, 0.01), min(impact_pct, 0.99)

    # Walk down the tick ladder
    df = tick_liquidity[tick_liquidity["price"] <= current_price].copy()
    df = df.sort_values("price", ascending=False).reset_index(drop=True)

    remaining_sell = sell_volume_usd
    new_price = current_price

    for i in range(len(df) - 1):
        price_high = df.loc[i, "price"]
        price_low = df.loc[i + 1, "price"]
        liquidity = float(df.loc[i, "liquidity"])

        if liquidity <= 0:
            continue

        # How much USD this tick range can absorb
        price_range = price_high - price_low
        # Simplified: absorbable ≈ liquidity * sqrt(price_range / price_high) * price_high
        # For small ranges this is approximately: liquidity * price_range
        absorbable = liquidity * price_range / 1e18  # normalize liquidity units

        if absorbable <= 0:
            continue

        if remaining_sell <= absorbable:
            # Partial consumption of this tick
            fraction = remaining_sell / absorbable
            new_price = price_high - fraction * price_range
            remaining_sell = 0
            break
        else:
            remaining_sell -= absorbable
            new_price = price_low

    if remaining_sell > 0:
        # All ticks consumed — extreme scenario
        # Apply remaining as constant-product impact on last price
        fallback_impact = remaining_sell / (2 * 100_000_000)  # assume $100M remaining
        new_price = new_price * (1 - min(fallback_impact, 0.5))

    price_impact_pct = (current_price - new_price) / current_price
    return max(new_price, 0.01), min(price_impact_pct, 0.99)


def simulate_cascade(
    initial_shock_pct: float,
    current_price: float,
    tick_liquidity: Optional[pd.DataFrame],
    liquidation_map: StaticLiquidationMap,
    dex_fraction: float = 0.3,
    max_iterations: int = 50,
    convergence_threshold_usd: float = 100_000,
) -> CascadeResult:
    """
    Full cascade simulation with feedback loop.

    Parameters:
    - initial_shock_pct: Initial price drop percentage (e.g., 10 for 10%)
    - current_price: Current ETH price
    - tick_liquidity: Uniswap V3 tick liquidity DataFrame
    - liquidation_map: Pre-computed static liquidation map
    - dex_fraction: Fraction of liquidation volume hitting DEXes (rest goes to CEX)
    - max_iterations: Maximum cascade rounds
    - convergence_threshold_usd: Stop if new liquidations below this

    Returns:
    - CascadeResult with full cascade details
    """
    timeline = []
    total_liquidation_volume = 0.0
    price = current_price * (1 - initial_shock_pct / 100)
    prev_price = current_price

    for round_num in range(1, max_iterations + 1):
        # Compute liquidations triggered between prev_price and price
        liq_volume = 0.0
        protocol_breakdown = {"aave": 0.0, "maker": 0.0, "hyperliquid": 0.0}

        for lvl in liquidation_map.levels:
            if lvl.price_level < price or lvl.price_level >= prev_price:
                continue
            liq_volume += lvl.total_liquidation_usd
            protocol_breakdown["aave"] += lvl.aave_liquidation_usd
            protocol_breakdown["maker"] += lvl.maker_liquidation_usd
            protocol_breakdown["hyperliquid"] += lvl.hyperliquid_liquidation_usd

        if liq_volume < convergence_threshold_usd:
            # Cascade converged
            timeline.append(CascadeRound(
                round_num=round_num,
                price_before=prev_price,
                price_after=price,
                liquidation_volume_usd=liq_volume,
                price_impact_pct=0.0,
                protocol_breakdown=protocol_breakdown,
            ))
            total_liquidation_volume += liq_volume
            break

        # Compute AMM price impact from liquidation sell pressure
        dex_sell_volume = liq_volume * dex_fraction
        new_price, impact_pct = compute_amm_market_impact(
            dex_sell_volume, tick_liquidity, price
        )

        timeline.append(CascadeRound(
            round_num=round_num,
            price_before=prev_price if round_num == 1 else price,
            price_after=new_price,
            liquidation_volume_usd=liq_volume,
            price_impact_pct=impact_pct,
            protocol_breakdown=protocol_breakdown,
        ))

        total_liquidation_volume += liq_volume
        prev_price = price
        price = new_price

        # Safety: stop if price drops below 1% of original
        if price < current_price * 0.01:
            break

    total_depth_pct = (current_price - price) / current_price * 100
    amplification = total_depth_pct / initial_shock_pct if initial_shock_pct > 0 else 1.0

    return CascadeResult(
        initial_shock_pct=initial_shock_pct,
        initial_price=current_price,
        final_price=price,
        total_cascade_depth_pct=total_depth_pct,
        cascade_rounds=len(timeline),
        total_liquidation_volume_usd=total_liquidation_volume,
        amplification_factor=amplification,
        liquidation_timeline=timeline,
        converged=len(timeline) < max_iterations,
    )


def run_stress_test_grid(
    current_price: float,
    tick_liquidity: Optional[pd.DataFrame],
    liquidation_map: StaticLiquidationMap,
    shocks: Optional[list[float]] = None,
    dex_fraction: float = 0.3,
) -> list[dict]:
    """
    Run cascade simulation across a grid of initial shocks.

    Default shocks: [1, 2, 3, 5, 7, 10, 15, 20, 30, 50]

    Returns list of summary dicts for each shock scenario.
    """
    if shocks is None:
        shocks = [1, 2, 3, 5, 7, 10, 15, 20, 30, 50]

    results = []
    for shock_pct in shocks:
        result = simulate_cascade(
            initial_shock_pct=shock_pct,
            current_price=current_price,
            tick_liquidity=tick_liquidity,
            liquidation_map=liquidation_map,
            dex_fraction=dex_fraction,
        )

        results.append({
            "shock_pct": shock_pct,
            "final_price": round(result.final_price, 2),
            "total_cascade_depth_pct": round(result.total_cascade_depth_pct, 2),
            "cascade_rounds": result.cascade_rounds,
            "total_liquidation_usd": round(result.total_liquidation_volume_usd, 2),
            "amplification_factor": round(result.amplification_factor, 3),
        })

    return results
