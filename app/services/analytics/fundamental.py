"""Fundamental valuation models — DCF, Gordon, CAPM, Black-Scholes.

Real formulas (the frontend only showed placeholder multiples). Inputs come
from ``AssetFundamentals``; a model is computed only when its required inputs
are present, otherwise it returns ``None``. Math is done in float — these are
analytical estimates, not exact ledger money.
"""

from __future__ import annotations

import math


def _f(x) -> float | None:
    return None if x is None else float(x)


def _norm_cdf(x: float) -> float:
    """Standard normal CDF via the error function (no scipy dependency)."""
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


def capm_expected_return(
    rf: float | None, beta: float | None, market_return: float | None
) -> float | None:
    """CAPM: E(R) = rf + β·(E(Rm) − rf)."""
    rf, beta, mr = _f(rf), _f(beta), _f(market_return)
    if rf is None or beta is None or mr is None:
        return None
    return rf + beta * (mr - rf)


def gordon_value(
    dividend: float | None,
    growth: float | None,
    required_return: float | None,
) -> float | None:
    """Gordon growth (DDM): V = D₁/(r − g), D₁ = D₀·(1+g). Needs r > g."""
    d0, g, r = _f(dividend), _f(growth), _f(required_return)
    if d0 is None or g is None or r is None or r <= g:
        return None
    return d0 * (1.0 + g) / (r - g)


def dcf_value(
    fcf_per_share: float | None,
    growth: float | None,
    discount_rate: float | None,
    terminal_growth: float | None,
    years: int | None,
) -> float | None:
    """Discounted cash flow per share with a Gordon terminal value.

    V = Σᵢ FCF·(1+g)ⁱ/(1+r)ⁱ  +  TV/(1+r)ⁿ,  TV = FCFₙ·(1+tg)/(r−tg).
    """
    fcf, g, r = _f(fcf_per_share), _f(growth), _f(discount_rate)
    tg = _f(terminal_growth)
    n = int(years) if years else 5
    if fcf is None or g is None or r is None or tg is None or r <= tg or r <= -1:
        return None
    pv = 0.0
    cash = fcf
    for i in range(1, n + 1):
        cash = fcf * (1.0 + g) ** i
        pv += cash / (1.0 + r) ** i
    terminal = cash * (1.0 + tg) / (r - tg)
    pv += terminal / (1.0 + r) ** n
    return pv


def black_scholes(
    spot: float | None,
    strike: float | None,
    time_to_expiry: float | None,
    rate: float | None,
    volatility: float | None,
    *,
    option: str = "call",
) -> dict | None:
    """Black-Scholes European option price + delta."""
    S, K, t = _f(spot), _f(strike), _f(time_to_expiry)
    r, sigma = _f(rate), _f(volatility)
    if None in (S, K, t, r, sigma) or S <= 0 or K <= 0 or t <= 0 or sigma <= 0:
        return None
    d1 = (math.log(S / K) + (r + 0.5 * sigma**2) * t) / (sigma * math.sqrt(t))
    d2 = d1 - sigma * math.sqrt(t)
    if option == "put":
        price = K * math.exp(-r * t) * _norm_cdf(-d2) - S * _norm_cdf(-d1)
        delta = _norm_cdf(d1) - 1.0
    else:
        price = S * _norm_cdf(d1) - K * math.exp(-r * t) * _norm_cdf(d2)
        delta = _norm_cdf(d1)
    return {"option": option, "price": price, "d1": d1, "d2": d2, "delta": delta}


def _upside(value: float | None, current_price: float | None) -> float | None:
    if value is None or not current_price:
        return None
    return value / current_price - 1.0


def value_asset(fund: dict, *, current_price: float | None, default_rf: float) -> dict:
    """Run every model whose inputs are present and report upside vs price.

    ``fund`` is a dict of ``AssetFundamentals`` fields (floats / None).
    """
    # ``.get(k, default)`` won't help when the key is present but None
    # (unset fundamental), so coalesce explicitly.
    rf = fund.get("risk_free_rate")
    rf = default_rf if rf is None else rf
    bs_rate = fund.get("bs_rate")
    bs_rate = default_rf if bs_rate is None else bs_rate

    capm = capm_expected_return(rf, fund.get("beta"), fund.get("market_return"))
    # Gordon required return falls back to CAPM expected return.
    required = fund.get("required_return")
    if required is None:
        required = capm

    dcf = dcf_value(
        fund.get("fcf_per_share"),
        fund.get("fcf_growth"),
        fund.get("discount_rate"),
        fund.get("terminal_growth"),
        fund.get("projection_years"),
    )
    gordon = gordon_value(
        fund.get("dividend_per_share"),
        fund.get("dividend_growth"),
        required,
    )
    bs = black_scholes(
        current_price,
        fund.get("strike"),
        fund.get("time_to_expiry"),
        bs_rate,
        fund.get("bs_volatility"),
    )

    return {
        "current_price": current_price,
        "capm_expected_return": capm,
        "dcf": {"value": dcf, "upside": _upside(dcf, current_price)},
        "gordon": {
            "value": gordon,
            "upside": _upside(gordon, current_price),
            "required_return": required,
        },
        "black_scholes": bs,
    }
