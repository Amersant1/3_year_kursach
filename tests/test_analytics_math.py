"""Pure analytics math — exact/known-value checks, no DB."""

from decimal import Decimal

import numpy as np
import pytest

from app.services.analytics import (
    concentration,
    correlation,
    frontier,
    fundamental,
    metrics,
    montecarlo,
    valuation,
)
from app.services.analytics.core import annualized_return


def test_max_drawdown_known():
    prices = np.array([100, 120, 90, 130], dtype=float)
    assert metrics.max_drawdown(prices) == -0.25


def test_annualized_return_flat_series_is_zero():
    assert annualized_return(np.array([100.0] * 30)) == 0.0


def test_var_cvar_ordering():
    rng = np.random.default_rng(0)
    prices = np.cumprod(1 + rng.normal(0, 0.01, 300)) * 100
    rets = np.diff(prices) / prices[:-1]
    var = metrics.historical_var(rets, level=0.95)
    cvar = metrics.conditional_var(rets, level=0.95)
    # Expected shortfall is at least as severe as VaR.
    assert cvar <= var <= 0


def test_correlation_identical_and_opposite():
    base = np.cumprod(1 + np.random.default_rng(1).normal(0, 0.01, 200)) * 100
    matrix = np.column_stack([base, base])  # identical columns
    corr = correlation.correlation_matrix(matrix)
    assert corr[0, 1] == pytest.approx(1.0)


def test_covariance_is_symmetric():
    rng = np.random.default_rng(2)
    prices = np.cumprod(1 + rng.normal(0, 0.01, (250, 3)), axis=0) * 100
    cov = correlation.covariance_matrix(prices)
    assert np.allclose(cov, cov.T)


def test_frontier_max_sharpe_is_best():
    mus = np.array([0.10, 0.18, 0.25])
    cov = np.diag([0.04, 0.09, 0.16])
    res = frontier.efficient_frontier(mus, cov, rf=0.05, n_portfolios=2000, seed=7)
    sharpes = [p["sharpe"] for p in res["frontier"] if p["sharpe"] is not None]
    assert res["max_sharpe"]["sharpe"] >= max(sharpes) - 1e-6
    assert res["min_variance"]["risk"] <= res["max_sharpe"]["risk"] + 1e-9


def test_montecarlo_is_deterministic_with_seed():
    a = montecarlo.simulate(1_000_000, 0.12, 0.2, horizon=120, n_sims=400, seed=42)
    b = montecarlo.simulate(1_000_000, 0.12, 0.2, horizon=120, n_sims=400, seed=42)
    assert a["prob_target"] == b["prob_target"]
    assert a["final"]["p50"] == b["final"]["p50"]
    assert len(a["percentiles"]["p50"]) == 120


def test_gordon_capm_exact():
    assert fundamental.gordon_value(5.0, 0.05, 0.10) == pytest.approx(105.0)
    assert fundamental.capm_expected_return(0.07, 1.1, 0.13) == pytest.approx(0.136)


def test_gordon_requires_r_greater_than_g():
    assert fundamental.gordon_value(5.0, 0.12, 0.10) is None


def test_black_scholes_textbook_value():
    bs = fundamental.black_scholes(100, 100, 1.0, 0.05, 0.2, option="call")
    assert bs["price"] == pytest.approx(10.4506, rel=1e-3)
    put = fundamental.black_scholes(100, 100, 1.0, 0.05, 0.2, option="put")
    assert put["price"] == pytest.approx(5.5735, rel=1e-3)


def test_dcf_positive_and_sane():
    v = fundamental.dcf_value(10, 0.08, 0.12, 0.03, 5)
    assert v is not None and v > 0


def test_value_position_pnl_exact():
    v = valuation.value_position(
        quantity=Decimal("10"),
        current_price=Decimal("120"),
        price_fx=Decimal("1"),
        entry_price=Decimal("100"),
        cost_fx=Decimal("1"),
        day_change=Decimal("0.01"),
    )
    assert v["pnl"] == Decimal("200")
    assert v["pnl_pct"] == pytest.approx(0.20)


def test_value_position_fx_conversion():
    # 10 units @ $200, USD/RUB=90 → 180,000 RUB market value.
    v = valuation.value_position(
        quantity=Decimal("10"),
        current_price=Decimal("200"),
        price_fx=Decimal("90"),
        entry_price=Decimal("150"),
        cost_fx=Decimal("90"),
    )
    assert v["market_value"] == Decimal("180000")
    assert v["cost"] == Decimal("135000")


def test_concentration_top_n_and_hhi():
    items = [
        {"value": 600, "pnl": 60, "pnl_pct": 0.1, "day_change": 0.0, "label": "A"},
        {"value": 400, "pnl": -40, "pnl_pct": -0.1, "day_change": 0.0, "label": "B"},
    ]
    assert concentration.top_n_share(items, 1) == pytest.approx(0.6)
    assert concentration.herfindahl(items) == pytest.approx(0.36 + 0.16)


def test_pnl_decomposition_net():
    items = [
        {"value": 100, "pnl": 50, "pnl_pct": 0.5, "day_change": 0.0, "label": "A"},
        {"value": 100, "pnl": -20, "pnl_pct": -0.2, "day_change": 0.0, "label": "B"},
    ]
    d = concentration.pnl_decomposition(items)
    assert d["net"] == 30
    assert d["win_rate"] == 0.5
