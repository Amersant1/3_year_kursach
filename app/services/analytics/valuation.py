"""Position & portfolio valuation / PnL (Decimal money math).

Ports ``data.js valueOfPosition`` / ``portfolioValue``: convert quantities at
the current price into the base currency via FX, compare to cost basis, and
derive PnL. Money stays Decimal (SPEC §1); percentages are floats.
"""

from __future__ import annotations

from decimal import Decimal

ZERO = Decimal(0)


def value_position(
    *,
    quantity: Decimal,
    current_price: Decimal,
    price_fx: Decimal,
    entry_price: Decimal,
    cost_fx: Decimal,
    day_change: Decimal | None = None,
) -> dict:
    """Value one position in the base currency.

    ``price_fx`` / ``cost_fx`` convert the asset / entry currency into the
    base currency (1 when already in base).
    """
    market_value = quantity * current_price * price_fx
    cost = quantity * entry_price * cost_fx
    pnl = market_value - cost
    pnl_pct = float(pnl / cost) if cost != ZERO else 0.0
    return {
        "quantity": quantity,
        "current_price": current_price,
        "entry_price": entry_price,
        "market_value": market_value,
        "cost": cost,
        "pnl": pnl,
        "pnl_pct": pnl_pct,
        "day_change": float(day_change) if day_change is not None else 0.0,
    }


def aggregate_portfolio(valued_positions: list[dict]) -> dict:
    """Sum valued positions into a portfolio total (mirrors portfolioValue)."""
    total = sum((p["market_value"] for p in valued_positions), ZERO)
    cost = sum((p["cost"] for p in valued_positions), ZERO)
    pnl = total - cost
    # Day PnL = Σ value_i * day_change_i.
    day_pnl = sum(
        (p["market_value"] * Decimal(str(p["day_change"])) for p in valued_positions),
        ZERO,
    )
    prev_value = total - day_pnl
    return {
        "total_value": total,
        "total_cost": cost,
        "pnl": pnl,
        "pnl_pct": float(pnl / cost) if cost != ZERO else 0.0,
        "day_pnl": day_pnl,
        "day_pct": float(day_pnl / prev_value) if prev_value != ZERO else 0.0,
        "positions": len(valued_positions),
    }
