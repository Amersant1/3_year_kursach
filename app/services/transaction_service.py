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


async def import_csv(
    *, user: User, file_bytes: bytes
) -> tuple[list[Transaction], list[tuple[int, str]], int]:
    """Best-effort bulk import.

    Each row is validated and inserted through :func:`create` so all of the
    same domain rules (currency mismatch, overdraft, transfer-source rules)
    apply. A failing row does **not** abort the rest of the file — its
    error is collected and we move on.

    Supported columns (header row, comma-separated, UTF-8):

    - ``tx_type``           — ``input`` / ``transfer`` / ``output``
    - ``asset_id`` *or* ``asset_symbol``[+ ``asset_class``]
    - ``quantity``          — decimal, > 0
    - ``price``             — decimal, >= 0
    - ``currency``          — ISO-like, max 16 chars
    - ``portfolio_id`` *or* ``portfolio_name`` (optional)
    - ``source_asset_id`` *or* ``source_asset_symbol`` (required for transfer)
    - ``source_quantity`` / ``source_currency`` (required for transfer)
    - ``timestamp`` (optional, ISO-8601)
    """
    import csv
    import io

    from app.schemas.transaction import TransactionCreate
    from pydantic import ValidationError

    text = file_bytes.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None:
        raise ConflictError("CSV is empty or missing header row", code="bad_csv")

    # Caches so we don't hammer the DB per row.
    asset_by_id: dict[int, Asset] = {}
    asset_by_sym: dict[tuple[str, str | None], Asset] = {}
    portfolios: dict[int | str, Portfolio] = {}

    async def resolve_asset(row: dict) -> int:
        if (raw := row.get("asset_id", "").strip()):
            aid = int(raw)
            if aid not in asset_by_id:
                a = await Asset.get_or_none(id=aid)
                if a is None:
                    raise ValueError(f"asset_id {aid} not found")
                asset_by_id[aid] = a
            return aid
        sym = (row.get("asset_symbol") or "").strip()
        cls = (row.get("asset_class") or "").strip() or None
        if not sym:
            raise ValueError("asset_id or asset_symbol required")
        key = (sym, cls)
        if key in asset_by_sym:
            return asset_by_sym[key].id
        qs = Asset.filter(symbol=sym)
        if cls:
            qs = qs.filter(asset_class=cls)
        a = await qs.first()
        if a is None:
            raise ValueError(f"asset_symbol {sym!r} not found")
        asset_by_sym[key] = a
        return a.id

    async def resolve_portfolio(row: dict) -> int | None:
        if (raw := (row.get("portfolio_id") or "").strip()):
            pid = int(raw)
            if pid not in portfolios:
                p = await Portfolio.get_or_none(id=pid, user_id=user.id)
                if p is None:
                    raise ValueError(f"portfolio_id {pid} not found")
                portfolios[pid] = p
            return pid
        name = (row.get("portfolio_name") or "").strip()
        if not name:
            return None
        if name in portfolios:
            return portfolios[name].id
        p = await Portfolio.get_or_none(name=name, user_id=user.id)
        if p is None:
            raise ValueError(f"portfolio_name {name!r} not found")
        portfolios[name] = p
        return p.id

    created: list[Transaction] = []
    errors: list[tuple[int, str]] = []
    total = 0
    for i, row in enumerate(reader, start=1):
        total += 1
        try:
            asset_id = await resolve_asset(row)
            portfolio_id = await resolve_portfolio(row)
            source_asset_id: int | None = None
            if (raw := (row.get("source_asset_id") or "").strip()):
                source_asset_id = int(raw)
            elif (sym := (row.get("source_asset_symbol") or "").strip()):
                a = await Asset.filter(symbol=sym).first()
                if a is None:
                    raise ValueError(f"source_asset_symbol {sym!r} not found")
                source_asset_id = a.id

            payload = TransactionCreate(
                tx_type=row["tx_type"].strip().lower(),  # type: ignore[arg-type]
                asset_id=asset_id,
                quantity=row["quantity"],
                price=row["price"],
                currency=row["currency"].strip(),
                source_asset_id=source_asset_id,
                source_quantity=(row.get("source_quantity") or None) or None,
                source_currency=(row.get("source_currency") or None) or None,
                timestamp=(row.get("timestamp") or None) or None,
                portfolio_id=portfolio_id,
            )
            tx = await create(user=user, payload=payload)
            created.append(tx)
        except (ValueError, KeyError, ValidationError, ConflictError, NotFoundError) as e:
            errors.append((i, str(e)))
    return created, errors, total
