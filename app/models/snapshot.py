from tortoise import fields
from tortoise.models import Model

# Decimal everywhere — never float (SPEC §1).
_AMOUNT = {"max_digits": 30, "decimal_places": 10}


class PortfolioSnapshot(Model):
    """Timeseries point: portfolio value over time (SPEC §4).

    Written periodically by a Celery beat task (iteration 4). This is the
    backing store for future frontend charts — keep it append-only.
    """

    id = fields.BigIntField(pk=True)
    portfolio = fields.ForeignKeyField(
        "models.Portfolio", related_name="snapshots", on_delete=fields.CASCADE
    )
    total_value = fields.DecimalField(**_AMOUNT)
    currency = fields.CharField(max_length=16)
    captured_at = fields.DatetimeField(index=True)
    created_at = fields.DatetimeField(auto_now_add=True)

    class Meta:
        table = "portfolio_snapshots"
        # Fast range scans per portfolio for charting.
        indexes = (("portfolio_id", "captured_at"),)

    def __str__(self) -> str:
        return (
            f"PortfolioSnapshot(portfolio={self.portfolio_id}, "
            f"value={self.total_value}, at={self.captured_at})"
        )
