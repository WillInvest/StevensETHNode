"""Granger Causality & Lead-Lag Analysis

Tests whether the Crypto Fear Index Granger-causes future realized
volatility. Implements standard and time-varying Granger causality.

References:
- Granger (1969): "Investigating Causal Relations by Econometric Models"
- Shi, Phillips, Hurn (2018/2020): Time-varying Granger causality
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


@dataclass
class GrangerResult:
    """Results from Granger causality analysis."""
    is_causal: bool              # True if fear index Granger-causes RV
    p_value: float               # p-value of the F-test
    optimal_lag: int             # BIC-selected lag order
    f_statistic: float
    aic: float
    bic: float
    irf_cumulative: list[float]  # cumulative impulse response at each lag


@dataclass
class StationarityResult:
    """ADF test results."""
    is_stationary: bool
    adf_statistic: float
    p_value: float
    critical_values: dict[str, float]
    n_diffs: int  # number of differences applied


def test_stationarity(
    series: pd.Series,
    max_diffs: int = 2,
    significance: float = 0.05,
) -> StationarityResult:
    """Test for stationarity using Augmented Dickey-Fuller test.

    Automatically differences the series if non-stationary.
    """
    from statsmodels.tsa.stattools import adfuller

    current = series.dropna()
    n_diffs = 0

    for d in range(max_diffs + 1):
        if len(current) < 20:
            break

        result = adfuller(current, autolag="AIC")
        adf_stat, p_val = result[0], result[1]
        crit_vals = result[4]

        if p_val < significance:
            return StationarityResult(
                is_stationary=True,
                adf_statistic=adf_stat,
                p_value=p_val,
                critical_values=crit_vals,
                n_diffs=n_diffs,
            )

        if d < max_diffs:
            current = current.diff().dropna()
            n_diffs += 1

    return StationarityResult(
        is_stationary=False,
        adf_statistic=adf_stat,
        p_value=p_val,
        critical_values=crit_vals,
        n_diffs=n_diffs,
    )


def run_granger_tests(
    fear_index_ts: pd.Series,
    realized_vol_ts: pd.Series,
    max_lag: int = 30,
    significance: float = 0.05,
) -> GrangerResult:
    """Test if fear index Granger-causes realized volatility.

    Steps:
    1. ADF test for stationarity (difference if needed)
    2. VAR model with optimal lag selection (BIC)
    3. Granger causality F-test
    4. Impulse response functions

    Parameters
    ----------
    fear_index_ts : Series
        Fear index time series (daily).
    realized_vol_ts : Series
        Realized volatility time series (daily).
    max_lag : int
        Maximum lag to test.
    significance : float
        Significance level for tests.
    """
    from statsmodels.tsa.api import VAR
    from statsmodels.tsa.stattools import grangercausalitytests

    # Align series
    combined = pd.DataFrame({
        "fear": fear_index_ts,
        "rv": realized_vol_ts,
    }).dropna()

    if len(combined) < max_lag + 20:
        logger.warning("Insufficient data for Granger test: %d rows", len(combined))
        return GrangerResult(
            is_causal=False, p_value=1.0, optimal_lag=1,
            f_statistic=0.0, aic=0.0, bic=0.0, irf_cumulative=[],
        )

    # Stationarity check
    fear_stat = test_stationarity(combined["fear"])
    rv_stat = test_stationarity(combined["rv"])

    # Apply differencing if needed
    diff_order = max(fear_stat.n_diffs, rv_stat.n_diffs)
    if diff_order > 0:
        combined = combined.diff(diff_order).dropna()

    # Optimal lag selection via VAR + BIC
    try:
        var_model = VAR(combined)
        lag_selection = var_model.select_order(maxlags=min(max_lag, len(combined) // 3))
        optimal_lag = lag_selection.bic
        if optimal_lag == 0:
            optimal_lag = 1
    except Exception:
        optimal_lag = min(5, max_lag)

    # Granger causality test: does fear Granger-cause rv?
    try:
        gc_result = grangercausalitytests(
            combined[["rv", "fear"]],  # target first, then cause
            maxlag=optimal_lag,
            verbose=False,
        )
        # Get results at optimal lag
        lag_result = gc_result[optimal_lag]
        f_stat = lag_result[0]["ssr_ftest"][0]
        p_val = lag_result[0]["ssr_ftest"][1]
    except Exception as e:
        logger.warning("Granger test failed: %s", e)
        return GrangerResult(
            is_causal=False, p_value=1.0, optimal_lag=optimal_lag,
            f_statistic=0.0, aic=0.0, bic=0.0, irf_cumulative=[],
        )

    # Fit VAR for impulse response
    irf_cumulative = []
    try:
        fitted = var_model.fit(optimal_lag)
        irf = fitted.irf(periods=10)
        # Cumulative response of rv to a shock in fear
        fear_idx = list(combined.columns).index("fear")
        rv_idx = list(combined.columns).index("rv")
        cum_response = np.cumsum(irf.irfs[:, rv_idx, fear_idx])
        irf_cumulative = cum_response.tolist()
    except Exception:
        pass

    is_causal = p_val < significance

    logger.info(
        "Granger test: fear→rv %s (p=%.4f, F=%.2f, lag=%d)",
        "CAUSAL" if is_causal else "not causal",
        p_val, f_stat, optimal_lag,
    )

    return GrangerResult(
        is_causal=is_causal,
        p_value=p_val,
        optimal_lag=optimal_lag,
        f_statistic=f_stat,
        aic=lag_selection.aic if hasattr(lag_selection, "aic") else 0.0,
        bic=lag_selection.bic if isinstance(lag_selection.bic, float) else 0.0,
        irf_cumulative=irf_cumulative,
    )


def run_time_varying_granger(
    fear_index_ts: pd.Series,
    realized_vol_ts: pd.Series,
    window_size: int = 90,
    step_size: int = 7,
) -> pd.DataFrame:
    """Rolling-window Granger causality to detect regime-dependent predictability.

    Uses rolling windows to test if the fear→vol relationship is
    time-varying (stronger during stress periods).

    Returns DataFrame with columns:
    [window_end, p_value, f_statistic, is_causal, window_fear_mean]
    """
    combined = pd.DataFrame({
        "fear": fear_index_ts,
        "rv": realized_vol_ts,
    }).dropna()

    results = []
    n = len(combined)

    for end in range(window_size, n, step_size):
        start = end - window_size
        window = combined.iloc[start:end]

        try:
            gc = run_granger_tests(
                window["fear"], window["rv"],
                max_lag=min(10, window_size // 5),
            )
            results.append({
                "window_end": combined.index[end - 1],
                "p_value": gc.p_value,
                "f_statistic": gc.f_statistic,
                "is_causal": gc.is_causal,
                "window_fear_mean": window["fear"].mean(),
            })
        except Exception:
            continue

    df = pd.DataFrame(results)
    if not df.empty and "window_end" in df.columns:
        df = df.set_index("window_end")

    return df
