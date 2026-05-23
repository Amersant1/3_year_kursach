"""Analytics orchestration (async) — loads data, calls the pure math.

Every screen-level computation the frontend did now has a backend entry point
here: portfolio valuation, equity series, risk metrics, correlation, the MPT
frontier, Monte-Carlo, concentration, comparison, per-position PnL, and
fundamental valuation. Routers stay thin and call these (SPEC §5).
"""

from __future__ import annotations

from decimal import Decimal

import numpy as np

from app.config import settings
from app.core.errors import NotFoundError
from app.models import (
    Asset,
    AssetFundamentals,
    PriceBar,
    Portfolio,
    Position,
    User,
)
from app.services import market_data
from app.services.analytics import (
    compare,
    concentration,
    correlation,
    frontier,
    fundamental,
    metrics,
    montecarlo,
    valuation,
)
from app.services.analytics.core import annualized_return, annualized_volatility, simple_returns


# --------------------------------------------------------------------------
# Position valuation
# --------------------------------------------------------------------------
async def _open_positions(user: User, portfolio_id: int | None) -> list[Position]:
    qs = Position.filter(user_id=user.id, is_closed=False)
    if portfolio_id is not None:
        qs = qs.filter(portfolio_id=portfolio_id)
    return await qs


async def _day_change(asset_id: int, quote_change) -> Decimal | None:
    if quote_change is not None:
        return quote_change
    bars = await PriceBar.filter(asset_id=asset_id).order_by("-day").limit(2)
    if len(bars) == 2 and bars[1].close != 0:
        return bars[0].close / bars[1].close - 1
    return None


async def _current_price(asset_id: int, quote, entry_price: Decimal) -> Decimal:
    if quote is not None:
        return quote.price
    last = await PriceBar.filter(asset_id=asset_id).order_by("-day").first()
    return last.close if last else entry_price


async def _value_records(positions: list[Position]) -> list[dict]:
    """Value a list of position objects into base-currency records."""
    if not positions:
        return []
    asset_ids = [p.asset_id for p in positions]
    assets = {a.id: a for a in await Asset.filter(id__in=asset_ids)}
    quotes = await market_data.load_quotes(asset_ids)

    records: list[dict] = []
    for p in positions:
        asset = assets[p.asset_id]
        quote = quotes.get(p.asset_id)
        price = await _current_price(p.asset_id, quote, p.entry_price)
        price_fx = await market_data.fx_to_base(asset.currency)
        cost_fx = await market_data.fx_to_base(p.currency)
        change = await _day_change(p.asset_id, quote.change_24h if quote else None)
        v = valuation.value_position(
            quantity=p.quantity,
            current_price=price,
            price_fx=price_fx,
            entry_price=p.entry_price,
            cost_fx=cost_fx,
            day_change=change,
        )
        records.append(
            {
                **v,
                "position_id": p.id,
                "asset_id": asset.id,
                "portfolio_id": p.portfolio_id,
                "symbol": asset.symbol,
                "label": asset.symbol,
                "name": asset.name,
                "asset_class": asset.asset_class.value,
                "sector": asset.sector,
                "region": asset.region,
                "currency": asset.currency,
                "value": float(v["market_value"]),
            }
        )
    return records


async def valued_positions(user: User, portfolio_id: int | None) -> list[dict]:
    """Valued records for the user's open positions (optionally one portfolio)."""
    positions = await _open_positions(user, portfolio_id)
    return await _value_records(positions)


async def value_portfolio(user: User, portfolio_id: int) -> dict:
    """Total value, cost, PnL and per-position breakdown (dashboard endpoint)."""
    records = await valued_positions(user, portfolio_id)
    agg = valuation.aggregate_portfolio(records)
    return {**agg, "holdings": records}


