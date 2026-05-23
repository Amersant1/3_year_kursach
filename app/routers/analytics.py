"""Analytics & dashboard endpoints.

Portfolio-scoped computations plus cross-portfolio compare and the aggregate
dashboard. Routers stay thin — all logic is in ``analytics_service`` (SPEC §5).
Ownership is enforced via ``portfolio_service.get_for_user`` (404, not 403,
so others' portfolios aren't revealed).
"""

from fastapi import APIRouter, Depends, Query

from app.core.deps import get_current_user
from app.models import User
from app.schemas.analytics import (
    CompareOut,
    ConcentrationOut,
    CorrelationOut,
    DashboardOut,
    FrontierOut,
    MetricsOut,
    MonteCarloOut,
    PortfolioValuationOut,
    SeriesOut,
)
from app.services import analytics_service, portfolio_service

router = APIRouter(tags=["analytics"])


async def _owned(user: User, portfolio_id: int) -> None:
    await portfolio_service.get_for_user(user=user, portfolio_id=portfolio_id)


@router.get(
    "/portfolios/{portfolio_id}/valuation",
    response_model=PortfolioValuationOut,
    summary="Portfolio value, cost, PnL and per-position breakdown",
)
async def valuation(
    portfolio_id: int, user: User = Depends(get_current_user)
) -> PortfolioValuationOut:
    await _owned(user, portfolio_id)
    return PortfolioValuationOut.model_validate(
        await analytics_service.value_portfolio(user, portfolio_id)
    )


@router.get(
    "/portfolios/{portfolio_id}/series",
    response_model=SeriesOut,
    summary="Reconstructed equity curve (current holdings × price history)",
)
async def series(
    portfolio_id: int,
    days: int | None = Query(default=None, ge=2, le=3650),
    user: User = Depends(get_current_user),
) -> SeriesOut:
    await _owned(user, portfolio_id)
    return SeriesOut.model_validate(
        await analytics_service.portfolio_series(user, portfolio_id, days=days)
    )


@router.get(
    "/portfolios/{portfolio_id}/metrics",
    response_model=MetricsOut,
    summary="Risk/return metrics (Sharpe, Sortino, VaR, Beta, drawdown, …)",
)
async def metrics(
    portfolio_id: int,
    days: int | None = Query(default=None, ge=2, le=3650),
    user: User = Depends(get_current_user),
) -> MetricsOut:
    await _owned(user, portfolio_id)
    return MetricsOut.model_validate(
        await analytics_service.portfolio_metrics(user, portfolio_id, days=days)
    )


@router.get(
    "/portfolios/{portfolio_id}/correlation",
    response_model=CorrelationOut,
    summary="Asset correlation matrix + top pairs / diversifiers",
)
async def correlation(
    portfolio_id: int, user: User = Depends(get_current_user)
) -> CorrelationOut:
    await _owned(user, portfolio_id)
    return CorrelationOut.model_validate(
        await analytics_service.correlation_matrix(user, portfolio_id)
    )


@router.get(
    "/portfolios/{portfolio_id}/frontier",
    response_model=FrontierOut,
    summary="Markowitz efficient frontier (MPT)",
)
async def frontier(
    portfolio_id: int,
    risk_aversion: float = Query(default=0.5, ge=0.0, le=1.0),
    n_portfolios: int = Query(default=600, ge=50, le=5000),
    user: User = Depends(get_current_user),
) -> FrontierOut:
    await _owned(user, portfolio_id)
    return FrontierOut.model_validate(
        await analytics_service.efficient_frontier(
            user,
            portfolio_id,
            risk_aversion=risk_aversion,
            n_portfolios=n_portfolios,
        )
    )


@router.get(
    "/portfolios/{portfolio_id}/montecarlo",
    response_model=MonteCarloOut,
    summary="Monte-Carlo value projection",
)
async def monte_carlo(
    portfolio_id: int,
    horizon: int = Query(default=252, ge=2, le=2520),
    n_sims: int = Query(default=500, ge=50, le=5000),
    target_growth: float = Query(default=1.30, ge=0.5, le=5.0),
    seed: int = Query(default=42),
    user: User = Depends(get_current_user),
) -> MonteCarloOut:
    await _owned(user, portfolio_id)
    return MonteCarloOut.model_validate(
        await analytics_service.monte_carlo(
            user,
            portfolio_id,
            horizon=horizon,
            n_sims=n_sims,
            target_growth=target_growth,
            seed=seed,
        )
    )


@router.get(
    "/portfolios/{portfolio_id}/concentration",
    response_model=ConcentrationOut,
    summary="Concentration, allocation breakdowns, P&L decomposition, movers",
)
async def concentration(
    portfolio_id: int, user: User = Depends(get_current_user)
) -> ConcentrationOut:
    await _owned(user, portfolio_id)
    return ConcentrationOut.model_validate(
        await analytics_service.concentration_report(user, portfolio_id)
    )


@router.get(
    "/analytics/compare",
    response_model=CompareOut,
    summary="Compare portfolios (normalized returns + risk/return scatter)",
)
async def compare(
    portfolio_ids: list[int] = Query(..., alias="portfolio_id"),
    mode: str = Query(default="returns", pattern="^(returns|value)$"),
    days: int | None = Query(default=None, ge=2, le=3650),
    user: User = Depends(get_current_user),
) -> CompareOut:
    for pid in portfolio_ids:
        await _owned(user, pid)
    return CompareOut.model_validate(
        await analytics_service.compare_portfolios(
            user, portfolio_ids, days=days, mode=mode
        )
    )


@router.get(
    "/dashboard",
    response_model=DashboardOut,
    summary="Aggregate dashboard across all portfolios",
)
async def dashboard(
    days: int | None = Query(default=None, ge=2, le=3650),
    user: User = Depends(get_current_user),
) -> DashboardOut:
    return DashboardOut.model_validate(
        await analytics_service.dashboard(user, days=days)
    )
