from enum import Enum

from tortoise import fields
from tortoise.models import Model

# Money/quantity precision. Decimal everywhere — never float (SPEC §1).
_AMOUNT = {"max_digits": 30, "decimal_places": 10}


class TransactionType(str, Enum):
    """Three fundamental transaction types (SPEC §2).

    - INPUT:    asset enters the system from an external source
                (deposit, received crypto). Creates/tops up a position.
    - TRANSFER: exchange one asset for another (buy/convert). This is the
                type that *creates positions*: debits the source asset,
                creates/increases the target position. Source asset and
                currency are stored.
    - OUTPUT:   asset leaves the system (sale, external transfer).
                Reduces / closes a position.
    """

    INPUT = "input"
    TRANSFER = "transfer"
    OUTPUT = "output"


class Transaction(Model):
    """Fundamental unit of the domain (SPEC §2).

    Position lifecycle is derived from transactions in
    ``app.services.transaction_service`` (implemented in iteration 2).
    """

    id = fields.IntField(pk=True)
    user = fields.ForeignKeyField(
        "models.User", related_name="transactions", on_delete=fields.CASCADE
    )
    # Grouping is optional: a raw input may exist before the user files it
    # under a portfolio. Portfolio aggregates *related* transactions.
    portfolio = fields.ForeignKeyField(
        "models.Portfolio",
        related_name="transactions",
        on_delete=fields.SET_NULL,
        null=True,
    )

    tx_type = fields.CharEnumField(TransactionType, max_length=16, index=True)

    # Target/affected asset of this transaction.
    asset = fields.ForeignKeyField(
        "models.Asset", related_name="transactions", on_delete=fields.RESTRICT
    )
    quantity = fields.DecimalField(**_AMOUNT)
    # Price per unit of `asset`, expressed in `currency`.
    price = fields.DecimalField(**_AMOUNT)
    currency = fields.CharField(max_length=16)

    # Source side — only meaningful for TRANSFER (what was spent to acquire
    # `asset`). Kept nullable so input/output rows stay clean.
    source_asset = fields.ForeignKeyField(
        "models.Asset",
        related_name="outgoing_transactions",
        on_delete=fields.RESTRICT,
        null=True,
    )
    source_quantity = fields.DecimalField(null=True, **_AMOUNT)
    source_currency = fields.CharField(max_length=16, null=True)

    # When the transaction economically happened (user-provided).
    timestamp = fields.DatetimeField(index=True)
    created_at = fields.DatetimeField(auto_now_add=True)

    class Meta:
        table = "transactions"

    def __str__(self) -> str:
        return f"Transaction({self.id}, {self.tx_type}, asset={self.asset_id})"
