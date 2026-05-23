"""Provider registry — resolve a ``PricingProvider`` to its implementation.

Single place that knows which class serves each price source, so the pricing
service stays agnostic. Instances are stateless and safe to reuse.
"""

from __future__ import annotations

from app.models.asset import PricingProvider
from app.providers.base import PriceProvider
from app.providers.coingecko import CoingeckoProvider
from app.providers.custom import CustomProvider
from app.providers.fx import FxProvider
from app.providers.manual import ManualProvider
from app.providers.moex import MoexProvider
from app.providers.yahoo import YahooProvider

_REGISTRY: dict[PricingProvider, PriceProvider] = {
    PricingProvider.MOEX: MoexProvider(),
    PricingProvider.COINGECKO: CoingeckoProvider(),
    PricingProvider.YAHOO: YahooProvider(),
    PricingProvider.CUSTOM: CustomProvider(),
    PricingProvider.MANUAL: ManualProvider(),
}

fx_provider = FxProvider()


def get_provider(provider: PricingProvider) -> PriceProvider:
    """Return the implementation for ``provider`` (defaults to manual)."""
    return _REGISTRY.get(provider, _REGISTRY[PricingProvider.MANUAL])
