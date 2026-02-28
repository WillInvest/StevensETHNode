"""Hyperliquid Liquidation Estimator

Estimates liquidation levels for ETH perps on Hyperliquid using an
OI-distribution model.  No whale-scanning needed — we take aggregate OI
and distribute it across leverage buckets, then compute where those
synthetic positions would be liquidated.

Data flow:
  1. Fetch OI, funding rate, mark price  → metaAndAssetCtxs
  2. Fetch L2 order book                 → l2Book
  3. Distribute OI across leverage buckets
  4. Use funding rate to skew long/short ratio
  5. Compute liquidation prices for each bucket
  6. Bin results into price-level bars aligned with ±30% around mark price
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from typing import Any

from .position_scanner import _hl_request, get_market_data

logger = logging.getLogger(__name__)

# --- Leverage distribution model ---
# Empirical distribution of OI across leverage tiers (sums to 1.0).
LEVERAGE_BUCKETS: list[tuple[float, float]] = [
    (3,  0.05),   # 3x  → 5% of OI
    (5,  0.15),   # 5x  → 15%
    (10, 0.35),   # 10x → 35%
    (20, 0.30),   # 20x → 30%
    (50, 0.15),   # 50x → 15%
]


@dataclass
class LiquidationBar:
    """One bar in the liquidation heatmap."""
    price: float
    long_liq_usd: float   # liquidation volume from long positions (shown upward)
    short_liq_usd: float  # liquidation volume from short positions (shown downward)


@dataclass
class LiquidationMapResult:
    """Full result returned to the API."""
    mark_price: float
    open_interest_usd: float
    funding_rate: float
    long_ratio: float
    short_ratio: float
    bars: list[LiquidationBar]
    order_book_depth_usd: float  # total bid+ask depth fetched

    def to_dict(self) -> dict:
        return {
            "mark_price": round(self.mark_price, 2),
            "open_interest_usd": round(self.open_interest_usd, 2),
            "funding_rate": self.funding_rate,
            "long_ratio": round(self.long_ratio, 4),
            "short_ratio": round(self.short_ratio, 4),
            "order_book_depth_usd": round(self.order_book_depth_usd, 2),
            "bars": [
                {
                    "price": round(b.price, 2),
                    "long_liq_usd": round(b.long_liq_usd, 2),
                    "short_liq_usd": round(b.short_liq_usd, 2),
                }
                for b in self.bars
            ],
        }


def _fetch_l2_book(coin: str = "ETH", n_levels: int = 200) -> dict[str, Any]:
    """Fetch L2 order book from Hyperliquid.

    Returns {"bids": [[price, size], ...], "asks": [[price, size], ...]}.
    """
    try:
        result = _hl_request({
            "type": "l2Book",
            "coin": coin,
            "nSigFigs": 5,
        })
        levels = result.get("levels", [[], []])
        bids = [[float(e["px"]), float(e["sz"])] for e in levels[0][:n_levels]]
        asks = [[float(e["px"]), float(e["sz"])] for e in levels[1][:n_levels]]
        return {"bids": bids, "asks": asks}
    except Exception as e:
        logger.error("Failed to fetch L2 book for %s: %s", coin, e)
        return {"bids": [], "asks": []}


def _funding_to_long_short_ratio(funding_rate: float) -> tuple[float, float]:
    """Convert 8-hour funding rate to long/short OI ratio.

    Positive funding → longs pay shorts → more longs than shorts.
    We use a sigmoid-style mapping clamped between 0.35 and 0.65.
    """
    # Scale funding rate (typically -0.01% to +0.01% per 8h) to a bias
    # A funding of +0.0001 (0.01%) is already significant
    bias = math.tanh(funding_rate * 10_000)  # maps ±0.0001 → ±0.76
    long_ratio = 0.50 + 0.15 * bias  # clamps to [0.35, 0.65]
    short_ratio = 1.0 - long_ratio
    return long_ratio, short_ratio


def estimate_liquidation_map(
    coin: str = "ETH",
    price_pct_range: float = 0.30,
    num_bars: int = 120,
) -> LiquidationMapResult:
    """Build the estimated liquidation heatmap for a perpetual.

    Returns liquidation volumes binned across price levels spanning
    ±price_pct_range around the current mark price.
    """
    # 1. Fetch market data
    market = get_market_data()
    asset = market.get(coin, {})
    if not asset:
        raise ValueError(f"No market data for {coin}")

    mark_price = asset["mark_price"]
    oi_usd = asset["open_interest"] * mark_price  # OI is in coins
    funding = asset["funding"]

    # 2. Fetch order book for depth context
    book = _fetch_l2_book(coin)
    bid_depth_usd = sum(p * s for p, s in book["bids"])
    ask_depth_usd = sum(p * s for p, s in book["asks"])
    total_depth_usd = bid_depth_usd + ask_depth_usd

    # 3. Long/short skew from funding
    long_ratio, short_ratio = _funding_to_long_short_ratio(funding)
    long_oi = oi_usd * long_ratio
    short_oi = oi_usd * short_ratio

    # 4. Price grid: ±pct_range around mark price
    price_lo = mark_price * (1 - price_pct_range)
    price_hi = mark_price * (1 + price_pct_range)
    bar_width = (price_hi - price_lo) / num_bars

    # Initialize bars
    bars: list[LiquidationBar] = []
    for i in range(num_bars):
        p = price_lo + (i + 0.5) * bar_width
        bars.append(LiquidationBar(price=p, long_liq_usd=0.0, short_liq_usd=0.0))

    # 5. Distribute OI across leverage buckets and compute liq prices
    for leverage, weight in LEVERAGE_BUCKETS:
        bucket_long_oi = long_oi * weight
        bucket_short_oi = short_oi * weight

        # Long liquidation price: mark * (1 - 1/leverage)
        # (maintenance margin ~= 1/leverage for high-leverage perps)
        # Spread entries around mark price using a small gaussian jitter
        # to avoid all liquidations landing on one exact tick.
        long_liq_price = mark_price * (1 - 1 / leverage)
        short_liq_price = mark_price * (1 + 1 / leverage)

        # Spread each bucket across a few bars using a gaussian kernel
        # Width of spread proportional to 1/leverage (higher leverage = tighter cluster)
        spread_pct = 0.02 / math.sqrt(leverage)  # e.g. 50x → 0.28%, 3x → 1.15%
        long_spread = mark_price * spread_pct
        short_spread = mark_price * spread_pct

        for bar in bars:
            # Long liquidations (below mark price)
            if long_liq_price > price_lo:
                dist = (bar.price - long_liq_price) / max(long_spread, 1)
                w = math.exp(-0.5 * dist * dist)
                bar.long_liq_usd += bucket_long_oi * w * (bar_width / max(long_spread * 2.507, 1))

            # Short liquidations (above mark price)
            if short_liq_price < price_hi:
                dist = (bar.price - short_liq_price) / max(short_spread, 1)
                w = math.exp(-0.5 * dist * dist)
                bar.short_liq_usd += bucket_short_oi * w * (bar_width / max(short_spread * 2.507, 1))

    # 6. Normalize: the total should roughly match OI (gaussian integral may overshoot)
    total_long_est = sum(b.long_liq_usd for b in bars)
    total_short_est = sum(b.short_liq_usd for b in bars)
    if total_long_est > 0:
        scale = long_oi / total_long_est
        for b in bars:
            b.long_liq_usd *= scale
    if total_short_est > 0:
        scale = short_oi / total_short_est
        for b in bars:
            b.short_liq_usd *= scale

    return LiquidationMapResult(
        mark_price=mark_price,
        open_interest_usd=oi_usd,
        funding_rate=funding,
        long_ratio=long_ratio,
        short_ratio=short_ratio,
        bars=bars,
        order_book_depth_usd=total_depth_usd,
    )


def estimate_cascade_liquidations(
    coin: str = "ETH",
    price_pct_range: float = 0.30,
    num_bars: int = 120,
    max_cascade_rounds: int = 5,
) -> dict:
    """Run a simplified cascade simulation using estimated liquidation data.

    For each price tick below mark price:
      1. Assume ETH drops to that price
      2. Sum all long liquidations above that price
      3. Estimate sell pressure from those liquidations
      4. Check order book depth for price impact
      5. New price may trigger more liquidations → repeat
      6. Return total cascade loss per bar

    Returns dict with bars and metadata.
    """
    # Get the base liquidation map
    liq_map = estimate_liquidation_map(coin, price_pct_range, num_bars)
    mark_price = liq_map.mark_price
    book = _fetch_l2_book(coin)

    # Build cumulative bid-side depth (how much USD the bids can absorb)
    # bids sorted high→low
    bid_depth_curve: list[tuple[float, float]] = []  # (price, cumulative_usd)
    cumulative = 0.0
    for price, size in sorted(book["bids"], key=lambda x: -x[0]):
        cumulative += price * size
        bid_depth_curve.append((price, cumulative))

    def _bid_depth_at_price(target_price: float) -> float:
        """Cumulative bid depth above target_price."""
        total = 0.0
        for price, cum in bid_depth_curve:
            if price >= target_price:
                total = cum
            else:
                break
        return total

    # Pre-sort bars by price descending for efficient range queries
    sorted_bars = sorted(liq_map.bars, key=lambda b: -b.price)

    cascade_bars: list[dict] = []

    for bar in liq_map.bars:
        if bar.price >= mark_price:
            # Only simulate downward cascades for long liquidations
            cascade_bars.append({
                "price": round(bar.price, 2),
                "cascade_loss_usd": 0.0,
                "cascade_rounds": 0,
                "final_price": round(bar.price, 2),
            })
            continue

        # Simulate cascade: price drops to bar.price
        # Track the price boundary that keeps moving down each round
        upper_bound = mark_price  # already-consumed boundary starts at mark
        lower_bound = bar.price   # initial trigger price
        total_liq_volume = 0.0
        rounds = 0

        for _ in range(max_cascade_rounds):
            # Sum long liquidations in the price band [lower_bound, upper_bound)
            round_liq = sum(
                b.long_liq_usd for b in sorted_bars
                if b.price >= lower_bound and b.price < upper_bound
            )

            if round_liq < 10_000:  # convergence threshold
                break

            total_liq_volume += round_liq
            rounds += 1

            # The sell pressure from this round pushes price further down
            dex_sell = round_liq * 0.30
            bid_depth = _bid_depth_at_price(lower_bound)

            # Compute how far the cascade pushes price below lower_bound
            if bid_depth > 0:
                impact_fraction = min(dex_sell / bid_depth, 0.5)
                new_lower = lower_bound * (1 - impact_fraction * 0.1)
            else:
                new_lower = lower_bound * 0.95

            # Next round: scan between new_lower and current lower_bound
            upper_bound = lower_bound
            lower_bound = new_lower

        cascade_bars.append({
            "price": round(bar.price, 2),
            "cascade_loss_usd": round(total_liq_volume, 2),
            "cascade_rounds": rounds,
            "final_price": round(lower_bound, 2),
        })

    return {
        "mark_price": round(mark_price, 2),
        "open_interest_usd": round(liq_map.open_interest_usd, 2),
        "bars": cascade_bars,
    }
