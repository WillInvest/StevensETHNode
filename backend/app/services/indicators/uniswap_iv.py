"""
Uniswap V3 On-Chain Implied Volatility

Implements the Lambert (2021) formula for extracting implied volatility
from Uniswap V3 pool parameters. LP positions are mathematically
equivalent to perpetual options — the fee income compensates for IL
analogously to option premium.

References:
- Lambert (2021): "On-chain Volatility and Uniswap v3"
- Lambert (2021): "Uniswap V3 LP Tokens as Perpetual Put and Call Options"
"""

import math
from dataclasses import dataclass
from typing import Optional


@dataclass
class IVResult:
    """Implied volatility computation result."""
    iv_annualized: float  # e.g., 0.85 = 85%
    fee_rate: float
    daily_volume_usd: float
    tick_liquidity_usd: float
    pool_address: str
    block_number: Optional[int] = None


def lambert_iv(
    fee_rate: float,
    daily_volume_usd: float,
    tick_liquidity_usd: float,
) -> float:
    """
    Compute on-chain implied volatility using the Lambert formula.

    IV = 2 * fee_rate * sqrt(daily_volume / tick_liquidity) * sqrt(365)

    Parameters:
    - fee_rate: Pool fee tier (0.0005 for 0.05%, 0.003 for 0.3%, 0.01 for 1%)
    - daily_volume_usd: 24h swap volume in USD (from Swap events)
    - tick_liquidity_usd: Liquidity at current tick in USD terms

    Returns:
    - Annualized implied volatility (e.g., 0.85 = 85%)
    """
    if tick_liquidity_usd <= 0 or daily_volume_usd <= 0:
        return 0.0

    return 2 * fee_rate * math.sqrt(daily_volume_usd / tick_liquidity_usd) * math.sqrt(365)


def compute_pool_iv(
    fee_rate: float,
    daily_volume_usd: float,
    tick_liquidity_usd: float,
    pool_address: str,
    block_number: Optional[int] = None,
) -> IVResult:
    """Compute IV for a single pool and return structured result."""
    iv = lambert_iv(fee_rate, daily_volume_usd, tick_liquidity_usd)
    return IVResult(
        iv_annualized=iv,
        fee_rate=fee_rate,
        daily_volume_usd=daily_volume_usd,
        tick_liquidity_usd=tick_liquidity_usd,
        pool_address=pool_address,
        block_number=block_number,
    )


def fee_tier_migration_signal(pools_by_tier: dict[float, float]) -> float:
    """
    Track TVL ratios across fee tiers for the same pair.
    Rising share of 0.3%/1.0% tier vs 0.05% tier = LPs expect higher vol.

    Input: dict of {fee_tier: tvl_usd} for same pair (e.g., ETH/USDC)
           e.g., {0.0005: 200_000_000, 0.003: 50_000_000, 0.01: 5_000_000}

    Output: migration_score (0-1, higher = more vol expected)
    """
    if not pools_by_tier:
        return 0.5  # neutral

    total_tvl = sum(pools_by_tier.values())
    if total_tvl <= 0:
        return 0.5

    # Compute weighted average fee tier
    weighted_fee = sum(tier * tvl for tier, tvl in pools_by_tier.items()) / total_tvl

    # Normalize: 0.05% tier dominant → low score, 1% tier dominant → high score
    # Range from 0.0005 to 0.01
    min_fee = 0.0005
    max_fee = 0.01

    score = (weighted_fee - min_fee) / (max_fee - min_fee)
    return max(0.0, min(1.0, score))


def aggregate_iv_across_pools(iv_results: list[IVResult]) -> float:
    """
    Compute a single IV estimate by TVL-weighting across pools.

    Uses tick liquidity as weight — pools with more liquidity at the
    current tick give more reliable IV estimates.
    """
    if not iv_results:
        return 0.0

    total_weight = sum(r.tick_liquidity_usd for r in iv_results)
    if total_weight <= 0:
        return sum(r.iv_annualized for r in iv_results) / len(iv_results)

    weighted_iv = sum(
        r.iv_annualized * r.tick_liquidity_usd / total_weight
        for r in iv_results
    )
    return weighted_iv


def iv_term_structure_proxy(
    iv_results: list[IVResult],
    daily_volumes_7d: Optional[dict[str, float]] = None,
    daily_volumes_30d: Optional[dict[str, float]] = None,
) -> dict:
    """
    Estimate IV term structure by computing IV at different volume windows.

    Using 24h volume gives ~1-day IV, 7d average volume gives ~1-week IV,
    30d average volume gives ~1-month IV.

    Returns dict with short/medium/long term IV and term structure slope.
    """
    if not iv_results:
        return {"short": 0.0, "medium": 0.0, "long": 0.0, "slope": 0.0}

    # Short term (24h volume, already computed)
    short_iv = aggregate_iv_across_pools(iv_results)

    # Medium term (7d average volume)
    medium_iv = short_iv  # default
    if daily_volumes_7d:
        medium_results = []
        for r in iv_results:
            vol_7d = daily_volumes_7d.get(r.pool_address, r.daily_volume_usd)
            medium_results.append(IVResult(
                iv_annualized=lambert_iv(r.fee_rate, vol_7d, r.tick_liquidity_usd),
                fee_rate=r.fee_rate,
                daily_volume_usd=vol_7d,
                tick_liquidity_usd=r.tick_liquidity_usd,
                pool_address=r.pool_address,
            ))
        medium_iv = aggregate_iv_across_pools(medium_results)

    # Long term (30d average volume)
    long_iv = short_iv  # default
    if daily_volumes_30d:
        long_results = []
        for r in iv_results:
            vol_30d = daily_volumes_30d.get(r.pool_address, r.daily_volume_usd)
            long_results.append(IVResult(
                iv_annualized=lambert_iv(r.fee_rate, vol_30d, r.tick_liquidity_usd),
                fee_rate=r.fee_rate,
                daily_volume_usd=vol_30d,
                tick_liquidity_usd=r.tick_liquidity_usd,
                pool_address=r.pool_address,
            ))
        long_iv = aggregate_iv_across_pools(long_results)

    # Term structure slope: positive = backwardation (short > long), negative = contango
    slope = short_iv - long_iv if long_iv > 0 else 0.0

    return {
        "short": short_iv,
        "medium": medium_iv,
        "long": long_iv,
        "slope": slope,
    }
