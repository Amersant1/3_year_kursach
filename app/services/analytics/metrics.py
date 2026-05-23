"""Risk & performance metrics computed from a portfolio value series.

Replaces the frontend's ``metricsFor`` plus the (previously hard-coded)
Sortino / Information Ratio / Beta / VaR / CVaR values in ``analytics.jsx``
with real formulas.
"""

from __future__ import annotations

import numpy as np

from app.services.analytics.core import (
    TRADING_DAYS,
    annualized_return,
    annualized_volatility,
    simple_returns,
)


def max_drawdown(prices: np.ndarray) -> float:
    """Largest peak-to-trough decline as a (negative) fraction."""
    prices = np.asarray(prices, dtype=float)
    if prices.size == 0:
        return 0.0
    running_peak = np.maximum.accumulate(prices)
    drawdowns = prices / running_peak - 1.0
    return float(drawdowns.min())


def drawdown_series(prices: np.ndarray) -> np.ndarray:
    """Per-point drawdown vs the running peak (for the drawdown chart)."""
    prices = np.asarray(prices, dtype=float)
    if prices.size == 0:
        return prices
    return prices / np.maximum.accumulate(prices) - 1.0


def sortino_ratio(
    returns: np.ndarray, *, rf: float, periods: int = TRADING_DAYS
) -> float:
    """(annual return − rf) / annualized downside deviation."""
    returns = np.asarray(returns, dtype=float)
    if returns.size < 2:
        return 0.0
    daily_rf = rf / periods
    downside = np.minimum(returns - daily_rf, 0.0)
    downside_dev = np.sqrt(np.mean(downside**2)) * np.sqrt(periods)
    if downside_dev == 0:
        return 0.0
    ann_ret = float(np.mean(returns) * periods)
    return (ann_ret - rf) / downside_dev


def historical_var(returns: np.ndarray, *, level: float = 0.95) -> float:
    """Historical Value-at-Risk: the (1−level) quantile of daily returns.

    Returned as a (typically negative) return — the loss not exceeded with
    ``level`` confidence on a normal day.
    """
    returns = np.asarray(returns, dtype=float)
    if returns.size == 0:
        return 0.0
    return float(np.quantile(returns, 1.0 - level))


def conditional_var(returns: np.ndarray, *, level: float = 0.95) -> float:
    """CVaR / expected shortfall: mean of returns at or below the VaR cut."""
    returns = np.asarray(returns, dtype=float)
    if returns.size == 0:
        return 0.0
    threshold = historical_var(returns, level=level)
    tail = returns[returns <= threshold]
    return float(tail.mean()) if tail.size else threshold


def beta(returns: np.ndarray, benchmark_returns: np.ndarray) -> float | None:
    """Sensitivity to the benchmark: cov(r, b) / var(b)."""
    r = np.asarray(returns, dtype=float)
    b = np.asarray(benchmark_returns, dtype=float)
    n = min(r.size, b.size)
    if n < 2:
        return None
    r, b = r[-n:], b[-n:]
    var_b = np.var(b, ddof=1)
    if var_b == 0:
        return None
    return float(np.cov(r, b, ddof=1)[0, 1] / var_b)


def information_ratio(
    returns: np.ndarray,
    benchmark_returns: np.ndarray,
    *,
    periods: int = TRADING_DAYS,
) -> float | None:
    """Annualized active return / tracking error vs the benchmark."""
    r = np.asarray(returns, dtype=float)
    b = np.asarray(benchmark_returns, dtype=float)
    n = min(r.size, b.size)
    if n < 2:
        return None
    active = r[-n:] - b[-n:]
    tracking_error = np.std(active, ddof=1) * np.sqrt(periods)
    if tracking_error == 0:
        return None
    return float(np.mean(active) * periods / tracking_error)


def compute_all(
    prices: np.ndarray,
    *,
    rf: float,
    benchmark_prices: np.ndarray | None = None,
    periods: int = TRADING_DAYS,
) -> dict:
    """Full metric bundle for one value series (mirrors the Risk-metrics tab)."""
    prices = np.asarray(prices, dtype=float)
    rets = simple_returns(prices)
    ann_ret = annualized_return(prices, periods=periods)
    vol = annualized_volatility(rets, periods=periods)
    mdd = max_drawdown(prices)
    sharpe = (ann_ret - rf) / vol if vol else 0.0

    bench_rets = (
        simple_returns(np.asarray(benchmark_prices, dtype=float))
        if benchmark_prices is not None and len(benchmark_prices) > 1
        else None
    )

    return {
        "annual_return": ann_ret,
        "volatility": vol,
        "sharpe": sharpe,
        "sortino": sortino_ratio(rets, rf=rf, periods=periods),
        "max_drawdown": mdd,
        "calmar": (ann_ret / abs(mdd)) if mdd else 0.0,
        "var_95": historical_var(rets, level=0.95),
        "cvar_95": conditional_var(rets, level=0.95),
        "beta": beta(rets, bench_rets) if bench_rets is not None else None,
        "information_ratio": (
            information_ratio(rets, bench_rets, periods=periods)
            if bench_rets is not None
            else None
        ),
        "best_day": float(rets.max()) if rets.size else 0.0,
        "worst_day": float(rets.min()) if rets.size else 0.0,
        "positive_days": (
            float(np.mean(rets > 0)) if rets.size else 0.0
        ),
    }
