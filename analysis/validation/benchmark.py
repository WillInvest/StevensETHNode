"""Benchmark Comparison

Compares the Crypto Fear Index against existing volatility/fear measures:
1. Deribit DVOL (ETH) - options-based IV, gold standard
2. Alternative.me Fear & Greed Index - sentiment-based
3. HAR-RV model - pure time-series statistical baseline
4. Volmex EVIV - DeFi options-based IV

Metrics: correlation, directional accuracy, lead time, out-of-sample R².
"""

from __future__ import annotations

import json
import logging
import urllib.request
from dataclasses import dataclass
from typing import Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


@dataclass
class BenchmarkResult:
    """Comparison of CFI against a benchmark index."""
    benchmark_name: str
    correlation_1d: float       # Correlation with 1d forward RV
    correlation_7d: float       # Correlation with 7d forward RV
    correlation_30d: float      # Correlation with 30d forward RV
    directional_accuracy: float # % of times high fear predicted high vol
    mean_lead_days: float       # Average days CFI leads this benchmark
    oos_r2: float               # Out-of-sample R²
    n_observations: int


def fetch_alternative_fgi(limit: int = 0) -> pd.DataFrame:
    """Fetch Alternative.me Fear & Greed Index.

    Returns DataFrame with columns: [date, fgi_value, classification].
    Available daily from Feb 2018.
    """
    try:
        url = f"https://api.alternative.me/fng/?limit={limit}&format=json"
        req = urllib.request.Request(url, headers={"User-Agent": "StevensBlockchain/1.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())

        records = []
        for entry in data.get("data", []):
            records.append({
                "date": pd.to_datetime(int(entry["timestamp"]), unit="s"),
                "fgi_value": int(entry["value"]),
                "classification": entry["value_classification"],
            })

        df = pd.DataFrame(records)
        if not df.empty:
            df = df.set_index("date").sort_index()
        return df

    except Exception as e:
        logger.error("Failed to fetch Alternative.me FGI: %s", e)
        return pd.DataFrame(columns=["fgi_value", "classification"])


def compute_har_rv(
    realized_vol: pd.Series,
) -> pd.Series:
    """Compute HAR-RV (Heterogeneous Autoregressive Realized Volatility) forecast.

    HAR-RV model (Corsi, 2009):
        RV_t = c + β_d * RV_{t-1} + β_w * RV_avg(t-5:t-1) + β_m * RV_avg(t-22:t-1)

    This is the "dumb" statistical baseline — can our on-chain index beat it?
    """
    from sklearn.linear_model import LinearRegression

    rv = realized_vol.dropna()
    if len(rv) < 30:
        return pd.Series(dtype=float)

    # Construct HAR features
    rv_daily = rv.shift(1)
    rv_weekly = rv.rolling(5).mean().shift(1)
    rv_monthly = rv.rolling(22).mean().shift(1)

    features = pd.DataFrame({
        "rv_d": rv_daily,
        "rv_w": rv_weekly,
        "rv_m": rv_monthly,
    }).dropna()

    target = rv.loc[features.index]

    # Walk-forward prediction
    predictions = pd.Series(index=features.index, dtype=float)
    train_window = min(252, len(features) // 2)

    for i in range(train_window, len(features)):
        X_train = features.iloc[i - train_window:i].values
        y_train = target.iloc[i - train_window:i].values

        model = LinearRegression()
        model.fit(X_train, y_train)
        predictions.iloc[i] = model.predict(features.iloc[i:i + 1].values)[0]

    return predictions.dropna()


def compare_with_benchmark(
    cfi_series: pd.Series,
    benchmark_series: pd.Series,
    realized_vol: pd.Series,
    benchmark_name: str,
) -> BenchmarkResult:
    """Compare CFI against a benchmark for predicting realized volatility.

    Parameters
    ----------
    cfi_series : Series
        Our Crypto Fear Index time series.
    benchmark_series : Series
        Benchmark index time series.
    realized_vol : Series
        Forward-looking realized volatility (target).
    benchmark_name : str
        Name of the benchmark.
    """
    # Align all series
    combined = pd.DataFrame({
        "cfi": cfi_series,
        "benchmark": benchmark_series,
        "rv": realized_vol,
    }).dropna()

    n = len(combined)
    if n < 30:
        return BenchmarkResult(
            benchmark_name=benchmark_name,
            correlation_1d=0.0, correlation_7d=0.0, correlation_30d=0.0,
            directional_accuracy=0.0, mean_lead_days=0.0, oos_r2=0.0,
            n_observations=n,
        )

    # Correlations at different horizons
    rv_1d = combined["rv"].shift(-1)
    rv_7d = combined["rv"].rolling(7).mean().shift(-7)
    rv_30d = combined["rv"].rolling(30).mean().shift(-30)

    corr_1d = combined["cfi"].corr(rv_1d)
    corr_7d = combined["cfi"].corr(rv_7d)
    corr_30d = combined["cfi"].corr(rv_30d)

    # Directional accuracy
    cfi_high = combined["cfi"] > combined["cfi"].median()
    rv_high = combined["rv"] > combined["rv"].median()
    dir_acc = (cfi_high == rv_high).mean()

    # Lead-lag analysis: cross-correlation
    max_corr_lag = 0
    max_corr = 0
    for lag in range(-14, 15):
        shifted = combined["cfi"].shift(lag)
        c = shifted.corr(combined["rv"])
        if abs(c) > abs(max_corr):
            max_corr = c
            max_corr_lag = lag

    # Out-of-sample R²
    from sklearn.linear_model import LinearRegression
    from sklearn.metrics import r2_score

    split_point = int(n * 0.7)
    X_train = combined["cfi"].iloc[:split_point].values.reshape(-1, 1)
    y_train = combined["rv"].iloc[:split_point].values
    X_test = combined["cfi"].iloc[split_point:].values.reshape(-1, 1)
    y_test = combined["rv"].iloc[split_point:].values

    model = LinearRegression()
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)
    oos_r2 = r2_score(y_test, y_pred)

    return BenchmarkResult(
        benchmark_name=benchmark_name,
        correlation_1d=round(corr_1d, 4) if not np.isnan(corr_1d) else 0.0,
        correlation_7d=round(corr_7d, 4) if not np.isnan(corr_7d) else 0.0,
        correlation_30d=round(corr_30d, 4) if not np.isnan(corr_30d) else 0.0,
        directional_accuracy=round(dir_acc, 4),
        mean_lead_days=float(max_corr_lag),
        oos_r2=round(oos_r2, 4),
        n_observations=n,
    )


def run_full_benchmark(
    cfi_series: pd.Series,
    realized_vol: pd.Series,
) -> list[BenchmarkResult]:
    """Run CFI comparison against all available benchmarks."""
    results = []

    # 1. Alternative.me Fear & Greed Index
    try:
        fgi = fetch_alternative_fgi(limit=0)
        if not fgi.empty:
            result = compare_with_benchmark(
                cfi_series, fgi["fgi_value"], realized_vol, "Alternative.me FGI"
            )
            results.append(result)
    except Exception as e:
        logger.warning("FGI benchmark failed: %s", e)

    # 2. HAR-RV baseline
    try:
        har_rv = compute_har_rv(realized_vol)
        if not har_rv.empty:
            # For HAR-RV, compare prediction accuracy, not the index itself
            result = compare_with_benchmark(
                cfi_series, har_rv, realized_vol, "HAR-RV Model"
            )
            results.append(result)
    except Exception as e:
        logger.warning("HAR-RV benchmark failed: %s", e)

    logger.info("Completed %d benchmark comparisons", len(results))
    return results
