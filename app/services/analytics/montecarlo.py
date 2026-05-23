"""Monte-Carlo portfolio simulation (GBM).

Ports ``analytics.jsx MonteCarloTab``: stochastic value paths from the
portfolio's historical μ and σ, percentile fan (p10..p90), probability of
reaching a target, VaR and the final-value distribution. Vectorized with a
seeded numpy RNG so results are reproducible.
"""

from __future__ import annotations

import numpy as np

from app.services.analytics.core import TRADING_DAYS

_PERCENTILES = (10, 25, 50, 75, 90)


def simulate(
    start_value: float,
    mu: float,
    sigma: float,
    *,
    horizon: int = TRADING_DAYS,
    n_sims: int = 500,
    target_growth: float = 1.30,
    periods: int = TRADING_DAYS,
    seed: int = 42,
    max_sample_paths: int = 40,
    hist_bins: int = 40,
) -> dict:
    """Run the simulation and summarize it.

    ``mu``/``sigma`` are annualized. Daily step ``r = mu/periods +
    sigma/sqrt(periods) * z`` exactly as the frontend, ``V_t = V_{t-1}(1+r)``.
    """
    horizon = max(int(horizon), 2)
    n_sims = max(int(n_sims), 1)
    rng = np.random.default_rng(seed)

    drift = mu / periods
    shock = sigma / np.sqrt(periods)
    z = rng.standard_normal(size=(n_sims, horizon - 1))
    step_returns = drift + shock * z
    growth = np.cumprod(1.0 + step_returns, axis=1)
    paths = np.empty((n_sims, horizon), dtype=float)
    paths[:, 0] = start_value
    paths[:, 1:] = start_value * growth

    # Percentile bands per day.
    pct_bands = {
        f"p{p}": np.percentile(paths, p, axis=0).tolist() for p in _PERCENTILES
    }

    final = paths[:, -1]
    target = start_value * target_growth
    prob_target = float(np.mean(final >= target))

    counts, edges = np.histogram(final, bins=hist_bins)

    # A handful of raw paths for the fan chart (keeps payload small).
    sample = paths[:: max(1, n_sims // max_sample_paths)][:max_sample_paths]

    p10_final = float(np.percentile(final, 10))
    return {
        "start_value": float(start_value),
        "horizon": horizon,
        "n_sims": n_sims,
        "target": float(target),
        "target_growth": float(target_growth),
        "prob_target": prob_target,
        "percentiles": pct_bands,
        "final": {
            "p10": p10_final,
            "p50": float(np.percentile(final, 50)),
            "p90": float(np.percentile(final, 90)),
            "mean": float(final.mean()),
            "min": float(final.min()),
            "max": float(final.max()),
        },
        # VaR 5%: worst-case return at the 10th percentile of outcomes
        # (matches the frontend's "VaR 5%" readout).
        "var_5": p10_final / start_value - 1.0,
        "histogram": {
            "counts": counts.tolist(),
            "edges": edges.tolist(),
        },
        "sample_paths": sample.tolist(),
    }