async def position_pnl(user: User, position_id: int) -> dict:
    pos = await Position.get_or_none(id=position_id, user_id=user.id)
    if pos is None:
        raise NotFoundError("Position not found", code="position_not_found")
    asset = await Asset.get(id=pos.asset_id)
    quotes = await market_data.load_quotes([pos.asset_id])
    quote = quotes.get(pos.asset_id)
    price = await _current_price(pos.asset_id, quote, pos.entry_price)
    price_fx = await market_data.fx_to_base(asset.currency)
    cost_fx = await market_data.fx_to_base(pos.currency)
    change = await _day_change(pos.asset_id, quote.change_24h if quote else None)
    return valuation.value_position(
        quantity=pos.quantity,
        current_price=price,
        price_fx=price_fx,
        entry_price=pos.entry_price,
        cost_fx=cost_fx,
        day_change=change,
    )


# --------------------------------------------------------------------------
# Equity series & metrics
# --------------------------------------------------------------------------
async def _portfolio_assets(user: User, portfolio_id: int) -> dict[int, Decimal]:
    """asset_id -> total open quantity for a portfolio."""
    positions = await _open_positions(user, portfolio_id)
    qty: dict[int, Decimal] = {}
    for p in positions:
        qty[p.asset_id] = qty.get(p.asset_id, Decimal(0)) + p.quantity
    return qty


async def portfolio_series(
    user: User, portfolio_id: int, *, days: int | None = None
) -> dict:
    """Reconstruct the equity curve from current holdings × price history.

    Mirrors ``data.js portfolioSeries``: value(day) = Σ qty · close_base(day).
    """
    qty = await _portfolio_assets(user, portfolio_id)
    if not qty:
        return {"dates": [], "values": []}
    aligned = await market_data.load_aligned_prices(list(qty), days=days)
    if aligned.n_days == 0:
        return {"dates": [], "values": []}
    weights = np.array([float(qty[aid]) for aid in aligned.asset_ids])
    values = aligned.matrix @ weights
    return {
        "dates": [d.isoformat() for d in aligned.dates],
        "values": values.tolist(),
    }


async def benchmark_series(days: int | None = None) -> np.ndarray | None:
    """Daily closes of the configured benchmark asset, base-currency."""
    bench = await Asset.filter(symbol=settings.benchmark_symbol).first()
    if bench is None:
        return None
    aligned = await market_data.load_aligned_prices([bench.id], days=days)
    if aligned.n_days == 0:
        return None
    return aligned.column(bench.id)


async def portfolio_metrics(
    user: User, portfolio_id: int, *, days: int | None = None
) -> dict:
    series = await portfolio_series(user, portfolio_id, days=days)
    values = np.array(series["values"], dtype=float)
    if values.size < 2:
        raise NotFoundError(
            "Not enough price history to compute metrics",
            code="insufficient_history",
        )
    bench = await benchmark_series(days)
    result = metrics.compute_all(
        values, rf=settings.risk_free_rate, benchmark_prices=bench
    )
    result["drawdown_series"] = metrics.drawdown_series(values).tolist()
    result["dates"] = series["dates"]
    return result


# --------------------------------------------------------------------------
# Correlation / frontier / Monte-Carlo
# --------------------------------------------------------------------------
async def correlation_matrix(user: User, portfolio_id: int) -> dict:
    qty = await _portfolio_assets(user, portfolio_id)
    if not qty:
        return {"labels": [], "matrix": [], "most_correlated": [], "best_diversifiers": []}
    aligned = await market_data.load_aligned_prices(list(qty), drop_constant=True)
    if aligned.n_days < 2 or len(aligned.asset_ids) < 2:
        return {"labels": [], "matrix": [], "most_correlated": [], "best_diversifiers": []}
    assets = {a.id: a for a in await Asset.filter(id__in=aligned.asset_ids)}
    labels = [assets[aid].symbol for aid in aligned.asset_ids]
    matrix = correlation.correlation_matrix(aligned.matrix)
    pairs = correlation.top_pairs(labels, matrix)
    return {
        "labels": labels,
        "matrix": matrix.tolist(),
        **pairs,
    }


