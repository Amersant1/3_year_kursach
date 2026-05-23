"""Correlation & covariance matrices on log returns.

Mirrors ``data.js corrMatrix`` (Pearson on log returns) and supplies the
annualized covariance matrix the efficient frontier needs (the frontend
faked it with a flat ρ=0.3 — here it is the real sample covariance).
"""

from __future__ import annotations

import numpy as np

from app.services.analytics.core import TRADING_DAYS, log_returns


def correlation_matrix(price_matrix: np.ndarray) -> np.ndarray:
    """Pearson correlation of asset log returns. ``price_matrix`` is
    (n_days, n_assets); returns (n_assets, n_assets)."""
    price_matrix = np.asarray(price_matrix, dtype=float)
    rets = log_returns(price_matrix)
    if rets.shape[0] < 2:
        n = price_matrix.shape[1]
        return np.eye(n)
    corr = np.corrcoef(rets, rowvar=False)
    return np.atleast_2d(corr)


def covariance_matrix(
    price_matrix: np.ndarray, *, periods: int = TRADING_DAYS
) -> np.ndarray:
    """Annualized covariance of asset log returns (n_assets, n_assets)."""
    price_matrix = np.asarray(price_matrix, dtype=float)
    rets = log_returns(price_matrix)
    if rets.shape[0] < 2:
        n = price_matrix.shape[1]
        return np.zeros((n, n))
    cov = np.cov(rets, rowvar=False, ddof=1) * periods
    return np.atleast_2d(cov)


def pair_list(labels: list[str], matrix: np.ndarray) -> list[dict]:
    """Flatten the upper triangle into labelled pairs (i<j)."""
    matrix = np.asarray(matrix, dtype=float)
    out: list[dict] = []
    n = len(labels)
    for i in range(n):
        for j in range(i + 1, n):
            out.append({"a": labels[i], "b": labels[j], "value": float(matrix[i, j])})
    return out


def top_pairs(
    labels: list[str], matrix: np.ndarray, *, n: int = 3
) -> dict:
    """Most-correlated pairs and best diversifiers (lowest correlation)."""
    pairs = pair_list(labels, matrix)
    by_value = sorted(pairs, key=lambda p: p["value"], reverse=True)
    return {
        "most_correlated": by_value[:n],
        "best_diversifiers": by_value[-n:][::-1],
    }
