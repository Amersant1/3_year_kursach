from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.asset import AssetClass, PricingProvider


class AssetCreate(BaseModel):
    symbol: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=255)
    asset_class: AssetClass
    pricing_provider: PricingProvider
    currency: str = Field(default="RUB", max_length=16)
    sector: str | None = Field(default=None, max_length=64)
    region: str | None = Field(default=None, max_length=16)
    # Provider-specific lookup id (e.g. coingecko coin id, custom URL).
    provider_symbol: str | None = Field(default=None, max_length=128)


class AssetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    symbol: str
    name: str
    asset_class: AssetClass
    pricing_provider: PricingProvider
    currency: str
    sector: str | None
    region: str | None
    provider_symbol: str | None
    created_at: datetime


class AssetQuoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    asset_id: int
    price: Decimal
    currency: str
    change_24h: Decimal | None
    source: str
    as_of: datetime


class ManualPriceIn(BaseModel):
    """Set the price of a manual/custom asset by hand."""

    price: Decimal = Field(gt=0)
    currency: str | None = Field(default=None, max_length=16)


class FundamentalsIn(BaseModel):
    """Valuation assumptions to upsert for an asset (all optional)."""

    shares_outstanding: Decimal | None = None
    fcf_per_share: Decimal | None = None
    fcf_growth: Decimal | None = None
    discount_rate: Decimal | None = None
    terminal_growth: Decimal | None = None
    projection_years: int | None = Field(default=None, ge=1, le=30)
    dividend_per_share: Decimal | None = None
    dividend_growth: Decimal | None = None
    required_return: Decimal | None = None
    beta: Decimal | None = None
    risk_free_rate: Decimal | None = None
    market_return: Decimal | None = None
    strike: Decimal | None = None
    time_to_expiry: Decimal | None = None
    bs_volatility: Decimal | None = None
    bs_rate: Decimal | None = None


class FundamentalsOut(FundamentalsIn):
    model_config = ConfigDict(from_attributes=True)

    asset_id: int
    updated_at: datetime