async def efficient_frontier(
    user: User,
    portfolio_id: int,
    *,
    risk_aversion: float = 0.5,
    n_portfolios: int = 600,
) -> dict:
    qty = await _portfolio_assets(user, portfolio_id)
    if len(qty) < 2:
        raise NotFoundError(
            "Need at least two priced assets for a frontier",
            code="insufficient_assets",
        )
    aligned = await market_data.load_aligned_prices(list(qty), drop_constant=True)
    if aligned.n_days < 2 or len(aligned.asset_ids) < 2:
        raise NotFoundError(
            "Not enough price history for a frontier", code="insufficient_history"
        )
    assets = {a.id: a for a in await Asset.filter(id__in=aligned.asset_ids)}
    labels = [assets[aid].symbol for aid in aligned.asset_ids]
    mus = np.array(
        [annualized_return(aligned.matrix[:, i]) for i in range(len(aligned.asset_ids))]
    )
    cov = correlation.covariance_matrix(aligned.matrix)

    # Current weights from market value (qty × last base price).
    last = aligned.matrix[-1]
    values = np.array([float(qty[aid]) for aid in aligned.asset_ids]) * last
    weights = values / values.sum() if values.sum() else None

    result = frontier.efficient_frontier(
        mus,
        cov,
        current_weights=weights,
        rf=settings.risk_free_rate,
        risk_aversion=risk_aversion,
        n_portfolios=n_portfolios,
    )
    result["labels"] = labels
    return result


async def monte_carlo(
    user: User,
    portfolio_id: int,
    *,
    horizon: int = 252,
    n_sims: int = 500,
    target_growth: float = 1.30,
    seed: int = 42,
) -> dict:
    series = await portfolio_series(user, portfolio_id)
    values = np.array(series["values"], dtype=float)
    if values.size < 2:
        raise NotFoundError(
            "Not enough price history for a simulation",
            code="insufficient_history",
        )
    rets = simple_returns(values)
    mu = annualized_return(values)
    sigma = annualized_volatility(rets)
    return montecarlo.simulate(
        start_value=float(values[-1]),
        mu=mu,
        sigma=sigma,
        horizon=horizon,
        n_sims=n_sims,
        target_growth=target_growth,
        seed=seed,
    )


# --------------------------------------------------------------------------
# Concentration / compare / dashboard
# --------------------------------------------------------------------------
async def concentration_report(user: User, portfolio_id: int | None) -> dict:
    records = await valued_positions(user, portfolio_id)
    return {
        "allocation": concentration.allocation(records),
        "by_class": concentration.breakdown(records, "asset_class"),
        "by_currency": concentration.breakdown(records, "currency"),
        "by_region": concentration.breakdown(records, "region"),
        "top3_share": concentration.top_n_share(records, 3),
        "hhi": concentration.herfindahl(records),
        "pnl_decomposition": concentration.pnl_decomposition(records),
        "movers": concentration.movers(records),
        **concentration.winners_losers(records),
    }


async def compare_portfolios(
    user: User,
    portfolio_ids: list[int],
    *,
    days: int | None = None,
    mode: str = "returns",
) -> dict:
    lines: list[dict] = []
    scatter: list[dict] = []
    portfolios = {
        p.id: p
        for p in await Portfolio.filter(id__in=portfolio_ids, user_id=user.id)
    }
    for pid in portfolio_ids:
        portfolio = portfolios.get(pid)
        if portfolio is None:
            continue
        series = await portfolio_series(user, pid, days=days)
        values = np.array(series["values"], dtype=float)
        if values.size < 2:
            continue
        bench = await benchmark_series(days)
        m = metrics.compute_all(
            values, rf=settings.risk_free_rate, benchmark_prices=bench
        )
        lines.append(
            {
                "portfolio_id": pid,
                "name": portfolio.name,
                "dates": series["dates"],
                "series": (
                    compare.normalize_to_base(values)
                    if mode == "returns"
                    else values.tolist()
                ),
                "change": compare.total_change(values),
                "metrics": m,
            }
        )
        scatter.append(
            {
                "portfolio_id": pid,
                "name": portfolio.name,
                "risk": m["volatility"],
                "ret": m["annual_return"],
                "sharpe": m["sharpe"],
            }
        )
    return {"mode": mode, "lines": lines, "scatter": scatter}


