"""
Funding Rate Signal

Cross-exchange funding rates indicate the balance between long and short
demand in perpetual futures. Extremely negative funding = heavy shorting
pressure = bearish signal. Extremely positive = overleveraged longs.

Sources:
- Hyperliquid API (primary, on-chain)
- CoinGlass API (aggregated, requires API key)
"""

import json
import urllib.request
from typing import Optional


HYPERLIQUID_INFO_URL = "https://api.hyperliquid.xyz/info"


def get_hyperliquid_funding(coin: str = "ETH") -> dict:
    """
    Fetch current and recent funding rates from Hyperliquid.

    Returns:
    - current_rate: Current 8h funding rate
    - annualized: Current rate annualized
    - open_interest: Current open interest in USD
    - mark_price: Current mark price
    """
    try:
        # Get meta and asset contexts (includes funding and OI)
        data = json.dumps({"type": "metaAndAssetCtxs"}).encode()
        req = urllib.request.Request(
            HYPERLIQUID_INFO_URL,
            data=data,
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read())

        # result is [meta, [assetCtx, ...]]
        meta = result[0]
        contexts = result[1]

        # Find ETH
        coin_idx = None
        for i, asset in enumerate(meta.get("universe", [])):
            if asset.get("name", "").upper() == coin.upper():
                coin_idx = i
                break

        if coin_idx is None or coin_idx >= len(contexts):
            return _empty_funding()

        ctx = contexts[coin_idx]
        funding_rate = float(ctx.get("funding", 0))
        open_interest = float(ctx.get("openInterest", 0))
        mark_price = float(ctx.get("markPx", 0))

        return {
            "current_rate": funding_rate,
            "annualized": funding_rate * 3 * 365,  # 8h rate → annual
            "open_interest": open_interest,
            "open_interest_usd": open_interest * mark_price,
            "mark_price": mark_price,
            "source": "hyperliquid",
        }
    except Exception:
        return _empty_funding()


def get_funding_rate_signal(coin: str = "ETH") -> dict:
    """
    Compute composite funding rate signal.

    Returns:
    - signal: -1 to +1 (-1 = extreme short pressure, +1 = extreme long)
    - extremeness: 0-1 (how far from neutral)
    - interpretation: Human-readable
    - raw: Raw funding data
    """
    hl = get_hyperliquid_funding(coin)

    rate = hl["current_rate"]
    annualized = hl["annualized"]

    # Signal: positive funding = longs pay shorts = long-biased
    # Negative funding = shorts pay longs = short-biased
    # Neutral is around 0.0001 (0.01% per 8h)
    neutral_rate = 0.0001

    if abs(rate) < neutral_rate * 0.5:
        signal = 0.0
        interpretation = "Neutral funding — balanced market"
    elif rate > 0:
        signal = min(1.0, rate / 0.001)  # 0.1% per 8h → signal = 1.0
        if signal > 0.7:
            interpretation = "Extremely positive funding — overleveraged longs"
        elif signal > 0.3:
            interpretation = "Elevated positive funding — bullish bias"
        else:
            interpretation = "Mildly positive funding"
    else:
        signal = max(-1.0, rate / 0.001)  # -0.1% per 8h → signal = -1.0
        if signal < -0.7:
            interpretation = "Extremely negative funding — heavy shorting"
        elif signal < -0.3:
            interpretation = "Elevated negative funding — bearish bias"
        else:
            interpretation = "Mildly negative funding"

    return {
        "signal": round(signal, 4),
        "extremeness": round(abs(signal), 4),
        "interpretation": interpretation,
        "raw": hl,
    }


def _empty_funding() -> dict:
    return {
        "current_rate": 0.0,
        "annualized": 0.0,
        "open_interest": 0.0,
        "open_interest_usd": 0.0,
        "mark_price": 0.0,
        "source": "unavailable",
    }
