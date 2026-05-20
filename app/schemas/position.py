from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class PositionOut(BaseModel):
    """Position view. PnL/market_value populated from iteration 3 onward."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    portfolio_id: int | None
    asset_id: int
    quantity: Decimal
    entry_price: Decimal
    currency: str
    is_closed: bool
    opened_at: datetime
    closed_at: datetime | None
    created_at: datetime

    # Reserved for iteration 3 (pricing). Kept on the contract from day one
    # so consumers (and OpenAPI) see the final shape.
    current_price: Decimal | None = None
    market_value: Decimal | None = None
    pnl_absolute: Decimal | None = None
    pnl_percent: Decimal | None = None
