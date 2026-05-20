"""Asset catalog. Assets are shared (not per-user) so the unique
``(symbol, asset_class)`` constraint deduplicates across the system."""

from __future__ import annotations

from app.core.errors import NotFoundError
from app.models import Asset
from app.models.asset import AssetClass, PricingProvider


async def create_or_get(
    *,
    symbol: str,
    name: str,
    asset_class: AssetClass,
    pricing_provider: PricingProvider,
) -> Asset:
    # get_or_create on the unique pair — idempotent for the user.
    asset, _ = await Asset.get_or_create(
        symbol=symbol,
        asset_class=asset_class,
        defaults={"name": name, "pricing_provider": pricing_provider},
    )
    return asset


async def list_assets() -> list[Asset]:
    return await Asset.all().order_by("symbol")


async def get_asset(asset_id: int) -> Asset:
    asset = await Asset.get_or_none(id=asset_id)
    if asset is None:
        raise NotFoundError("Asset not found", code="asset_not_found")
    return asset
