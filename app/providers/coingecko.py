"""CoinGecko provider — crypto (SPEC §3).

Public API, no key. ``provider_symbol`` is the CoinGecko coin id
(e.g. ``bitcoin``, ``ethereum``); falls back to the lowercased symbol.
Prices are quoted in the asset currency (USD by default).
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from app.config import settings
from app.providers.base import PriceProvider, ProviderBar, ProviderQuote


class CoingeckoProvider(PriceProvider):
    name = "coingecko"

    def _coin(self, symbol: str, provider_symbol: str | None) -> str:
        return (provider_symbol or symbol).lower()

    async def get_quote(
        self, symbol, *, provider_symbol, currency, asset_class=None
    ) -> ProviderQuote | None:
        coin = self._coin(symbol, provider_symbol)
        vs = currency.lower()
        data = await self._get_json(
            f"{settings.coingecko_base_url}/simple/price",
            {
                "ids": coin,
                "vs_currencies": vs,
                "include_24hr_change": "true",
            },
        )
        entry = (data or {}).get(coin)
        if not entry or entry.get(vs) is None:
            return None
        change = entry.get(f"{vs}_24h_change")
        return ProviderQuote(
            price=Decimal(str(entry[vs])),
            currency=currency,
            as_of=datetime.now(timezone.utc),
            # API returns 24h change in percent; store as a fraction.
            change_24h=(Decimal(str(change)) / 100) if change is not None else None,
        )

    async def get_history(
        self, symbol, *, provider_symbol, currency, days, asset_class=None
    ) -> list[ProviderBar]:
        coin = self._coin(symbol, provider_symbol)
        vs = currency.lower()
        data = await self._get_json(
            f"{settings.coingecko_base_url}/coins/{coin}/market_chart",
            {"vs_currency": vs, "days": days, "interval": "daily"},
        )
        prices = (data or {}).get("prices") or []
        # One close per day — collapse duplicate days, keep the last point.
        by_day: dict = {}
        for ts_ms, price in prices:
            d = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc).date()
            by_day[d] = Decimal(str(price))
        return [
            ProviderBar(day=d, close=c, currency=currency)
            for d, c in sorted(by_day.items())
        ]
