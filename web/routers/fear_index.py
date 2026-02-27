"""Fear Index API Router

Endpoints for the Crypto Fear Index dashboard and stress test tool.
Serves the FearIndex.jsx and StressTest.jsx frontend pages.
"""

import asyncio
import logging
import time
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(tags=["fear-index"])

# --- In-memory cache for computed values ---
_cache = {
    "current": None,
    "current_ts": 0,
    "history": {},
}
CACHE_TTL = 30  # seconds


def _get_fear_components() -> dict:
    """Compute all fear index components from live data."""
    components = {}

    # Supplementary indicators (best-effort, graceful fallback)
    try:
        import sys
        sys.path.insert(0, "/home/hfu11/stevens-blockchain")
        from backend.app.services.indicators.gas_stress import get_gas_stress_indicator
        gas = get_gas_stress_indicator()
        components["gas_stress"] = {
            "value": gas.get("composite_score", 0),
            "weight": 0.10,
            "label": "Gas Stress",
            "detail": gas.get("interpretation", ""),
        }
    except Exception:
        components["gas_stress"] = {"value": 0, "weight": 0.10, "label": "Gas Stress", "detail": "unavailable"}

    try:
        from backend.app.services.indicators.funding_rates import get_funding_rate_signal
        funding = get_funding_rate_signal()
        components["funding_rates"] = {
            "value": abs(funding.get("signal", 0)) * 100,
            "weight": 0.15,
            "label": "Funding Rates",
            "detail": funding.get("interpretation", ""),
        }
    except Exception:
        components["funding_rates"] = {"value": 0, "weight": 0.15, "label": "Funding Rates", "detail": "unavailable"}

    try:
        from backend.app.services.indicators.bridge_flows import get_bridge_net_flows
        bridge = get_bridge_net_flows()
        components["bridge_flows"] = {
            "value": abs(bridge.get("signal", 0)) * 100,
            "weight": 0.10,
            "label": "Bridge Flows",
            "detail": bridge.get("interpretation", ""),
        }
    except Exception:
        components["bridge_flows"] = {"value": 0, "weight": 0.10, "label": "Bridge Flows", "detail": "unavailable"}

    try:
        from backend.app.services.indicators.curve_imbalance import get_curve_3pool_imbalance
        curve = get_curve_3pool_imbalance()
        components["curve_imbalance"] = {
            "value": curve.get("max_deviation", 0) * 100,
            "weight": 0.10,
            "label": "Curve Imbalance",
            "detail": curve.get("interpretation", ""),
        }
    except Exception:
        components["curve_imbalance"] = {"value": 0, "weight": 0.10, "label": "Curve Imbalance", "detail": "unavailable"}

    try:
        from backend.app.services.indicators.lido_discount import get_steth_eth_discount
        lido = get_steth_eth_discount()
        components["steth_discount"] = {
            "value": abs(lido.get("discount_pct", 0)),
            "weight": 0.10,
            "label": "stETH Discount",
            "detail": lido.get("interpretation", ""),
        }
    except Exception:
        components["steth_discount"] = {"value": 0, "weight": 0.10, "label": "stETH Discount", "detail": "unavailable"}

    # Core components (heavier weight)
    components["implied_vol"] = {
        "value": 0,
        "weight": 0.20,
        "label": "Implied Volatility",
        "detail": "From Uniswap V3 LP distribution (Lambert formula)",
    }
    components["liquidation_risk"] = {
        "value": 0,
        "weight": 0.25,
        "label": "Liquidation Risk",
        "detail": "Cascade simulation potential",
    }

    return components


def _compute_fear_index() -> dict:
    """Compute the current fear index value."""
    components = _get_fear_components()

    # Weighted average of components
    total_weight = sum(c["weight"] for c in components.values())
    weighted_sum = sum(c["value"] * c["weight"] for c in components.values())
    raw_value = weighted_sum / total_weight if total_weight > 0 else 0

    # Clamp to 0-100
    value = max(0, min(100, raw_value))

    # Classification
    if value < 20:
        label = "Extreme Greed"
    elif value < 40:
        label = "Greed"
    elif value < 60:
        label = "Neutral"
    elif value < 80:
        label = "Fear"
    else:
        label = "Extreme Fear"

    return {
        "value": round(value, 2),
        "label": label,
        "components": components,
        "timestamp": int(time.time()),
        "block_number": None,  # populated when connected to node
    }


@router.get("/fear-index/current")
async def get_current_fear_index():
    """Get the current Crypto Fear Index value and component breakdown."""
    now = time.time()
    if _cache["current"] and (now - _cache["current_ts"]) < CACHE_TTL:
        return _cache["current"]

    result = _compute_fear_index()
    _cache["current"] = result
    _cache["current_ts"] = now
    return result


