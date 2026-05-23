"""Pricing providers (SPEC §3).

Abstract ``PriceProvider`` + 5 implementations (MOEX, Coingecko, Yahoo,
Custom, Manual) plus an FX-rate provider. Resolve one via
``app.providers.registry.get_provider``.
"""

from app.providers.base import PriceProvider, ProviderBar, ProviderQuote
from app.providers.registry import fx_provider, get_provider

__all__ = [
    "PriceProvider",
    "ProviderBar",
    "ProviderQuote",
    "get_provider",
    "fx_provider",
]
