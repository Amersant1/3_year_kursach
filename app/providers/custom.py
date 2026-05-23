"""Custom provider — user-supplied price endpoint (SPEC §3).

For ``custom`` assets with a dynamic price behind the user's own API.
``provider_symbol`` holds the endpoint URL, which must return JSON shaped
like ``{"price": <number>, "currency": "RUB"}`` and, optionally,
``{"history": [{"day": "YYYY-MM-DD", "close": <number>}, ...]}``.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation

from app.providers.base import PriceProvider, ProviderBar, ProviderQuote


def _dec(v) -> Decimal | None:
    try:
        return Decimal(str(v)) if v is not None else None
    except (InvalidOperation, ValueError):
        return None


class CustomProvider(PriceProvider):
    name = "custom"

    async def get_quote(
        self, symbol, *, provider_symbol, currency, asset_class=None
    ) -> ProviderQuote | None:
        if not provider_symbol:
            return None
        data = await self._get_json(provider_symbol)
        price = _dec((data or {}).get("price"))
        if price is None or price <= 0:
            return None
        return ProviderQuote(
            price=price,
            currency=(data or {}).get("currency") or currency,
            as_of=datetime.now(timezone.utc),
        )

    async def get_history(
        self, symbol, *, provider_symbol, currency, days, asset_class=None
    ) -> list[ProviderBar]:
        if not provider_symbol:
            return []
        data = await self._get_json(provider_symbol)
        out: list[ProviderBar] = []
        for row in (data or {}).get("history") or []:
            close = _dec(row.get("close"))
            day = row.get("day")
            if close and close > 0 and day:
                try:
                    out.append(
                        ProviderBar(
                            day=date.fromisoformat(day),
                            close=close,
                            currency=(data or {}).get("currency") or currency,
                        )
                    )
                except ValueError:
                    continue
        out.sort(key=lambda b: b.day)
        return out
