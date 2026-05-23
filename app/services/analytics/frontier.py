"""Markowitz efficient frontier (MPT).

Ports ``analytics.jsx FrontierTab`` but with a **real** covariance matrix
instead of the frontend's flat ρ=0.3 assumption. Generates a cloud of random
long-only portfolios, traces the upper-risk/return envelope, and identifies
the min-variance, max-Sharpe, current and risk-aversion-recommended points.
"""

from __future__ import annotations

import numpy as np


def _portfolio_stats(
    weights: np.ndarray, mus: np.ndarray, cov: np.ndarray
) -> tuple[float, float]:
    ret = float(weights @ mus)
    var = float(weights @ cov @ weights)
    return max(var, 0.0) ** 0.5, ret  # (risk, return)


def efficient_frontier(
    mus: np.ndarray,
    cov: np.ndarray,
    *,
    current_weights: np.ndarray | None = None,
    rf: float = 0.07,
    risk_aversion: float = 0.5,
    n_portfolios: int = 600,
    bins: int = 40,
    seed: int = 99,
) -> dict:
    """Compute the frontier and its reference portfolios.

    Returns the random ``cloud``, the ``frontier`` envelope, and the
    ``current`` / ``max_sharpe`` / ``min_variance`` / ``recommended`` points,
    each as ``{risk, ret, sharpe, weights}``.
    """
    mus = np.asarray(mus, dtype=float)
    cov = np.asarray(cov, dtype=float)
    n = mus.size
    rng = np.random.default_rng(seed)

    # Random long-only weight vectors (Dirichlet == uniform on the simplex).
    weights = rng.dirichlet(np.ones(n), size=n_portfolios)
    cloud = []
    for w in weights:
        risk, ret = _portfolio_stats(w, mus, cov)
        cloud.append({"risk": risk, "ret": ret})

    risks = np.array([p["risk"] for p in cloud])
    rets = np.array([p["ret"] for p in cloud])

    # Upper envelope: best return per risk bin, kept monotonic in return.
    lo, hi = float(risks.min()), float(risks.max())
    frontier: list[dict] = []
    if hi > lo:
        edges = np.linspace(lo, hi, bins + 1)
        for i in range(bins):
            mask = (risks >= edges[i]) & (risks < edges[i + 1])
            if not mask.any():
                continue
            idx = np.where(mask)[0]
            best = idx[np.argmax(rets[idx])]
            frontier.append({"risk": float(risks[best]), "ret": float(rets[best])})
        frontier.sort(key=lambda p: p["risk"])
        monotonic: list[dict] = []
        for p in frontier:
            if not monotonic or p["ret"] >= monotonic[-1]["ret"]:
                monotonic.append(p)
        frontier = monotonic
    if not frontier:
        frontier = [{"risk": float(risks[0]), "ret": float(rets[0])}]

    def with_sharpe(p: dict) -> dict:
        return {**p, "sharpe": (p["ret"] - rf) / p["risk"] if p["risk"] else 0.0}

    sharpes = np.where(risks > 0, (rets - rf) / np.where(risks > 0, risks, 1), -np.inf)
    max_sharpe_i = int(np.argmax(sharpes))
    min_var_i = int(np.argmin(risks))
    max_sharpe = with_sharpe({"risk": float(risks[max_sharpe_i]), "ret": float(rets[max_sharpe_i])})
    max_sharpe["weights"] = weights[max_sharpe_i].tolist()
    min_variance = with_sharpe({"risk": float(risks[min_var_i]), "ret": float(rets[min_var_i])})
    min_variance["weights"] = weights[min_var_i].tolist()

    current = None
    if current_weights is not None:
        cw = np.asarray(current_weights, dtype=float)
        crisk, cret = _portfolio_stats(cw, mus, cov)
        current = with_sharpe({"risk": crisk, "ret": cret})
        current["weights"] = cw.tolist()

    # Recommended: slide along the frontier by risk tolerance (0..1).
    ra = min(max(risk_aversion, 0.0), 1.0)
    rec_idx = round(ra * (len(frontier) - 1))
    recommended = with_sharpe(frontier[rec_idx])

    return {
        "cloud": cloud,
        "frontier": [with_sharpe(p) for p in frontier],
        "current": current,
        "max_sharpe": max_sharpe,
        "min_variance": min_variance,
        "recommended": recommended,
    }
