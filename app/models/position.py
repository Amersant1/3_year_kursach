from tortoise import fields
from tortoise.models import Model

# Decimal everywhere — never float (SPEC §1).
_AMOUNT = {"max_digits": 30, "decimal_places": 10}


class Position(Model):
    """Holding created automatically from a TRANSFER (SPEC §2).

    Stores the asset, quantity, entry price and the currency the transfer
    was made from. Price/quantity change relative to the base currency is
    tracked from creation. PnL & return are computed per-position by
    ``app.services.position_service`` (iteration 3).
    """

    id = fields.IntField(pk=True)
    user = fields.ForeignKeyField(
        "models.User", related_name="positions", on_delete=fields.CASCADE
    )
    portfolio = fields.ForeignKeyField(
        "models.Portfolio",
        related_name="positions",
        on_delete=fields.SET_NULL,
        null=True,
    )

    asset = fields.ForeignKeyField(
        "models.Asset", related_name="positions", on_delete=fields.RESTRICT
    )
    quantity = fields.DecimalField(**_AMOUNT)
    # Weighted entry price per unit, in `currency` (the currency the
    # transfer that opened/extended this position was made from).
    entry_price = fields.DecimalField(**_AMOUNT)
    currency = fields.CharField(max_length=16)

    is_closed = fields.BooleanField(default=False)
    # Timestamp the position was created (SPEC §2).
    opened_at = fields.DatetimeField(index=True)
    closed_at = fields.DatetimeField(null=True)
    created_at = fields.DatetimeField(auto_now_add=True)

    class Meta:
        table = "positions"

    def __str__(self) -> str:
        return f"Position({self.id}, asset={self.asset_id}, qty={self.quantity})"
