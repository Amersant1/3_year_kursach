"""Return-series primitives shared by the analytics modules."""

from __future__ import annotations

import numpy as np

# Standard annualization factor (trading days/year). Mirrors the frontend's
# use of 252 in GBM and metric annualization.
TRADING_DAYS = 252


def simple_returns(prices: np.ndarray) -> np.ndarray:
    """Period-over-period simple returns ``p_t/p_{t-1} - 1`` along axis 0."""
    prices = np.asarray(prices, dtype=float)
    return prices[1:] / prices[:-1] - 1.0


def log_returns(prices: np.ndarray) -> np.ndarray:
    """Log returns ``ln(p_t/p_{t-1})`` along axis 0 (used for correlation)."""
    prices = np.asarray(prices, dtype=float)
    return np.log(prices[1:] / prices[:-1])


def annualized_return(prices: np.ndarray, *, periods: int = TRADING_DAYS) -> float:
    """CAGR from first to last price, annualized by series length.

    ``(end/start) ** (periods / n_steps) - 1`` — degrades to the simple total
    return for a ~1y daily series.
    """
    prices = np.asarray(prices, dtype=float)
    if prices.size < 2 or prices[0] <= 0:
        return 0.0
    n = prices.size - 1
    growth = prices[-1] / prices[0]
    if growth <= 0:
        return -1.0
    return float(growth ** (periods / n) - 1.0)


def annualized_volatility(
    returns: np.ndarray, *, periods: int = TRADING_DAYS
) -> float:
    """Std of daily returns annualized by ``sqrt(periods)`` (sample std)."""
    returns = np.asarray(returns, dtype=float)
    if returns.size < 2:
        return 0.0
    return float(np.std(returns, ddof=1) * np.sqrt(periods))


def to_weights(values: np.ndarray) -> np.ndarray:
    """Normalize a vector of position values into weights summing to 1."""
    values = np.asarray(values, dtype=float)
    total = values.sum()
    if total == 0:
        return np.zeros_like(values)
    return values / total
