from enum import Enum

from tortoise import fields
from tortoise.models import Model


class AssetClass(str, Enum):
    """Asset class — drives which pricing provider is used (SPEC §2, §3).

    Extended beyond the original MVP set so the catalogue can mirror the
    frontend universe (RU/US equities, bonds, ETFs, crypto, alternatives).
    """

    STOCK = "stock"
    STOCK_RU = "stock_ru"
    STOCK_US = "stock_us"
    BOND = "bond"
    ETF = "etf"
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
    # Trading currency of the instrument (e.g. RUB for MOEX, USD for Yahoo).
    # Used to value positions and convert to the portfolio base currency.
    currency = fields.CharField(max_length=16, default="RUB")
    # Classification metadata used by allocation/concentration analytics.
    sector = fields.CharField(max_length=64, null=True)
    region = fields.CharField(max_length=16, null=True)
    # Provider-specific lookup id (e.g. coingecko coin id "bitcoin",
    # MOEX board, custom endpoint url). Falls back to ``symbol`` when null.
    provider_symbol = fields.CharField(max_length=128, null=True)
    created_at = fields.DatetimeField(auto_now_add=True)

    quote: fields.ReverseRelation["AssetQuote"]  # noqa: F821
    bars: fields.ReverseRelation["PriceBar"]  # noqa: F821
    fundamentals: fields.ReverseRelation["AssetFundamentals"]  # noqa: F821

    class Meta:
        table = "assets"
        # Same symbol can exist across classes (e.g. a custom asset
        # named like a ticker) but must be unique within a class.
        unique_together = (("symbol", "asset_class"),)

    def __str__(self) -> str:
        return f"Asset({self.symbol}, {self.asset_class})"
