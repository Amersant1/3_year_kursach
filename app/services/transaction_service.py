"""Transaction domain logic — the heart of the system (SPEC §2).

Position lifecycle is derived from transactions here, atomically:

- INPUT:    credit (user, portfolio, asset) — create or top up with
            weighted-average entry price.
- TRANSFER: debit (user, portfolio, source_asset) by ``source_quantity``
            (409 on overdraft), then credit (user, portfolio, asset).
- OUTPUT:   debit (user, portfolio, asset) by ``quantity`` (409 on overdraft).

Invariants:
- Exactly one position per (user, portfolio, asset). Reopen-from-closed
  resets the cost basis to the reopening event.
- Mixing currencies on a still-open position is rejected (409).
- All side effects wrapped in a DB transaction — partial state is impossible.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from tortoise.transactions import in_transaction

from app.core.errors import ConflictError, NotFoundError
from app.models import Asset, Portfolio, Position, Transaction, User
from app.models.transaction import TransactionType
from app.schemas.transaction import TransactionCreate

ZERO = Decimal(0)


async def _resolve_portfolio(user: User, portfolio_id: int | None) -> Portfolio | None:
    if portfolio_id is None:
        return None
    p = await Portfolio.get_or_none(id=portfolio_id, user_id=user.id)
    if p is None:
        raise NotFoundError("Portfolio not found", code="portfolio_not_found")
    return p


async def _get_asset(asset_id: int) -> Asset:
    a = await Asset.get_or_none(id=asset_id)
    if a is None:
        raise NotFoundError("Asset not found", code="asset_not_found")
    return a


async def _find_position(
    *, user: User, portfolio_id: int | None, asset_id: int
) -> Position | None:
    return await Position.get_or_none(
        user_id=user.id, portfolio_id=portfolio_id, asset_id=asset_id
    )


async def _credit(
    *,
    user: User,
    portfolio_id: int | None,
    asset: Asset,
    add_qty: Decimal,
    add_price: Decimal,
    currency: str,
    when: datetime,
) -> Position:
    pos = await _find_position(
        user=user, portfolio_id=portfolio_id, asset_id=asset.id
    )
    if pos is None:
        return await Position.create(
            user_id=user.id,
            portfolio_id=portfolio_id,
            asset_id=asset.id,
            quantity=add_qty,
            entry_price=add_price,
            currency=currency,
            opened_at=when,
        )
    if pos.is_closed or pos.quantity == ZERO:
        # Reopen: reset cost basis to the new event's terms.
        pos.quantity = add_qty
        pos.entry_price = add_price
        pos.currency = currency
        pos.is_closed = False
        pos.opened_at = when
        pos.closed_at = None
        await pos.save()
        return pos
    if pos.currency != currency:
        raise ConflictError(
            f"Position currency {pos.currency} differs from {currency} — "
            "cannot mix on a single position",
            code="currency_mismatch",
        )
    new_qty = pos.quantity + add_qty
    # Weighted-average entry price.
    pos.entry_price = (
        pos.quantity * pos.entry_price + add_qty * add_price
    ) / new_qty
    pos.quantity = new_qty
    await pos.save()
    return pos


async def _debit(
    *,
    user: User,
    portfolio_id: int | None,
    asset_id: int,
    take_qty: Decimal,
    when: datetime,
) -> Position:
    pos = await _find_position(
        user=user, portfolio_id=portfolio_id, asset_id=asset_id
    )
    available = pos.quantity if (pos and not pos.is_closed) else ZERO
    if pos is None or pos.is_closed or pos.quantity < take_qty:
        raise ConflictError(
            f"Insufficient position quantity (available={available}, "
            f"requested={take_qty})",
            code="insufficient_quantity",
        )
    pos.quantity -= take_qty
    if pos.quantity == ZERO:
        pos.is_closed = True
        pos.closed_at = when
    await pos.save()
    return pos


async def create(*, user: User, payload: TransactionCreate) -> Transaction:
    when = payload.timestamp or datetime.now(tz=timezone.utc)
    portfolio = await _resolve_portfolio(user, payload.portfolio_id)
    portfolio_id = portfolio.id if portfolio else None
    asset = await _get_asset(payload.asset_id)
    source_asset: Asset | None = None
    if payload.tx_type == TransactionType.TRANSFER:
        assert payload.source_asset_id is not None  # enforced in schema
        source_asset = await _get_asset(payload.source_asset_id)

    async with in_transaction():
        if payload.tx_type == TransactionType.INPUT:
            await _credit(
                user=user,
                portfolio_id=portfolio_id,
                asset=asset,
                add_qty=payload.quantity,
                add_price=payload.price,
                currency=payload.currency,
                when=when,
            )
        elif payload.tx_type == TransactionType.OUTPUT:
            await _debit(
                user=user,
                portfolio_id=portfolio_id,
                asset_id=asset.id,
                take_qty=payload.quantity,
                when=when,
            )
        else:  # TRANSFER
            assert source_asset is not None
            assert payload.source_quantity is not None
            # Debit source first — overdraft is the most likely failure;
            # raising before any other write keeps state consistent.
            await _debit(
                user=user,
                portfolio_id=portfolio_id,
                asset_id=source_asset.id,
                take_qty=payload.source_quantity,
                when=when,
            )
            await _credit(
                user=user,
                portfolio_id=portfolio_id,
                asset=asset,
                add_qty=payload.quantity,
                add_price=payload.price,
                currency=payload.currency,
                when=when,
            )

        tx = await Transaction.create(
            user_id=user.id,
            portfolio_id=portfolio_id,
            tx_type=payload.tx_type,
            asset_id=asset.id,
            quantity=payload.quantity,
            price=payload.price,
            currency=payload.currency,
            source_asset_id=source_asset.id if source_asset else None,
            source_quantity=payload.source_quantity,
            source_currency=payload.source_currency,
            timestamp=when,
        )
    return tx


async def list_for_user(
    user: User, *, portfolio_id: int | None = None
) -> list[Transaction]:
    qs = Transaction.filter(user_id=user.id)
    if portfolio_id is not None:
        qs = qs.filter(portfolio_id=portfolio_id)
    return await qs.order_by("-timestamp")


async def get_for_user(*, user: User, transaction_id: int) -> Transaction:
    tx = await Transaction.get_or_none(id=transaction_id, user_id=user.id)
    if tx is None:
        raise NotFoundError("Transaction not found", code="transaction_not_found")
    return tx
