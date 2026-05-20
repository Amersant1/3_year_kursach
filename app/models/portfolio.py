from tortoise import fields
from tortoise.models import Model


class Portfolio(Model):
    """User-defined grouping of positions / transactions (SPEC §2).

    Grouping is arbitrary (by strategy, asset class, ...). The dashboard
    endpoint (iteration 2+) aggregates total value and per-position PnL.
    """

    id = fields.IntField(pk=True)
    user = fields.ForeignKeyField(
        "models.User", related_name="portfolios", on_delete=fields.CASCADE
    )
    name = fields.CharField(max_length=255)
    description = fields.TextField(null=True)
    created_at = fields.DatetimeField(auto_now_add=True)

    positions: fields.ReverseRelation["Position"]  # noqa: F821
    transactions: fields.ReverseRelation["Transaction"]  # noqa: F821
    snapshots: fields.ReverseRelation["PortfolioSnapshot"]  # noqa: F821

    class Meta:
        table = "portfolios"

    def __str__(self) -> str:
        return f"Portfolio({self.id}, {self.name})"
