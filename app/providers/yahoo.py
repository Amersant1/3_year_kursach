"""Yahoo Finance provider — foreign (US) equities & ETFs (SPEC §3).

Public chart endpoint (no key) returns both the latest price and the daily
history in one call: ``/v8/finance/chart/{symbol}?range=1y&interval=1d``.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from app.config import settings
from app.providers.base import PriceProvider, ProviderBar, ProviderQuote


def _range_for(days: int) -> str:
    if days <= 5:
        return "5d"
    if days <= 31:
        return "1mo"
    if days <= 93:
        return "3mo"
    if days <= 186:
        return "6mo"
    if days <= 366:
        return "1y"
    if days <= 732:
        return "2y"
    return "5y"


class YahooProvider(PriceProvider):
    name = "yahoo"

    async def _chart(self, symbol: str, days: int) -> dict | None:
        data = await self._get_json(
            f"{settings.yahoo_base_url}/v8/finance/chart/{symbol}",
            {"range": _range_for(days), "interval": "1d"},
        )
        result = ((data or {}).get("chart") or {}).get("result") or []
        return result[0] if result else None

    async def get_quote(
        self, symbol, *, provider_symbol, currency, asset_class=None
    ) -> ProviderQuote | None:
        sym = provider_symbol or symbol
        result = await self._chart(sym, 5)
        if not result:
            return None
        meta = result.get("meta") or {}
        price = meta.get("regularMarketPrice")
        if price is None:
            return None
        prev = meta.get("chartPreviousClose") or meta.get("previousClose")
        change = None
        if prev:
            change = (Decimal(str(price)) - Decimal(str(prev))) / Decimal(str(prev))
        return ProviderQuote(
            price=Decimal(str(price)),
            currency=meta.get("currency") or currency,
            as_of=datetime.now(timezone.utc),
            change_24h=change,
        )

    async def get_history(
        self, symbol, *, provider_symbol, currency, days, asset_class=None
    ) -> list[ProviderBar]:
        sym = provider_symbol or symbol
        result = await self._chart(sym, days)
        if not result:
            return []
        ts = result.get("timestamp") or []
        quote = (((result.get("indicators") or {}).get("quote") or [{}])[0]) or {}
        closes = quote.get("close") or []
        ccy = (result.get("meta") or {}).get("currency") or currency
        out: list[ProviderBar] = []
        for t, c in zip(ts, closes):
            if c is None:
                continue
            out.append(
                ProviderBar(
                    day=datetime.fromtimestamp(t, tz=timezone.utc).date(),
                    close=Decimal(str(c)),
                    currency=ccy,
                )
            )
        out.sort(key=lambda b: b.day)
        return out
