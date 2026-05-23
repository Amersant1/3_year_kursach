"""FX rate provider (SPEC §3).

Fetches a spot conversion rate for a currency pair (units of ``quote`` per
1 ``base``), e.g. USD/RUB. Primary source is the MOEX currency market; if it
is unavailable we fall back to CoinGecko (USDT as a USD proxy). Same graceful
degradation contract as price providers — returns ``None`` on failure.
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation

from app.config import settings
from app.providers.base import PriceProvider
from app.providers.moex import _rows

# MOEX selt board tickers per pair (TOM = next-day settlement).
_MOEX_TICKERS = {("USD", "RUB"): "USD000UTSTOM", ("EUR", "RUB"): "EUR_RUB__TOM"}
# CoinGecko coin id used as a USD proxy.
_CG_USD_PROXY = "tether"


def _dec(value) -> Decimal | None:
    if value in (None, "", "null"):
        return None
    try:
        d = Decimal(str(value))
        return d if d > 0 else None
    except (InvalidOperation, ValueError):
        return None


class FxProvider(PriceProvider):
    name = "fx"

    async def get_quote(self, *a, **kw):  # not used for FX
        return None

    async def get_history(self, *a, **kw):
        return []

    async def get_rate(self, base: str, quote: str) -> Decimal | None:
        base, quote = base.upper(), quote.upper()
        if base == quote:
            return Decimal(1)
        rate = await self._moex_rate(base, quote)
        if rate is None and base == "USD" and quote == "RUB":
            rate = await self._coingecko_rate(quote)
        return rate

    async def _moex_rate(self, base: str, quote: str) -> Decimal | None:
        ticker = _MOEX_TICKERS.get((base, quote))
        if not ticker:
            return None
        url = (
            f"{settings.moex_base_url}/engines/currency/markets/selt"
            f"/securities/{ticker}.json"
        )
        data = await self._get_json(url, {"iss.meta": "off", "iss.only": "marketdata"})
        for row in _rows((data or {}).get("marketdata")):
            for col in ("LAST", "MARKETPRICE", "WAPRICE", "LCURRENTPRICE"):
                rate = _dec(row.get(col))
                if rate is not None:
                    return rate
        return None

    async def _coingecko_rate(self, quote: str) -> Decimal | None:
        data = await self._get_json(
            f"{settings.coingecko_base_url}/simple/price",
            {"ids": _CG_USD_PROXY, "vs_currencies": quote.lower()},
        )
        entry = (data or {}).get(_CG_USD_PROXY) or {}
        return _dec(entry.get(quote.lower()))
