from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.transaction import TransactionType


class TransactionCreate(BaseModel):
    """Per-type rules (SPEC §2):

    - INPUT:    no ``source_*`` fields required.
    - TRANSFER: ``source_asset_id``, ``source_quantity``, ``source_currency`` required.
    - OUTPUT:   no ``source_*`` fields required.
    """

    tx_type: TransactionType
    asset_id: int
    quantity: Decimal = Field(gt=0)
    price: Decimal = Field(ge=0)  # MANUAL/zero-priced gifts allowed (>=0)
    currency: str = Field(min_length=1, max_length=16)

    source_asset_id: int | None = None
    source_quantity: Decimal | None = Field(default=None, gt=0)
    source_currency: str | None = Field(default=None, max_length=16)

    timestamp: datetime | None = None
    portfolio_id: int | None = None

    @model_validator(mode="after")
    def _validate_per_type(self) -> "TransactionCreate":
        if self.tx_type == TransactionType.TRANSFER:
            missing = [
                k
                for k in ("source_asset_id", "source_quantity", "source_currency")
                if getattr(self, k) in (None, "")
            ]
            if missing:
                raise ValueError(
                    f"TRANSFER requires {', '.join(missing)}"
                )
            if self.source_asset_id == self.asset_id:
                raise ValueError("source_asset_id must differ from asset_id")
        else:
            # INPUT / OUTPUT must not carry source_* — keep the row clean.
            if any(
                getattr(self, k) is not None
                for k in ("source_asset_id", "source_quantity", "source_currency")
            ):
                raise ValueError(
                    f"{self.tx_type.value} must not include source_* fields"
                )
        return self


class TransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    portfolio_id: int | None
    tx_type: TransactionType
    asset_id: int
    quantity: Decimal
    price: Decimal
    currency: str
    source_asset_id: int | None
    source_quantity: Decimal | None
    source_currency: str | None
    timestamp: datetime
    created_at: datetime


class ImportRowError(BaseModel):
    """Per-row failure during CSV import — row index (1-based, excludes header)
    and the error message."""

    row: int
    error: str


class ImportResult(BaseModel):
    """Result of POST /transactions/import."""

    created: list[TransactionOut]
    errors: list[ImportRowError]
    total_rows: int
