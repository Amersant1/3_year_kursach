"""Position queries. Mutations are driven exclusively by
``transaction_service`` — positions are derived state of transactions
(SPEC §2)."""

from __future__ import annotations

from app.core.errors import NotFoundError
from app.models import Asset, AssetQuote, Position, PriceBar, User
from app.services import market_data
from app.services.analytics import valuation


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


async def attach_pnl(position: Position) -> Position:
    """Populate the PnL fields on a Position from the latest prices (SPEC §3).

    Mutates the in-memory object only (does not persist) — the serializer
    reads the extra ``current_price`` / ``market_value`` / ``pnl_*`` attrs.
    """
    asset = await Asset.get_or_none(id=position.asset_id)
    if asset is None:
        return position
    quote = await AssetQuote.get_or_none(asset_id=position.asset_id)
    if quote is not None:
        price = quote.price
        day_change = quote.change_24h
    else:
        last = await PriceBar.filter(asset_id=position.asset_id).order_by("-day").first()
        price = last.close if last else position.entry_price
        day_change = None
    price_fx = await market_data.fx_to_base(asset.currency)
    cost_fx = await market_data.fx_to_base(position.currency)
    v = valuation.value_position(
        quantity=position.quantity,
        current_price=price,
        price_fx=price_fx,
        entry_price=position.entry_price,
        cost_fx=cost_fx,
        day_change=day_change,
    )
    position.current_price = v["current_price"]
    position.market_value = v["market_value"]
    position.pnl_absolute = v["pnl"]
    position.pnl_percent = v["pnl_pct"]
    return position
