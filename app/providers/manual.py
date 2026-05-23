"""Manual provider — no external API (SPEC §3).

For illiquid / alternative assets (real estate, business stakes) whose price
the user maintains by hand. There is nothing to fetch, so a refresh is a
no-op: returning ``None`` tells the pricing service to keep the stored quote
untouched. The price itself is set through the assets API.
"""

from __future__ import annotations

from app.providers.base import PriceProvider, ProviderBar, ProviderQuote


class ManualProvider(PriceProvider):
    name = "manual"

    async def get_quote(
        self, symbol, *, provider_symbol, currency, asset_class=None
    ) -> ProviderQuote | None:
        return None

    async def get_history(
        self, symbol, *, provider_symbol, currency, days, asset_class=None
    ) -> list[ProviderBar]:
        return []
