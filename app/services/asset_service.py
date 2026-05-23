"""Asset catalog. Assets are shared (not per-user) so the unique
``(symbol, asset_class)`` constraint deduplicates across the system."""

from __future__ import annotations

from app.core.errors import NotFoundError
from app.models import Asset, AssetFundamentals
from app.models.asset import AssetClass, PricingProvider


async def create_or_get(
    *,
    symbol: str,
    name: str,
    asset_class: AssetClass,
    pricing_provider: PricingProvider,
    currency: str = "RUB",
    sector: str | None = None,
    region: str | None = None,
    provider_symbol: str | None = None,
) -> Asset:
    # get_or_create on the unique pair — idempotent for the user.
    asset, _ = await Asset.get_or_create(
        symbol=symbol,
        asset_class=asset_class,
        defaults={
            "name": name,
            "pricing_provider": pricing_provider,
            "currency": currency,
            "sector": sector,
            "region": region,
            "provider_symbol": provider_symbol,
        },
    )
    return asset


async def get_fundamentals(asset_id: int) -> AssetFundamentals | None:
    return await AssetFundamentals.get_or_none(asset_id=asset_id)


async def upsert_fundamentals(asset_id: int, values: dict) -> AssetFundamentals:
    await get_asset(asset_id)  # 404 if the asset doesn't exist
    # Only overwrite provided (non-None) fields so partial updates are safe.
    defaults = {k: v for k, v in values.items() if v is not None}
    obj, _ = await AssetFundamentals.update_or_create(
        asset_id=asset_id, defaults=defaults
    )
    return obj


async def list_assets() -> list[Asset]:
    return await Asset.all().order_by("symbol")


async def get_asset(asset_id: int) -> Asset:
    asset = await Asset.get_or_none(id=asset_id)
    if asset is None:
        raise NotFoundError("Asset not found", code="asset_not_found")
    return asset
