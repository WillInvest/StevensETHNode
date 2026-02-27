"""Historical Event Validation

Reconstructs the Crypto Fear Index at key historical crash events to
validate whether the index spiked BEFORE the crash occurred.

Key events:
1. Black Thursday (March 12-13, 2020)
2. May 19, 2021 China mining ban crash
3. Terra/UST collapse (May 7-12, 2022)
4. FTX collapse (November 7-9, 2022)
5. SVB/USDC depeg (March 10-11, 2023)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional

import pandas as pd

logger = logging.getLogger(__name__)


@dataclass
class HistoricalEvent:
    """Definition of a historical crash event for validation."""
    name: str
    date: str
    block_range_start: int
    block_range_end: int
    pre_crash_block: int      # block ~24h before crash for early warning check
    eth_price_before: float
    eth_price_after: float
    price_drop_pct: float
    description: str
    key_signals: list[str] = field(default_factory=list)


# Canonical historical crash events
HISTORICAL_EVENTS = [
    HistoricalEvent(
        name="Black Thursday",
        date="2020-03-12",
        block_range_start=9650000,
        block_range_end=9680000,
        pre_crash_block=9640000,
        eth_price_before=194.0,
        eth_price_after=86.0,
        price_drop_pct=55.7,
        description="COVID panic. ETH dropped 55% in 24h. 3,994 MakerDAO vault liquidations.",
        key_signals=["maker_cr_distribution", "gas_stress", "bridge_flows"],
    ),
    HistoricalEvent(
        name="China Mining Ban Crash",
        date="2021-05-19",
        block_range_start=12440000,
        block_range_end=12480000,
        pre_crash_block=12430000,
        eth_price_before=3400.0,
        eth_price_after=1800.0,
        price_drop_pct=47.1,
        description="China mining ban announcement. ETH dropped 47%. Massive DeFi liquidations.",
        key_signals=["funding_rates", "lp_distribution_width", "aave_health"],
    ),
    HistoricalEvent(
        name="Terra/UST Collapse",
        date="2022-05-09",
        block_range_start=14730000,
        block_range_end=14770000,
        pre_crash_block=14720000,
        eth_price_before=2800.0,
        eth_price_after=1800.0,
        price_drop_pct=35.7,
        description="UST depeg and LUNA death spiral. Curve 3pool USDT weight exceeded 50%.",
        key_signals=["curve_imbalance", "aave_health", "bridge_flows"],
    ),
    HistoricalEvent(
        name="FTX Collapse",
        date="2022-11-08",
        block_range_start=15920000,
        block_range_end=15960000,
        pre_crash_block=15910000,
        eth_price_before=1570.0,
        eth_price_after=1090.0,
        price_drop_pct=30.6,
        description="FTX insolvency revealed. stETH discount spiked. Massive exchange outflows.",
        key_signals=["steth_discount", "bridge_flows", "funding_rates"],
    ),
    HistoricalEvent(
        name="SVB/USDC Depeg",
        date="2023-03-10",
        block_range_start=16790000,
        block_range_end=16810000,
        pre_crash_block=16785000,
        eth_price_before=1560.0,
        eth_price_after=1430.0,
        price_drop_pct=8.3,
        description="SVB collapse caused USDC depeg to $0.88. Curve 3pool massively imbalanced.",
        key_signals=["curve_imbalance", "steth_discount", "gas_stress"],
    ),
]


@dataclass
class EventValidationResult:
    """Result of validating the fear index against a historical event."""
    event: HistoricalEvent
    fear_before: Optional[float]       # fear index value 24h before crash
    fear_at_crash: Optional[float]     # fear index at crash start
    fear_peak: Optional[float]         # peak fear during event
    fear_after: Optional[float]        # fear index 48h after
    predicted_early: bool              # True if fear spiked before price crashed
    component_timeline: Optional[pd.DataFrame]  # per-component values over time
    error: Optional[str] = None


def validate_event(
    event: HistoricalEvent,
    rpc_url: str = "http://127.0.0.1:8545",
    db_url: str = "postgresql://ethnode:changeme@localhost:5432/ethnode",
) -> EventValidationResult:
    """Validate the fear index against a single historical crash event.

    Reconstructs on-chain state at the pre-crash block and crash blocks
    using the archive node, then computes the fear index at each point.

    Requires an archive node for historical state access.
    """
    try:
        # Import fear index computation
        import sys
        sys.path.insert(0, "/home/hfu11/stevens-blockchain")
        from backend.app.services.fear_index import compute_fear_index
        from backend.app.services.probability import compute_implied_distribution
        from backend.app.services.impact import build_static_liquidation_map

        logger.info("Validating event: %s (blocks %d-%d)",
                     event.name, event.block_range_start, event.block_range_end)

        # This is a placeholder for the full reconstruction pipeline.
        # Full implementation requires:
        # 1. Reconstruct tick liquidity at historical block
        # 2. Reconstruct lending positions at historical block
        # 3. Compute P(x) and I(x) at that block
        # 4. Compute fear index
        #
        # The archive node enables this via eth_call with block parameter.

        logger.warning(
            "Full historical reconstruction for %s requires running "
            "tick_liquidity and position_scanner at historical blocks. "
            "This is compute-intensive and should be run as a batch job.",
            event.name,
        )

        return EventValidationResult(
            event=event,
            fear_before=None,
            fear_at_crash=None,
            fear_peak=None,
            fear_after=None,
            predicted_early=False,
            component_timeline=None,
            error="Historical reconstruction pending batch execution",
        )

    except Exception as e:
        logger.error("Event validation failed for %s: %s", event.name, e)
        return EventValidationResult(
            event=event,
            fear_before=None, fear_at_crash=None, fear_peak=None, fear_after=None,
            predicted_early=False, component_timeline=None,
            error=str(e),
        )


def validate_all_events(
    rpc_url: str = "http://127.0.0.1:8545",
    db_url: str = "postgresql://ethnode:changeme@localhost:5432/ethnode",
) -> list[EventValidationResult]:
    """Run validation across all historical crash events."""
    results = []
    for event in HISTORICAL_EVENTS:
        result = validate_event(event, rpc_url, db_url)
        results.append(result)
    return results


def generate_event_report(results: list[EventValidationResult]) -> dict:
    """Generate a summary report from event validation results."""
    total = len(results)
    predicted = sum(1 for r in results if r.predicted_early)
    errors = sum(1 for r in results if r.error)

    return {
        "total_events": total,
        "correctly_predicted": predicted,
        "prediction_rate": predicted / max(total - errors, 1),
        "events_with_errors": errors,
        "events": [
            {
                "name": r.event.name,
                "date": r.event.date,
                "price_drop_pct": r.event.price_drop_pct,
                "fear_before": r.fear_before,
                "fear_at_crash": r.fear_at_crash,
                "predicted_early": r.predicted_early,
                "error": r.error,
            }
            for r in results
        ],
    }
