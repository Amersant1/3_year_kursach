"""Position queries. Mutations are driven exclusively by
``transaction_service`` — positions are derived state of transactions
(SPEC §2)."""

from __future__ import annotations

from app.core.errors import NotFoundError
from app.models import Position, User


async def list_for_user(
    user: User, *, portfolio_id: int | None = None
) -> list[Position]:
    qs = Position.filter(user_id=user.id)
    if portfolio_id is not None:
        qs = qs.filter(portfolio_id=portfolio_id)
    return await qs.order_by("-opened_at")


async def get_for_user(*, user: User, position_id: int) -> Position:
    p = await Position.get_or_none(id=position_id, user_id=user.id)
    if p is None:
        raise NotFoundError("Position not found", code="position_not_found")
    return p


# PnL computation lives here and stays a no-op until iteration 3 wires the
# pricing providers. The endpoint contract is final from day one.
def attach_pnl(position: Position) -> Position:
    # TODO(iteration-3): fetch current price via pricing service and fill
    # current_price / market_value / pnl_absolute / pnl_percent.
    return position
