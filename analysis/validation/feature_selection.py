"""Feature Selection for Fear Index Component Weighting

Uses LASSO / Elastic Net with walk-forward cross-validation to identify
which fear index components have genuine predictive power for future
realized volatility.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


@dataclass
class FeatureSelectionResult:
    """Result of LASSO/Elastic Net feature selection."""
    selected_features: list[str]
    coefficients: dict[str, float]
    optimal_alpha: float
    cv_r2_scores: list[float]
    mean_cv_r2: float
    feature_importance: dict[str, float]  # normalized absolute coefficients


def run_lasso_selection(
    features_df: pd.DataFrame,
    target: pd.Series,
    horizon: str = "7d",
    n_splits: int = 5,
    alpha_range: Optional[np.ndarray] = None,
) -> FeatureSelectionResult:
    """Run LASSO feature selection with walk-forward cross-validation.

    Parameters
    ----------
    features_df : DataFrame
        Columns = individual fear index components/indicators.
    target : Series
        Forward-looking realized vol (from targets.py).
    horizon : str
        Label for the target horizon ('1d', '7d', '30d').
    n_splits : int
        Number of walk-forward CV splits.
    alpha_range : ndarray, optional
        LASSO regularization strengths to test.

    Returns
    -------
    FeatureSelectionResult with selected features and coefficients.
    """
    from sklearn.linear_model import LassoCV
    from sklearn.preprocessing import StandardScaler
    from sklearn.model_selection import TimeSeriesSplit

    # Align features and target, drop NaN
    combined = features_df.join(target.rename("target")).dropna()
    if len(combined) < 50:
        logger.warning("Too few observations (%d) for feature selection", len(combined))
        return FeatureSelectionResult(
            selected_features=[],
            coefficients={},
            optimal_alpha=0.0,
            cv_r2_scores=[],
            mean_cv_r2=0.0,
            feature_importance={},
        )

    X = combined.drop(columns=["target"])
    y = combined["target"]

    # Standardize
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Walk-forward CV
    tscv = TimeSeriesSplit(n_splits=n_splits)

    if alpha_range is None:
        alpha_range = np.logspace(-4, 1, 50)

    model = LassoCV(
        alphas=alpha_range,
        cv=tscv,
        max_iter=10000,
        random_state=42,
    )
    model.fit(X_scaled, y)

    # Extract results
    coefs = dict(zip(X.columns, model.coef_))
    selected = [f for f, c in coefs.items() if abs(c) > 1e-8]

    # Normalized importance (absolute coefficients summing to 1)
    abs_coefs = {f: abs(c) for f, c in coefs.items() if abs(c) > 1e-8}
    total = sum(abs_coefs.values()) or 1.0
    importance = {f: v / total for f, v in abs_coefs.items()}

    # CV R² scores
    cv_scores = []
    for train_idx, test_idx in tscv.split(X_scaled):
        from sklearn.linear_model import Lasso
        fold_model = Lasso(alpha=model.alpha_, max_iter=10000)
        fold_model.fit(X_scaled[train_idx], y.iloc[train_idx])
        score = fold_model.score(X_scaled[test_idx], y.iloc[test_idx])
        cv_scores.append(score)

    result = FeatureSelectionResult(
        selected_features=selected,
        coefficients=coefs,
        optimal_alpha=model.alpha_,
        cv_r2_scores=cv_scores,
        mean_cv_r2=np.mean(cv_scores),
        feature_importance=importance,
    )

    logger.info(
        "LASSO (%s horizon): selected %d/%d features, CV R²=%.4f",
        horizon, len(selected), len(X.columns), result.mean_cv_r2,
    )
    return result


def run_elastic_net_selection(
    features_df: pd.DataFrame,
    target: pd.Series,
    l1_ratio: float = 0.5,
    n_splits: int = 5,
) -> FeatureSelectionResult:
    """Run Elastic Net feature selection (LASSO + Ridge blend).

    Parameters
    ----------
    l1_ratio : float
        Mix between L1 (LASSO) and L2 (Ridge). 1.0 = pure LASSO.
    """
    from sklearn.linear_model import ElasticNetCV
    from sklearn.preprocessing import StandardScaler
    from sklearn.model_selection import TimeSeriesSplit

    combined = features_df.join(target.rename("target")).dropna()
    if len(combined) < 50:
        return FeatureSelectionResult(
            selected_features=[], coefficients={}, optimal_alpha=0.0,
            cv_r2_scores=[], mean_cv_r2=0.0, feature_importance={},
        )

    X = combined.drop(columns=["target"])
    y = combined["target"]

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    tscv = TimeSeriesSplit(n_splits=n_splits)

    model = ElasticNetCV(
        l1_ratio=l1_ratio,
        cv=tscv,
        max_iter=10000,
        random_state=42,
    )
    model.fit(X_scaled, y)

    coefs = dict(zip(X.columns, model.coef_))
    selected = [f for f, c in coefs.items() if abs(c) > 1e-8]
    abs_coefs = {f: abs(c) for f, c in coefs.items() if abs(c) > 1e-8}
    total = sum(abs_coefs.values()) or 1.0
    importance = {f: v / total for f, v in abs_coefs.items()}

    return FeatureSelectionResult(
        selected_features=selected,
        coefficients=coefs,
        optimal_alpha=model.alpha_,
        cv_r2_scores=[],
        mean_cv_r2=0.0,
        feature_importance=importance,
    )


def build_feature_matrix(
    fear_index_history: pd.DataFrame,
) -> pd.DataFrame:
    """Build the feature matrix from fear index component history.

    Expected columns in fear_index_history:
    - fear_value, implied_vol, distribution_skew, distribution_kurtosis
    - aave_contribution, maker_contribution, hyperliquid_contribution
    - curve_imbalance, steth_discount, gas_stress, funding_signal, bridge_signal
    - max_cascade_depth

    Returns standardized feature DataFrame.
    """
    feature_cols = [
        "fear_value", "implied_vol", "distribution_skew", "distribution_kurtosis",
        "aave_contribution", "maker_contribution", "hyperliquid_contribution",
        "curve_imbalance", "steth_discount", "gas_stress",
        "funding_signal", "bridge_signal", "max_cascade_depth",
    ]

    available = [c for c in feature_cols if c in fear_index_history.columns]
    if not available:
        logger.warning("No feature columns found in history DataFrame")
        return pd.DataFrame()

    return fear_index_history[available].copy()
