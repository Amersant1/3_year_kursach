"""Pricing service — fetch prices via providers and persist them (SPEC §3, §4).

Orchestrates the provider layer and the ``AssetQuote`` / ``PriceBar`` /
``FxRate`` stores. Used by the assets API (on-demand refresh) and the Celery
price task (periodic refresh). Provider failures never propagate — the last
known price is simply kept.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from decimal import Decimal

from tortoise.transactions import in_transaction

from app.config import settings
from app.models import Asset, AssetQuote, FxRate, PriceBar
from app.providers import fx_provider, get_provider

logger = logging.getLogger("app.pricing")


async def refresh_quote(asset: Asset) -> AssetQuote | None:
    """Fetch the latest price for ``asset`` and upsert its ``AssetQuote``."""
    provider = get_provider(asset.pricing_provider)
    quote = await provider.get_quote(
        asset.symbol,
        provider_symbol=asset.provider_symbol,
        currency=asset.currency,
        asset_class=asset.asset_class.value,
    )
    if quote is None:
        return None
    obj, _ = await AssetQuote.update_or_create(
        asset_id=asset.id,
        defaults={
            "price": quote.price,
            "currency": quote.currency,
            "change_24h": quote.change_24h,
            "source": provider.name,
            "as_of": quote.as_of,
        },
    )
    return obj


async def backfill_history(asset: Asset, days: int | None = None) -> int:
    """Fetch daily history and insert any missing ``PriceBar`` rows.

    Idempotent: existing (asset, day) rows are left untouched. Returns the
    number of new bars written.
    """
    days = days or settings.history_days
    provider = get_provider(asset.pricing_provider)
    bars = await provider.get_history(
        asset.symbol,
        provider_symbol=asset.provider_symbol,
        currency=asset.currency,
        days=days,
        asset_class=asset.asset_class.value,
    )
    if not bars:
        return 0
    existing = set(
        await PriceBar.filter(asset_id=asset.id).values_list("day", flat=True)
    )
    rows = [
        PriceBar(
            asset_id=asset.id,
            day=b.day,
            close=b.close,
            currency=b.currency,
            source=provider.name,
        )
        for b in bars
        if b.day not in existing
    ]
    if rows:
        async with in_transaction():
            await PriceBar.bulk_create(rows)
    return len(rows)


async def set_manual_quote(
    asset: Asset, price: Decimal, currency: str | None = None
) -> AssetQuote:
    """Set the price of a manual/custom asset by hand (assets API)."""
    now = datetime.now(timezone.utc)
    obj, _ = await AssetQuote.update_or_create(
        asset_id=asset.id,
        defaults={
            "price": price,
            "currency": currency or asset.currency,
            "source": "manual",
            "as_of": now,
        },
    )
    # Also append a history point so charts/metrics see manual revaluations.
    await PriceBar.update_or_create(
        asset_id=asset.id,
        day=now.date(),
        defaults={
            "close": price,
            "currency": currency or asset.currency,
            "source": "manual",
        },
    )
    return obj


async def refresh_fx(base: str, quote: str) -> FxRate | None:
    """Fetch and upsert the spot rate for a currency pair."""
    rate = await fx_provider.get_rate(base, quote)
    if rate is None:
        return None
    obj, _ = await FxRate.update_or_create(
        base=base.upper(),
        quote=quote.upper(),
        defaults={
            "rate": rate,
            "source": fx_provider.name,
            "as_of": datetime.now(timezone.utc),
        },
    )
    return obj


async def get_fx_rate(base: str, quote: str) -> Decimal | None:
    """Latest stored rate (units of ``quote`` per 1 ``base``), or None."""
    base, quote = base.upper(), quote.upper()
    if base == quote:
        return Decimal(1)
    row = await FxRate.get_or_none(base=base, quote=quote)
    if row is not None:
        return row.rate
    # Try the inverse pair.
    inv = await FxRate.get_or_none(base=quote, quote=base)
    if inv is not None and inv.rate != 0:
        return Decimal(1) / inv.rate
    return None


async def refresh_all(days: int | None = None) -> dict:
    """Refresh every asset's quote + history and the configured FX pair.

    Returns a small report dict (used as the Celery task result).
    """
    assets = await Asset.all()
    quoted = bars = 0
    for asset in assets:
        if await refresh_quote(asset):
            quoted += 1
        bars += await backfill_history(asset, days)
    fx = await refresh_fx("USD", settings.base_currency)
    return {
        "assets": len(assets),
        "quotes_updated": quoted,
        "bars_added": bars,
        "fx": str(fx.rate) if fx else None,
    }
