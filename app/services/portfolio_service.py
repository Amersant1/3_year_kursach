"""Portfolio CRUD scoped to the owning user."""

from __future__ import annotations

from app.core.errors import NotFoundError
from app.models import Portfolio, User


async def create(*, user: User, name: str, description: str | None) -> Portfolio:
    return await Portfolio.create(user=user, name=name, description=description)


async def list_for_user(user: User) -> list[Portfolio]:
    return await Portfolio.filter(user_id=user.id).order_by("id")


async def get_for_user(*, user: User, portfolio_id: int) -> Portfolio:
    p = await Portfolio.get_or_none(id=portfolio_id, user_id=user.id)
    if p is None:
        # 404 instead of 403: don't leak existence of others' portfolios.
        raise NotFoundError("Portfolio not found", code="portfolio_not_found")
    return p


async def update(
    *,
    user: User,
    portfolio_id: int,
    name: str | None,
    description: str | None,
) -> Portfolio:
    p = await get_for_user(user=user, portfolio_id=portfolio_id)
    if name is not None:
        p.name = name
    if description is not None:
        p.description = description
    await p.save()
    return p


async def delete(*, user: User, portfolio_id: int) -> None:
    p = await get_for_user(user=user, portfolio_id=portfolio_id)
    await p.delete()
