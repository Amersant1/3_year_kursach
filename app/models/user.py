from tortoise import fields
from tortoise.models import Model


class User(Model):
    """Application user. Simple JWT auth, no OAuth/SSO (SPEC §2)."""

    id = fields.IntField(pk=True)
    email = fields.CharField(max_length=255, unique=True, index=True)
    # Password hash only — argon2 (see app.core.security). Never store plaintext.
    hashed_password = fields.CharField(max_length=255)
    is_active = fields.BooleanField(default=True)
    created_at = fields.DatetimeField(auto_now_add=True)

    portfolios: fields.ReverseRelation["Portfolio"]  # noqa: F821
    transactions: fields.ReverseRelation["Transaction"]  # noqa: F821
    positions: fields.ReverseRelation["Position"]  # noqa: F821

    class Meta:
        table = "users"

    def __str__(self) -> str:
        return f"User({self.id}, {self.email})"
