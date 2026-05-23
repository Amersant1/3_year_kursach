"""Pricing provider abstraction (SPEC §3).

A ``PriceProvider`` knows how to fetch the *current* price and a daily price
*history* for an asset from one external source. Implementations:
MOEX, Coingecko, Yahoo, Custom, Manual.

Contract for every external call (SPEC §3):
- a per-request timeout (``settings.price_http_timeout``);
- **graceful degradation** — network/parse failures never raise out of the
  provider; ``get_quote`` returns ``None`` and ``get_history`` returns ``[]``.
  The pricing service keeps the last known price when a refresh fails.

Providers take plain values (symbol/provider_symbol/currency), not ORM
objects, so they stay decoupled from the DB and are trivially unit-testable.
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal

import httpx

from app.config import settings

logger = logging.getLogger("app.providers")


@dataclass(frozen=True)
class ProviderQuote:
    """A current spot price from a provider."""

    price: Decimal
    currency: str
    as_of: datetime
    change_24h: Decimal | None = None


@dataclass(frozen=True)
class ProviderBar:
    """One daily close from a provider's history."""

    day: date
    close: Decimal
    currency: str


class PriceProvider(ABC):
    """Abstract source of current + historical prices."""

    #: matches ``app.models.asset.PricingProvider`` value.
    name: str = "base"

    @abstractmethod
    async def get_quote(
        self,
        symbol: str,
        *,
        provider_symbol: str | None,
        currency: str,
        asset_class: str | None = None,
    ) -> ProviderQuote | None:
        """Latest price, or ``None`` if unavailable (never raises)."""

    @abstractmethod
    async def get_history(
        self,
        symbol: str,
        *,
        provider_symbol: str | None,
        currency: str,
        days: int,
        asset_class: str | None = None,
    ) -> list[ProviderBar]:
        """Daily closes (oldest→newest), or ``[]`` if unavailable."""

    # --- helpers shared by HTTP-backed providers ---

    @staticmethod
    def _client() -> httpx.AsyncClient:
        return httpx.AsyncClient(
            timeout=settings.price_http_timeout,
            headers={"User-Agent": "curs-portfolio/0.4 (+self-hosted)"},
        )

    async def _get_json(self, url: str, params: dict | None = None) -> dict | None:
        """GET + parse JSON with timeout and graceful degradation."""
        try:
            async with self._client() as client:
                resp = await client.get(url, params=params)
                resp.raise_for_status()
                return resp.json()
        except (httpx.HTTPError, ValueError) as exc:  # network, status, JSON
            logger.warning("%s: request failed for %s: %s", self.name, url, exc)
            return None
