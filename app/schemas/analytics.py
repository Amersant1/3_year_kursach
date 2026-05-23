"""Response schemas for the analytics & dashboard endpoints.

Typed end to end so OpenAPI stays accurate (SPEC §5/§7) — money is Decimal,
ratios are float, timeseries are lists. Built from the dicts returned by
``app.services.analytics_service`` via ``model_validate``.
"""

from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel


# --- shared rows ---
class BreakdownRow(BaseModel):
    label: str
    value: float
    share: float


class ContributorRow(BaseModel):
    label: str
    value: float


class PairOut(BaseModel):
    a: str
    b: str
    value: float


class HoldingOut(BaseModel):
    position_id: int
    asset_id: int
    portfolio_id: int | None = None
    symbol: str
    name: str
    asset_class: str
    sector: str | None = None
    region: str | None = None
    currency: str
    quantity: Decimal
    current_price: Decimal
    entry_price: Decimal
    market_value: Decimal
    cost: Decimal
    pnl: Decimal
    pnl_pct: float
    day_change: float


# --- valuation / pnl ---
class PortfolioValuationOut(BaseModel):
    total_value: Decimal
    total_cost: Decimal
    pnl: Decimal
    pnl_pct: float
    day_pnl: Decimal
    day_pct: float
    positions: int
    holdings: list[HoldingOut]


class PositionPnLOut(BaseModel):
    quantity: Decimal
    current_price: Decimal
    entry_price: Decimal
    market_value: Decimal
    cost: Decimal
    pnl: Decimal
    pnl_pct: float
    day_change: float


# --- series & metrics ---
class SeriesOut(BaseModel):
    dates: list[str]
    values: list[float]


class MetricsOut(BaseModel):
    annual_return: float
    volatility: float
    sharpe: float
    sortino: float
    max_drawdown: float
    calmar: float
    var_95: float
    cvar_95: float
    beta: float | None = None
    information_ratio: float | None = None
    best_day: float
    worst_day: float
    positive_days: float
    drawdown_series: list[float] = []
    dates: list[str] = []


# --- correlation ---
class CorrelationOut(BaseModel):
    labels: list[str]
    matrix: list[list[float]]
    most_correlated: list[PairOut] = []
    best_diversifiers: list[PairOut] = []


# --- frontier ---
class FrontierPoint(BaseModel):
    risk: float
    ret: float
    sharpe: float | None = None
    weights: list[float] | None = None


class CloudPoint(BaseModel):
    risk: float
    ret: float


class FrontierOut(BaseModel):
    labels: list[str]
    cloud: list[CloudPoint]
    frontier: list[FrontierPoint]
    current: FrontierPoint | None = None
    max_sharpe: FrontierPoint
    min_variance: FrontierPoint
    recommended: FrontierPoint


# --- monte carlo ---
class FinalStats(BaseModel):
    p10: float
    p50: float
    p90: float
    mean: float
    min: float
    max: float


class Histogram(BaseModel):
    counts: list[int]
    edges: list[float]


class MonteCarloOut(BaseModel):
    start_value: float
    horizon: int
    n_sims: int
    target: float
    target_growth: float
    prob_target: float
    percentiles: dict[str, list[float]]
    final: FinalStats
    var_5: float
    histogram: Histogram
    sample_paths: list[list[float]]


# --- concentration ---
class PnLDecomposition(BaseModel):
    contributors: list[ContributorRow]
    positive: float
    negative: float
    net: float
    win_rate: float


class ConcentrationOut(BaseModel):
    allocation: list[BreakdownRow]
    by_class: list[BreakdownRow]
    by_currency: list[BreakdownRow]
    by_region: list[BreakdownRow]
    top3_share: float
    hhi: float
    pnl_decomposition: PnLDecomposition
    movers: list[HoldingOut]
    winners: list[HoldingOut]
    losers: list[HoldingOut]


# --- compare ---
class CompareLine(BaseModel):
    portfolio_id: int
    name: str
    dates: list[str]
    series: list[float]
    change: float
    metrics: MetricsOut


class ScatterPoint(BaseModel):
    portfolio_id: int
    name: str
    risk: float
    ret: float
    sharpe: float


class CompareOut(BaseModel):
    mode: str
    lines: list[CompareLine]
    scatter: list[ScatterPoint]


# --- dashboard ---
class DashboardOut(BaseModel):
    total_value: Decimal
    total_cost: Decimal
    pnl: Decimal
    pnl_pct: float
    day_pnl: Decimal
    day_pct: float
    positions: int
    portfolios: int
    series: SeriesOut
    range_change: float
    allocation: list[BreakdownRow]
    by_class: list[BreakdownRow]
    by_currency: list[BreakdownRow]
    by_region: list[BreakdownRow]
    top3_share: float
    movers: list[HoldingOut]
    pnl_decomposition: PnLDecomposition
    winners: list[HoldingOut]
    losers: list[HoldingOut]


# --- fundamental valuation ---
class ModelValue(BaseModel):
    value: float | None = None
    upside: float | None = None
    required_return: float | None = None


class BlackScholesOut(BaseModel):
    option: str
    price: float
    d1: float
    d2: float
    delta: float


class AssetValuationOut(BaseModel):
    symbol: str
    has_inputs: bool
    current_price: float | None = None
    capm_expected_return: float | None = None
    dcf: ModelValue
    gordon: ModelValue
    black_scholes: BlackScholesOut | None = None
