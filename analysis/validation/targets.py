"""Target Variable Construction for Fear Index Validation

Computes realized volatility at multiple horizons as the ground-truth
target for validating the Crypto Fear Index's predictive power.

Methods:
- Close-to-close: standard deviation of log returns
- Parkinson: range-based estimator using high-low
- Garman-Klass: OHLC-based, most efficient estimator
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


@dataclass
class RealizedVolResult:
    """Result of realized volatility computation."""
    rv_1d: pd.Series   # 1-day forward realized vol
    rv_7d: pd.Series   # 7-day forward realized vol
    rv_30d: pd.Series  # 30-day forward realized vol
    method: str
    annualized: bool


def compute_realized_volatility(
    prices: pd.DataFrame,
    method: str = "garman_klass",
    annualize: bool = True,
) -> RealizedVolResult:
    """Compute realized volatility for ETH price data.

    Parameters
    ----------
    prices : DataFrame
        Must contain 'close' column. For Garman-Klass, also needs
        'open', 'high', 'low'. Index should be datetime.
    method : str
        One of 'close_to_close', 'parkinson', 'garman_klass'.
    annualize : bool
        If True, multiply by sqrt(365) for annualized vol.

    Returns
    -------
    RealizedVolResult with forward-looking realized vol at 1d, 7d, 30d.
    """
    factor = np.sqrt(365) if annualize else 1.0

    if method == "close_to_close":
        log_ret = np.log(prices["close"] / prices["close"].shift(1))
        rv_1d = log_ret.rolling(1).std() * factor
        rv_7d = log_ret.rolling(7).std() * factor
        rv_30d = log_ret.rolling(30).std() * factor

    elif method == "parkinson":
        if "high" not in prices or "low" not in prices:
            raise ValueError("Parkinson method requires 'high' and 'low' columns")
        # Parkinson estimator: (1 / 4*ln2) * (ln(H/L))^2
        hl_sq = (np.log(prices["high"] / prices["low"])) ** 2
        coeff = 1.0 / (4.0 * np.log(2.0))
        rv_1d = np.sqrt(hl_sq.rolling(1).mean() * coeff) * factor
        rv_7d = np.sqrt(hl_sq.rolling(7).mean() * coeff) * factor
        rv_30d = np.sqrt(hl_sq.rolling(30).mean() * coeff) * factor

    elif method == "garman_klass":
        if not all(c in prices for c in ("open", "high", "low", "close")):
            raise ValueError("Garman-Klass requires OHLC columns")
        # GK = 0.5*(ln(H/L))^2 - (2*ln2 - 1)*(ln(C/O))^2
        hl = np.log(prices["high"] / prices["low"])
        co = np.log(prices["close"] / prices["open"])
        gk = 0.5 * hl**2 - (2 * np.log(2) - 1) * co**2

        rv_1d = np.sqrt(gk.rolling(1).mean().clip(lower=0)) * factor
        rv_7d = np.sqrt(gk.rolling(7).mean().clip(lower=0)) * factor
        rv_30d = np.sqrt(gk.rolling(30).mean().clip(lower=0)) * factor

    else:
        raise ValueError(f"Unknown method: {method}")

    # Shift forward: we want FUTURE realized vol as the prediction target
    rv_1d_fwd = rv_1d.shift(-1)
    rv_7d_fwd = rv_7d.shift(-7)
    rv_30d_fwd = rv_30d.shift(-30)

    logger.info(
        "Computed %s realized vol: %d observations", method, len(rv_1d_fwd.dropna())
    )

    return RealizedVolResult(
        rv_1d=rv_1d_fwd,
        rv_7d=rv_7d_fwd,
        rv_30d=rv_30d_fwd,
        method=method,
        annualized=annualize,
    )


def fetch_eth_ohlcv(
    db_url: str = "postgresql://ethnode:changeme@localhost:5432/ethnode",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> pd.DataFrame:
    """Fetch ETH OHLCV data from the database or compute from block data.

    Falls back to computing daily OHLCV from indexed swap events
    if no direct price feed is available.
    """
    import psycopg2

    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()

        # Try to compute daily OHLCV from Uniswap V3 swap prices
        # Price = abs(amount0) / abs(amount1) for ETH/USDC pools
        query = """
            WITH swap_prices AS (
                SELECT
                    DATE(to_timestamp(block_num * 12 + 1606824000)) as dt,
                    ABS(CAST(ig_amount0 AS numeric)) /
                        NULLIF(ABS(CAST(ig_amount1 AS numeric)), 0) * 1e12 as price
                FROM uniswap_v3_swaps
                WHERE ig_amount0 IS NOT NULL
                  AND ig_amount1 IS NOT NULL
                  AND ABS(CAST(ig_amount1 AS numeric)) > 0
            )
            SELECT
                dt,
                (ARRAY_AGG(price ORDER BY price))[1] as open,
                MAX(price) as high,
                MIN(price) as low,
                (ARRAY_AGG(price ORDER BY price DESC))[1] as close,
                COUNT(*) as volume
            FROM swap_prices
            WHERE price > 100 AND price < 100000
        """

        conditions = []
        params = []
        if start_date:
            conditions.append("dt >= %s")
            params.append(start_date)
        if end_date:
            conditions.append("dt <= %s")
            params.append(end_date)

        if conditions:
            query += " AND " + " AND ".join(conditions)
        query += " GROUP BY dt ORDER BY dt"

        cur.execute(query, params)
        rows = cur.fetchall()
        cur.close()
        conn.close()

        if not rows:
            logger.warning("No OHLCV data found in database")
            return pd.DataFrame(columns=["open", "high", "low", "close", "volume"])

        df = pd.DataFrame(rows, columns=["date", "open", "high", "low", "close", "volume"])
        df["date"] = pd.to_datetime(df["date"])
        df = df.set_index("date").sort_index()
        return df

    except Exception as e:
        logger.error("Failed to fetch OHLCV data: %s", e)
        return pd.DataFrame(columns=["open", "high", "low", "close", "volume"])
