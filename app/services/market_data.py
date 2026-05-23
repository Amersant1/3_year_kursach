"""Market-data loader — bridges the DB price stores to the analytics math.

Loads ``PriceBar`` history and ``AssetQuote`` spot prices, converts everything
into the base reporting currency via the latest ``FxRate`` (applied flat, like
the frontend's single USD/RUB constant), and aligns multiple assets onto a
common set of trading days so the analytics functions receive a clean numeric
matrix.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal

import numpy as np

from app.config import settings
from app.models import Asset, AssetQuote, PriceBar
from app.services.pricing_service import get_fx_rate

logger = logging.getLogger("app.market_data")


@dataclass
class AlignedPrices:
    """Closes for several assets on a shared set of days, in base currency."""

    dates: list[date]
    asset_ids: list[int]
    # shape (n_days, n_assets)
    matrix: np.ndarray
    # asset_id -> column metadata
    fx: dict[int, Decimal] = field(default_factory=dict)

    @property
    def n_days(self) -> int:
        return len(self.dates)

    def column(self, asset_id: int) -> np.ndarray | None:
        if asset_id not in self.asset_ids:
            return None
        return self.matrix[:, self.asset_ids.index(asset_id)]


async def fx_to_base(currency: str, base: str | None = None) -> Decimal:
    """Conversion rate ``currency`` → base. Falls back to 1 if unknown."""
    base = base or settings.base_currency
    if currency.upper() == base.upper():
        return Decimal(1)
    rate = await get_fx_rate(currency, base)
    if rate is None:
        logger.warning("no FX rate %s->%s; using 1.0", currency, base)
        return Decimal(1)
    return rate


def _ffill_bfill(values: np.ndarray) -> np.ndarray:
    """Forward-fill then back-fill NaNs in a 1D array (carry last/first known)."""
    out = values.copy()
    last = np.nan
    for i in range(out.size):  # forward
        if np.isnan(out[i]):
            out[i] = last
        else:
            last = out[i]
    last = np.nan
    for i in range(out.size - 1, -1, -1):  # backward (leading NaNs)
        if np.isnan(out[i]):
            out[i] = last
        else:
            last = out[i]
    return out


async def load_aligned_prices(
    asset_ids: list[int],
    *,
    base_currency: str | None = None,
    days: int | None = None,
    drop_constant: bool = False,
) -> AlignedPrices:
    """Build a (n_days, n_assets) close matrix in base currency.

    Aligns on the **union** of trading days across the assets and forward/
    back-fills gaps, so a sparsely-priced asset (e.g. a manual real-estate
    valuation with one point) doesn't collapse the whole series. Assets with
    no history are dropped. With ``drop_constant`` (correlation/frontier),
    zero-variance columns are also removed since they have no returns.
    """
    base_currency = base_currency or settings.base_currency
    days = days or settings.history_days
    asset_ids = list(dict.fromkeys(asset_ids))  # preserve order, dedupe

    assets = {a.id: a for a in await Asset.filter(id__in=asset_ids)}
    fx: dict[int, Decimal] = {}
    per_asset: dict[int, dict[date, float]] = {}
    for aid in asset_ids:
        asset = assets.get(aid)
        if asset is None:
            continue
        rate = await fx_to_base(asset.currency, base_currency)
        fx[aid] = rate
        bars = await PriceBar.filter(asset_id=aid).order_by("day")
        if bars:
            per_asset[aid] = {b.day: float(b.close) * float(rate) for b in bars}

    usable = [aid for aid in asset_ids if aid in per_asset]
    if not usable:
        return AlignedPrices(dates=[], asset_ids=[], matrix=np.empty((0, 0)), fx=fx)

    all_days = sorted(set().union(*(per_asset[aid].keys() for aid in usable)))[-days:]
    columns: list[np.ndarray] = []
    for aid in usable:
        raw = np.array([per_asset[aid].get(d, np.nan) for d in all_days], dtype=float)
        columns.append(_ffill_bfill(raw))
    matrix = np.column_stack(columns)

    if drop_constant:
        keep = [i for i in range(matrix.shape[1]) if np.nanstd(matrix[:, i]) > 0]
        usable = [usable[i] for i in keep]
        matrix = matrix[:, keep] if keep else np.empty((len(all_days), 0))

    return AlignedPrices(dates=all_days, asset_ids=usable, matrix=matrix, fx=fx)


async def load_quotes(asset_ids: list[int]) -> dict[int, AssetQuote]:
    """Latest spot quote per asset id (missing assets simply absent)."""
    quotes = await AssetQuote.filter(asset_id__in=asset_ids)
    return {q.asset_id: q for q in quotes}
