"""Price storage models (SPEC §3, §4).

Two layers, both written by the pricing service / Celery price task:

- ``AssetQuote``  — the *latest* known price per asset (one row per asset).
- ``PriceBar``    — daily historical closes (timeseries), the basis for every
                    return/metric/correlation/Monte-Carlo computation.
- ``FxRate``      — latest currency conversion rate (e.g. USD->RUB), applied
                    when valuing foreign-currency assets in the base currency.

Decimal everywhere for money — never float (SPEC §1).
"""

from tortoise import fields
from tortoise.models import Model

_AMOUNT = {"max_digits": 30, "decimal_places": 10}


class AssetQuote(Model):
    """Latest spot price for an asset. Upserted by the price refresh task."""

    id = fields.IntField(pk=True)
    # One live quote per asset — the refresh task overwrites it in place.
    asset = fields.OneToOneField(
        "models.Asset", related_name="quote", on_delete=fields.CASCADE
    )
    price = fields.DecimalField(**_AMOUNT)
    currency = fields.CharField(max_length=16)
    # 24h change as a fraction (0.012 == +1.2%); null when unknown.
    change_24h = fields.DecimalField(null=True, **_AMOUNT)
    # Which provider produced this price (for transparency/debugging).
    source = fields.CharField(max_length=16)
    as_of = fields.DatetimeField()
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "asset_quotes"

    def __str__(self) -> str:
        return f"AssetQuote(asset={self.asset_id}, price={self.price})"


class PriceBar(Model):
    """One daily close for an asset (append-only timeseries)."""

    id = fields.BigIntField(pk=True)
    asset = fields.ForeignKeyField(
        "models.Asset", related_name="bars", on_delete=fields.CASCADE
    )
    # Calendar day of the close.
    day = fields.DateField()
    close = fields.DecimalField(**_AMOUNT)
    currency = fields.CharField(max_length=16)
    source = fields.CharField(max_length=16)
    created_at = fields.DatetimeField(auto_now_add=True)

    class Meta:
        table = "price_bars"
        # One close per asset per day; fast range scans for charts/metrics.
        unique_together = (("asset_id", "day"),)
        indexes = (("asset_id", "day"),)

    def __str__(self) -> str:
        return f"PriceBar(asset={self.asset_id}, {self.day}, close={self.close})"


class FxRate(Model):
    """Latest FX conversion rate for a currency pair (e.g. USD/RUB).

    One row per (base, quote). ``rate`` is units of ``quote`` per 1 ``base``
    (USD/RUB ≈ 93 means 1 USD = 93 RUB).
    """

    id = fields.IntField(pk=True)
    base = fields.CharField(max_length=16)
    quote = fields.CharField(max_length=16)
    rate = fields.DecimalField(**_AMOUNT)
    source = fields.CharField(max_length=16)
    as_of = fields.DatetimeField()
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "fx_rates"
        unique_together = (("base", "quote"),)

    def __str__(self) -> str:
        return f"FxRate({self.base}/{self.quote}={self.rate})"
