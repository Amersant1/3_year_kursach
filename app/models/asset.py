from enum import Enum

from tortoise import fields
from tortoise.models import Model


class AssetClass(str, Enum):
    """Asset class — drives which pricing provider is used (SPEC §2, §3)."""

    STOCK = "stock"
    STOCK_RU = "stock_ru"
    CRYPTO = "crypto"
    CUSTOM = "custom"


class PricingProvider(str, Enum):
    """Price source bound to an asset (SPEC §3)."""

    MOEX = "moex"
    COINGECKO = "coingecko"
    YAHOO = "yahoo"
    CUSTOM = "custom"
    MANUAL = "manual"


class Asset(Model):
    """Tradable / holdable instrument linked to a price source (SPEC §2)."""

    id = fields.IntField(pk=True)
    symbol = fields.CharField(max_length=64, index=True)
    name = fields.CharField(max_length=255)
    asset_class = fields.CharEnumField(AssetClass, max_length=16)
    pricing_provider = fields.CharEnumField(PricingProvider, max_length=16)
    created_at = fields.DatetimeField(auto_now_add=True)

    class Meta:
        table = "assets"
        # Same symbol can exist across classes (e.g. a custom asset
        # named like a ticker) but must be unique within a class.
        unique_together = (("symbol", "asset_class"),)

    def __str__(self) -> str:
        return f"Asset({self.symbol}, {self.asset_class})"
