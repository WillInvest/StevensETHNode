"""
I(x) — Static Liquidation Map

For any hypothetical ETH price x, computes the total liquidation volume
that would trigger across all DeFi protocols. This is the "what-if"
function before cascade feedback is applied.
"""

import numpy as np
import pandas as pd
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class LiquidationLevel:
    """Liquidation data at a specific price level."""
    price_level: float
    aave_liquidation_usd: float = 0.0
    maker_liquidation_usd: float = 0.0
    hyperliquid_liquidation_usd: float = 0.0
    compound_liquidation_usd: float = 0.0
    total_liquidation_usd: float = 0.0
    num_positions_liquidated: int = 0
    largest_single_liquidation: float = 0.0


@dataclass
class StaticLiquidationMap:
    """Complete static liquidation map across all price levels."""
    levels: list[LiquidationLevel]
    current_price: float
    total_monitored_debt_usd: float = 0.0
    total_monitored_collateral_usd: float = 0.0
    block_number: Optional[int] = None

    def to_dataframe(self) -> pd.DataFrame:
        """Convert to DataFrame for analysis."""
        records = []
        for lvl in self.levels:
            records.append({
                "price_level": lvl.price_level,
                "price_drop_pct": round((1 - lvl.price_level / self.current_price) * 100, 2),
                "aave_liquidation_usd": lvl.aave_liquidation_usd,
                "maker_liquidation_usd": lvl.maker_liquidation_usd,
                "hyperliquid_liquidation_usd": lvl.hyperliquid_liquidation_usd,
                "compound_liquidation_usd": lvl.compound_liquidation_usd,
                "total_liquidation_usd": lvl.total_liquidation_usd,
                "num_positions_liquidated": lvl.num_positions_liquidated,
                "largest_single_liquidation": lvl.largest_single_liquidation,
            })
        return pd.DataFrame(records)

    def cumulative_at_price(self, target_price: float) -> float:
        """Get cumulative liquidation volume if price drops to target_price."""
        total = 0.0
        for lvl in self.levels:
            if lvl.price_level >= target_price:
                total += lvl.total_liquidation_usd
        return total


def build_static_liquidation_map(
    aave_positions: Optional[pd.DataFrame] = None,
    maker_vaults: Optional[pd.DataFrame] = None,
    hyperliquid_positions: Optional[pd.DataFrame] = None,
    compound_positions: Optional[pd.DataFrame] = None,
    current_eth_price: float = 1800.0,
    price_step: float = 10.0,
    min_price_pct: float = 0.5,
) -> StaticLiquidationMap:
    """
    Assemble the static what-if function I_static(x).

    For each price level x (discretized):
        I_static(x) = sum of all positions that liquidate if ETH reaches price x

    Parameters:
    - aave_positions: DataFrame with [liquidation_price, debt_usd, collateral_usd, ...]
    - maker_vaults: DataFrame with [liquidation_price, debt_usd, collateral_usd, ...]
    - hyperliquid_positions: DataFrame with [liquidation_price, position_value_usd, ...]
    - compound_positions: Optional DataFrame
    - current_eth_price: Current ETH price in USD
    - price_step: Price granularity in USD (e.g., $10)
    - min_price_pct: Minimum price as fraction of current (0.5 = 50%)

    Returns:
    - StaticLiquidationMap
    """
    min_price = current_eth_price * min_price_pct
    price_levels = np.arange(min_price, current_eth_price, price_step)

    levels = []
    total_debt = 0.0
    total_collateral = 0.0

    for price in price_levels:
        aave_liq = 0.0
        maker_liq = 0.0
        hl_liq = 0.0
        comp_liq = 0.0
        num_positions = 0
        largest = 0.0

        # Aave liquidations at this price level
        if aave_positions is not None and not aave_positions.empty:
            mask = (
                (aave_positions["liquidation_price"] >= price) &
                (aave_positions["liquidation_price"] < price + price_step)
            )
            matched = aave_positions[mask]
            if not matched.empty:
                aave_liq = matched["debt_usd"].sum()
                num_positions += len(matched)
                largest = max(largest, matched["debt_usd"].max())

        # MakerDAO liquidations
        if maker_vaults is not None and not maker_vaults.empty:
            mask = (
                (maker_vaults["liquidation_price"] >= price) &
                (maker_vaults["liquidation_price"] < price + price_step)
            )
            matched = maker_vaults[mask]
            if not matched.empty:
                maker_liq = matched["debt_usd"].sum()
                num_positions += len(matched)
                largest = max(largest, matched["debt_usd"].max())

        # Hyperliquid liquidations
        if hyperliquid_positions is not None and not hyperliquid_positions.empty:
            col = "position_value_usd" if "position_value_usd" in hyperliquid_positions.columns else "debt_usd"
            mask = (
                (hyperliquid_positions["liquidation_price"] >= price) &
                (hyperliquid_positions["liquidation_price"] < price + price_step)
            )
            matched = hyperliquid_positions[mask]
            if not matched.empty:
                hl_liq = matched[col].sum()
                num_positions += len(matched)
                largest = max(largest, matched[col].max())

        # Compound
        if compound_positions is not None and not compound_positions.empty:
            mask = (
                (compound_positions["liquidation_price"] >= price) &
                (compound_positions["liquidation_price"] < price + price_step)
            )
            matched = compound_positions[mask]
            if not matched.empty:
                comp_liq = matched["debt_usd"].sum()
                num_positions += len(matched)
                largest = max(largest, matched["debt_usd"].max())

        total = aave_liq + maker_liq + hl_liq + comp_liq

        levels.append(LiquidationLevel(
            price_level=float(price),
            aave_liquidation_usd=float(aave_liq),
            maker_liquidation_usd=float(maker_liq),
            hyperliquid_liquidation_usd=float(hl_liq),
            compound_liquidation_usd=float(comp_liq),
            total_liquidation_usd=float(total),
            num_positions_liquidated=num_positions,
            largest_single_liquidation=float(largest),
        ))

    # Track totals
    for df in [aave_positions, maker_vaults, compound_positions]:
        if df is not None and not df.empty:
            if "debt_usd" in df.columns:
                total_debt += df["debt_usd"].sum()
            if "collateral_usd" in df.columns:
                total_collateral += df["collateral_usd"].sum()

    return StaticLiquidationMap(
        levels=levels,
        current_price=current_eth_price,
        total_monitored_debt_usd=total_debt,
        total_monitored_collateral_usd=total_collateral,
    )


def summarize_liquidation_map(liq_map: StaticLiquidationMap) -> list[dict]:
    """
    Generate human-readable summary of liquidation risk at key price drops.

    Returns list of dicts like:
    {"drop_pct": 5, "price": 1710, "total_usd": 47_000_000, "positions": 234}
    """
    key_drops = [1, 2, 3, 5, 7, 10, 15, 20, 30, 50]
    summary = []

    for drop_pct in key_drops:
        target_price = liq_map.current_price * (1 - drop_pct / 100)
        cumulative = 0.0
        num_positions = 0

        for lvl in liq_map.levels:
            if lvl.price_level >= target_price:
                cumulative += lvl.total_liquidation_usd
                num_positions += lvl.num_positions_liquidated

        summary.append({
            "drop_pct": drop_pct,
            "price": round(target_price, 2),
            "total_usd": round(cumulative, 2),
            "positions": num_positions,
        })

    return summary