async def dashboard(user: User, *, days: int | None = None) -> dict:
    """Aggregate across all of the user's portfolios (dashboard hero)."""
    portfolios = await Portfolio.filter(user_id=user.id)
    records = await valued_positions(user, None)
    agg = valuation.aggregate_portfolio(records)

    # Aggregate equity curve: sum each portfolio's reconstructed series.
    combined: dict[str, float] = {}
    for p in portfolios:
        s = await portfolio_series(user, p.id, days=days)
        for d, v in zip(s["dates"], s["values"]):
            combined[d] = combined.get(d, 0.0) + v
    dates = sorted(combined)
    values = [combined[d] for d in dates]

    range_change = (
        (values[-1] - values[0]) / values[0]
        if len(values) > 1 and values[0]
        else 0.0
    )

    return {
        "total_value": agg["total_value"],
        "total_cost": agg["total_cost"],
        "pnl": agg["pnl"],
        "pnl_pct": agg["pnl_pct"],
        "day_pnl": agg["day_pnl"],
        "day_pct": agg["day_pct"],
        "positions": agg["positions"],
        "portfolios": len(portfolios),
        "series": {"dates": dates, "values": values},
        "range_change": range_change,
        "allocation": concentration.allocation(records),
        "by_class": concentration.breakdown(records, "asset_class"),
        "by_currency": concentration.breakdown(records, "currency"),
        "by_region": concentration.breakdown(records, "region"),
        "top3_share": concentration.top_n_share(records, 3),
        "movers": concentration.movers(records),
        "pnl_decomposition": concentration.pnl_decomposition(records),
        **concentration.winners_losers(records),
    }


# --------------------------------------------------------------------------
# Fundamental valuation
# --------------------------------------------------------------------------
async def asset_valuation(asset_id: int) -> dict:
    asset = await Asset.get_or_none(id=asset_id)
    if asset is None:
        raise NotFoundError("Asset not found", code="asset_not_found")
    fund = await AssetFundamentals.get_or_none(asset_id=asset_id)
    quotes = await market_data.load_quotes([asset_id])
    quote = quotes.get(asset_id)
    current_price = float(quote.price) if quote else None

    fields = {}
    if fund is not None:
        for f in (
            "shares_outstanding",
            "fcf_per_share",
            "fcf_growth",
            "discount_rate",
            "terminal_growth",
            "dividend_per_share",
            "dividend_growth",
            "required_return",
            "beta",
            "risk_free_rate",
            "market_return",
            "strike",
            "time_to_expiry",
            "bs_volatility",
            "bs_rate",
        ):
            val = getattr(fund, f)
            fields[f] = float(val) if val is not None else None
        fields["projection_years"] = fund.projection_years

    result = fundamental.value_asset(
        fields, current_price=current_price, default_rf=settings.risk_free_rate
    )
    result["symbol"] = asset.symbol
    result["has_inputs"] = fund is not None
    return result


# --------------------------------------------------------------------------
# Snapshots (Celery beat — SPEC §4)
# --------------------------------------------------------------------------
async def capture_snapshots() -> int:
    """Append a value snapshot for every portfolio (timeseries for charts).

    User-agnostic: iterates all portfolios and values their open positions.
    Returns the number of snapshots written.
    """
    from datetime import datetime, timezone

    from app.models import PortfolioSnapshot

    now = datetime.now(timezone.utc)
    written = 0
    for portfolio in await Portfolio.all():
        positions = await Position.filter(
            portfolio_id=portfolio.id, is_closed=False
        )
        records = await _value_records(positions)
        total = sum((r["market_value"] for r in records), Decimal(0))
        await PortfolioSnapshot.create(
            portfolio_id=portfolio.id,
            total_value=total,
            currency=settings.base_currency,
            captured_at=now,
        )
        written += 1
    return written