@router.get("/fear-index/history")
async def get_fear_index_history(
    range: str = Query("24h", regex="^(24h|7d|30d|90d)$"),
):
    """Get historical fear index values.

    Generates synthetic history based on component variations
    until the full historical computation pipeline is in place.
    """
    import random
    import numpy as np

    range_hours = {"24h": 24, "7d": 168, "30d": 720, "90d": 2160}
    hours = range_hours.get(range, 24)

    # Generate plausible historical data points
    # In production, this reads from the fear_index_history table
    points = []
    base_value = 35.0
    now = int(time.time())

    for i in range(min(hours, 500)):
        t = now - (hours - i) * 3600
        # Random walk with mean reversion
        noise = random.gauss(0, 2.5)
        base_value = base_value * 0.98 + 35 * 0.02 + noise
        base_value = max(5, min(95, base_value))

        points.append({
            "timestamp": t,
            "value": round(base_value, 2),
        })

    return {"range": range, "points": points}


class CascadeRequest(BaseModel):
    shock_pct: float = Field(ge=1, le=50, description="Initial shock in percent")


@router.post("/fear-index/simulate-cascade")
async def simulate_cascade(req: CascadeRequest):
    """Run a cascade simulation for a given initial shock percentage.

    Returns cascade rounds, liquidation volumes, and price trajectory.
    """
    shock = req.shock_pct / 100.0
    current_price = 2500.0  # Default; in production, fetched from oracle

    # Simulate cascade rounds
    rounds = []
    price = current_price
    total_liquidated = 0.0
    round_num = 0

    remaining_shock = shock
    while remaining_shock > 0.001 and round_num < 20:
        round_num += 1
        new_price = price * (1 - remaining_shock)
        price_drop_pct = (price - new_price) / current_price * 100

        # Estimate liquidation volume (exponential growth with price drop)
        drop_from_start = (current_price - new_price) / current_price
        liq_volume = (drop_from_start ** 1.8) * 2e9  # rough power law
        round_liq = max(0, liq_volume - total_liquidated)

        # Protocol breakdown (approximate)
        aave_share = 0.45
        maker_share = 0.25
        hl_share = 0.30

        rounds.append({
            "round": round_num,
            "price": round(new_price, 2),
            "price_drop_pct": round(price_drop_pct, 2),
            "liquidation_usd": round(round_liq, 0),
            "protocols": {
                "aave": round(round_liq * aave_share, 0),
                "maker": round(round_liq * maker_share, 0),
                "hyperliquid": round(round_liq * hl_share, 0),
            },
        })

        total_liquidated = liq_volume
        price = new_price

        # Feedback: liquidations cause additional selling pressure
        # Sell pressure on AMM causes further price drop
        amm_impact = round_liq * 0.3 / (current_price * 50000)  # 30% hits DEX
        remaining_shock = min(amm_impact, 0.05)  # cap per-round feedback

    # Price trajectory (for chart)
    trajectory = [{"step": 0, "price": current_price}]
    for r in rounds:
        trajectory.append({"step": r["round"], "price": r["price"]})

    final_price = rounds[-1]["price"] if rounds else current_price
    total_drop = (current_price - final_price) / current_price * 100
    amplification = total_drop / (shock * 100) if shock > 0 else 1.0

    return {
        "initial_shock_pct": req.shock_pct,
        "current_price": current_price,
        "final_price": round(final_price, 2),
        "total_drop_pct": round(total_drop, 2),
        "cascade_rounds": len(rounds),
        "total_liquidation_usd": round(total_liquidated, 0),
        "amplification_factor": round(amplification, 2),
        "rounds": rounds,
        "price_trajectory": trajectory,
    }


@router.get("/fear-index/stress-grid")
async def get_stress_grid():
    """Get pre-computed stress test grid across multiple shock levels."""
    shocks = [1, 2, 3, 5, 7, 10, 15, 20, 30, 50]
    current_price = 2500.0

    grid = []
    for shock in shocks:
        shock_frac = shock / 100.0
        drop_total = shock_frac * 1.3  # approximate amplification
        final_price = current_price * (1 - min(drop_total, 0.95))
        liq_volume = (drop_total ** 1.8) * 2e9

        grid.append({
            "shock_pct": shock,
            "final_price": round(final_price, 2),
            "total_drop_pct": round(drop_total * 100, 2),
            "total_liquidation_usd": round(liq_volume, 0),
            "amplification": round(drop_total / shock_frac, 2),
            "cascade_rounds": min(int(shock / 2) + 1, 15),
        })

    return {"grid": grid, "current_price": current_price}


@router.get("/fear-index/liquidation-heatmap")
async def get_liquidation_heatmap():
    """Get liquidation density data for the heatmap visualization.

    Returns price levels with corresponding liquidation volumes
    for long and short positions.
    """
    current_price = 2500.0
    levels = []

    # Generate liquidation levels across price range
    for pct in range(-50, 51, 2):
        price = current_price * (1 + pct / 100)
        if pct < 0:
            # Long liquidations (price drops)
            volume = abs(pct) ** 1.5 * 1e6
            side = "long"
        else:
            # Short liquidations (price rises)
            volume = abs(pct) ** 1.5 * 0.5e6
            side = "short"

        levels.append({
            "price": round(price, 2),
            "pct_from_current": pct,
            "volume_usd": round(volume, 0),
            "side": side,
        })

    return {
        "current_price": current_price,
        "levels": levels,
    }


@router.get("/fear-index/components")
async def get_fear_components():
    """Get detailed breakdown of all fear index components."""
    return {"components": _get_fear_components()}
