"""Hyperliquid Position Scanner

Scans Hyperliquid open positions for liquidation prices using their
public REST API.

API endpoint: POST https://api.hyperliquid.xyz/info
"""

from __future__ import annotations
import json
import logging
import urllib.request
from typing import Any, Optional

import pandas as pd

logger = logging.getLogger(__name__)

HYPERLIQUID_INFO_URL = "https://api.hyperliquid.xyz/info"


def _hl_request(payload: dict) -> Any:
    """Make a POST request to Hyperliquid info API."""
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        HYPERLIQUID_INFO_URL,
        data=data,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read())


def get_market_data() -> dict:
    """Fetch market metadata and asset contexts from Hyperliquid.

    Returns dict with per-asset funding, open interest, and mark price.
    """
    try:
        result = _hl_request({"type": "metaAndAssetCtxs"})
        meta = result[0]
        contexts = result[1]

        assets = {}
        for i, asset in enumerate(meta.get("universe", [])):
            name = asset.get("name", "")
            if i < len(contexts):
                ctx = contexts[i]
                assets[name] = {
                    "funding": float(ctx.get("funding", 0)),
                    "open_interest": float(ctx.get("openInterest", 0)),
                    "mark_price": float(ctx.get("markPx", 0)),
                    "oracle_price": float(ctx.get("oraclePx", 0)),
                }
        return assets
    except Exception as e:
        logger.error("Failed to fetch Hyperliquid market data: %s", e)
        return {}


def get_user_positions(user_address: str) -> list[dict]:
    """Fetch open positions for a specific user.

    Returns list of position dicts with entry price, size, leverage,
    and liquidation price.
    """
    try:
        result = _hl_request({
            "type": "clearinghouseState",
            "user": user_address,
        })

        positions = []
        for pos in result.get("assetPositions", []):
            p = pos.get("position", {})
            if float(p.get("szi", 0)) == 0:
                continue

            positions.append({
                "coin": p.get("coin", ""),
                "size": float(p.get("szi", 0)),
                "entry_price": float(p.get("entryPx", 0)),
                "position_value": float(p.get("positionValue", 0)),
                "unrealized_pnl": float(p.get("unrealizedPnl", 0)),
                "leverage": float(p.get("leverage", {}).get("value", 1)),
                "liquidation_price": float(p.get("liquidationPx", 0)) if p.get("liquidationPx") else None,
            })

        return positions

    except Exception as e:
        logger.error("Failed to fetch positions for %s: %s", user_address, e)
        return []


def scan_hyperliquid_positions(
    known_users: Optional[list[str]] = None,
    coin: str = "ETH",
) -> pd.DataFrame:
    """Scan Hyperliquid positions for liquidation analysis.

    Since Hyperliquid doesn't expose a list of all users, we rely on:
    1. Known large traders (provided via known_users)
    2. Aggregate market data (OI, funding) as a proxy

    For each known position:
        long liquidation_price = entry_price * (1 - 1/leverage)
        short liquidation_price = entry_price * (1 + 1/leverage)

    Returns DataFrame with columns:
    [user_address, coin, size, entry_price, position_value_usd,
     leverage, liquidation_price, side]
    """
    records = []

    # Scan known users
    if known_users:
        for user in known_users:
            positions = get_user_positions(user)
            for p in positions:
                if p["coin"].upper() != coin.upper():
                    continue

                side = "long" if p["size"] > 0 else "short"
                liq_price = p.get("liquidation_price")

                # Compute liquidation price if not provided
                if liq_price is None or liq_price == 0:
                    leverage = max(p["leverage"], 1)
                    if side == "long":
                        liq_price = p["entry_price"] * (1 - 1 / leverage)
                    else:
                        liq_price = p["entry_price"] * (1 + 1 / leverage)

                records.append({
                    "user_address": user,
                    "coin": p["coin"],
                    "size": abs(p["size"]),
                    "entry_price": p["entry_price"],
                    "position_value_usd": abs(p["position_value"]),
                    "leverage": p["leverage"],
                    "liquidation_price": liq_price,
                    "side": side,
                })

    # Add aggregate market data as context
    market = get_market_data()
    eth_data = market.get(coin.upper(), market.get("ETH", {}))

    df = pd.DataFrame(records)
    if df.empty:
        df = pd.DataFrame(columns=[
            "user_address", "coin", "size", "entry_price",
            "position_value_usd", "leverage", "liquidation_price", "side",
        ])

    # Attach market metadata
    df.attrs["open_interest"] = eth_data.get("open_interest", 0)
    df.attrs["funding_rate"] = eth_data.get("funding", 0)
    df.attrs["mark_price"] = eth_data.get("mark_price", 0)

    logger.info("Scanned %d Hyperliquid positions for %s", len(df), coin)
    return df


def get_hyperliquid_liquidation_schedule(
    known_users: Optional[list[str]] = None,
    coin: str = "ETH",
) -> pd.DataFrame:
    """Get Hyperliquid liquidation schedule sorted by liquidation price desc."""
    df = scan_hyperliquid_positions(known_users, coin)
    if df.empty:
        return df

    return df.sort_values(
        "liquidation_price", ascending=False
    ).reset_index(drop=True)
