"""
P(x) — Market-implied probability distribution of future ETH prices.

Converts Uniswap V3 LP tick liquidity distributions into an implied
price probability density function. More liquidity at a tick means
more capital betting the price visits that region.
"""

import numpy as np
import pandas as pd
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class DistributionResult:
    """Result of computing the implied price distribution."""
    pdf: pd.DataFrame  # columns: [price, probability_density]
    mean: float
    std: float  # implied volatility proxy
    skewness: float
    kurtosis: float
    percentiles: dict  # {5: price, 25: price, 50: price, 75: price, 95: price}
    current_price: float
    block_number: Optional[int] = None


def compute_implied_distribution(
    tick_liquidity_df: pd.DataFrame,
    current_price: float,
    price_range_pct: float = 0.5,
    num_bins: int = 200,
) -> DistributionResult:
    """
    Convert LP liquidity distribution to implied price PDF.

    Intuition: More liquidity at a tick = more capital betting price
    visits that region. Normalize to get a probability distribution.

    Parameters:
    - tick_liquidity_df: DataFrame with columns [tick, price, liquidity]
    - current_price: Current ETH price in USD
    - price_range_pct: How far from current price to consider (0.5 = 50%)
    - num_bins: Number of price bins for the PDF

    Returns:
    - DistributionResult with PDF and moments
    """
    df = tick_liquidity_df.copy()

    if df.empty:
        return DistributionResult(
            pdf=pd.DataFrame(columns=["price", "probability_density"]),
            mean=current_price,
            std=0.0,
            skewness=0.0,
            kurtosis=0.0,
            percentiles={5: current_price, 25: current_price, 50: current_price,
                         75: current_price, 95: current_price},
            current_price=current_price,
        )

    # Filter to relevant price range
    price_low = current_price * (1 - price_range_pct)
    price_high = current_price * (1 + price_range_pct)
    df = df[(df["price"] >= price_low) & (df["price"] <= price_high)].copy()

    if df.empty or len(df) < 2:
        return DistributionResult(
            pdf=pd.DataFrame(columns=["price", "probability_density"]),
            mean=current_price,
            std=0.0,
            skewness=0.0,
            kurtosis=0.0,
            percentiles={5: current_price, 25: current_price, 50: current_price,
                         75: current_price, 95: current_price},
            current_price=current_price,
        )

    df = df.sort_values("price").reset_index(drop=True)

    # Compute value at each tick range
    # value_i = liquidity_i * (price_{i+1} - price_i)
    prices = df["price"].values
    liquidity = df["liquidity"].values.astype(np.float64)

    # Price differences between adjacent ticks
    dp = np.diff(prices)
    # Use liquidity at lower tick for each interval
    interval_values = liquidity[:-1] * dp

    # Midpoint prices for each interval
    midpoints = (prices[:-1] + prices[1:]) / 2

    # Normalize to probability density
    total_value = interval_values.sum()
    if total_value <= 0:
        density = np.zeros_like(interval_values)
    else:
        density = interval_values / (total_value * dp)  # density = prob / bin_width

    pdf_df = pd.DataFrame({
        "price": midpoints,
        "probability_density": density,
    })

    # Remove zero-density bins
    pdf_df = pdf_df[pdf_df["probability_density"] > 0].reset_index(drop=True)

    # Compute distribution moments
    moments = compute_distribution_moments(pdf_df, current_price)

    return DistributionResult(
        pdf=pdf_df,
        current_price=current_price,
        **moments,
    )


def compute_distribution_moments(
    pdf_df: pd.DataFrame,
    current_price: float,
) -> dict:
    """
    Extract key statistics from the implied distribution.

    Returns dict with: mean, std, skewness, kurtosis, percentiles
    """
    if pdf_df.empty:
        return {
            "mean": current_price,
            "std": 0.0,
            "skewness": 0.0,
            "kurtosis": 0.0,
            "percentiles": {5: current_price, 25: current_price, 50: current_price,
                            75: current_price, 95: current_price},
        }

    prices = pdf_df["price"].values
    density = pdf_df["probability_density"].values

    # Approximate bin widths
    if len(prices) > 1:
        dp = np.diff(prices)
        dp = np.append(dp, dp[-1])  # extend last bin
    else:
        dp = np.array([1.0])

    # Probability mass per bin
    prob = density * dp
    total_prob = prob.sum()
    if total_prob <= 0:
        return {
            "mean": current_price,
            "std": 0.0,
            "skewness": 0.0,
            "kurtosis": 0.0,
            "percentiles": {5: current_price, 25: current_price, 50: current_price,
                            75: current_price, 95: current_price},
        }

    prob = prob / total_prob  # normalize

    # Moments
    mean = np.sum(prob * prices)
    variance = np.sum(prob * (prices - mean) ** 2)
    std = np.sqrt(variance)

    if std > 0:
        skewness = np.sum(prob * ((prices - mean) / std) ** 3)
        kurtosis = np.sum(prob * ((prices - mean) / std) ** 4) - 3  # excess kurtosis
    else:
        skewness = 0.0
        kurtosis = 0.0

    # Percentiles via CDF
    cdf = np.cumsum(prob)
    percentile_levels = {5: 0.05, 25: 0.25, 50: 0.50, 75: 0.75, 95: 0.95}
    percentiles = {}
    for pct, level in percentile_levels.items():
        idx = np.searchsorted(cdf, level)
        idx = min(idx, len(prices) - 1)
        percentiles[pct] = float(prices[idx])

    return {
        "mean": float(mean),
        "std": float(std),
        "skewness": float(skewness),
        "kurtosis": float(kurtosis),
        "percentiles": percentiles,
    }


def merge_pool_distributions(
    distributions: list[DistributionResult],
    weights: Optional[list[float]] = None,
) -> DistributionResult:
    """
    Merge implied distributions from multiple Uniswap V3 pools
    (e.g., ETH/USDC 0.05% and 0.3%) into a single distribution.

    Uses TVL-weighted averaging by default.
    """
    if not distributions:
        raise ValueError("No distributions to merge")

    if len(distributions) == 1:
        return distributions[0]

    if weights is None:
        # Weight by total liquidity value
        total_areas = []
        for d in distributions:
            if not d.pdf.empty:
                total_areas.append(d.pdf["probability_density"].sum())
            else:
                total_areas.append(0)
        total = sum(total_areas)
        weights = [a / total if total > 0 else 1 / len(distributions) for a in total_areas]

    # Create common price grid
    all_prices = np.concatenate([d.pdf["price"].values for d in distributions if not d.pdf.empty])
    if len(all_prices) == 0:
        return distributions[0]

    price_min = all_prices.min()
    price_max = all_prices.max()
    common_prices = np.linspace(price_min, price_max, 300)

    # Interpolate each distribution onto common grid and weight
    merged_density = np.zeros_like(common_prices)
    for d, w in zip(distributions, weights):
        if d.pdf.empty:
            continue
        interp = np.interp(common_prices, d.pdf["price"].values, d.pdf["probability_density"].values, left=0, right=0)
        merged_density += w * interp

    merged_pdf = pd.DataFrame({
        "price": common_prices,
        "probability_density": merged_density,
    })
    merged_pdf = merged_pdf[merged_pdf["probability_density"] > 0].reset_index(drop=True)

    current_price = distributions[0].current_price
    moments = compute_distribution_moments(merged_pdf, current_price)

    return DistributionResult(
        pdf=merged_pdf,
        current_price=current_price,
        **moments,
    )
