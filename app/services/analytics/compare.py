"""Portfolio comparison helpers (``screens.jsx CompareScreen``).

Rebasing value series to a common start (=100) for a fair returns
comparison; the risk/return scatter is assembled from per-portfolio metrics
in the service.
"""

from __future__ import annotations

import numpy as np


def normalize_to_base(prices: np.ndarray, base: float = 100.0) -> list[float]:
    """Rebase a value series so its first point equals ``base``."""
    prices = np.asarray(prices, dtype=float)
    if prices.size == 0 or prices[0] == 0:
        return prices.tolist()
    return (prices / prices[0] * base).tolist()


def total_change(prices: np.ndarray) -> float:
    """Total return over the series (end/start − 1)."""
    prices = np.asarray(prices, dtype=float)
    if prices.size < 2 or prices[0] == 0:
        return 0.0
    return float(prices[-1] / prices[0] - 1.0)
