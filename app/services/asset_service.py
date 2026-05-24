"""Asset catalog. Assets are shared (not per-user) so the unique
``(symbol, asset_class)`` constraint deduplicates across the system."""

from __future__ import annotations

from app.core.errors import ConflictError, NotFoundError
from app.models import Asset, AssetFundamentals, Position, Transaction
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


async def update_asset(asset_id: int, fields: dict) -> Asset:
    """Patch descriptive metadata. Immutable fields (symbol/asset_class/currency)
    are filtered out at the schema layer; we only persist supplied keys.
    """
    asset = await get_asset(asset_id)
    if not fields:
        return asset
    for k, v in fields.items():
        setattr(asset, k, v)
    await asset.save()
    return asset


async def delete_asset(asset_id: int) -> None:
    """Hard-delete an asset.

    Blocks if the asset is referenced by any position or transaction
    (would orphan domain history). Quote/history rows die via ON DELETE
    CASCADE in the schema.
    """
    asset = await get_asset(asset_id)
    if await Position.filter(asset_id=asset_id).exists():
        raise ConflictError(
            "Asset is referenced by positions — close them before deleting",
            code="asset_in_use",
        )
    if await Transaction.filter(asset_id=asset_id).exists():
        raise ConflictError(
            "Asset is referenced by transactions — cannot delete",
            code="asset_in_use",
        )
    if await Transaction.filter(source_asset_id=asset_id).exists():
        raise ConflictError(
            "Asset is referenced by transfer transactions — cannot delete",
            code="asset_in_use",
        )
    await asset.delete()
