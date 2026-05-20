from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.asset import AssetClass, PricingProvider


class AssetCreate(BaseModel):
    symbol: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=255)
    asset_class: AssetClass
    pricing_provider: PricingProvider


class AssetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    symbol: str
    name: str
    asset_class: AssetClass
    pricing_provider: PricingProvider
    created_at: datetime
