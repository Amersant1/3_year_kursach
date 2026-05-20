from fastapi import APIRouter, Depends, status

from app.core.deps import get_current_user
from app.models import User
from app.schemas.portfolio import PortfolioCreate, PortfolioOut, PortfolioUpdate
from app.services import portfolio_service

router = APIRouter(prefix="/portfolios", tags=["portfolios"])


@router.post(
    "",
    response_model=PortfolioOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a portfolio",
)
async def create(
    payload: PortfolioCreate, user: User = Depends(get_current_user)
) -> PortfolioOut:
    p = await portfolio_service.create(
        user=user, name=payload.name, description=payload.description
    )
    return PortfolioOut.model_validate(p)


@router.get("", response_model=list[PortfolioOut], summary="List your portfolios")
async def list_(user: User = Depends(get_current_user)) -> list[PortfolioOut]:
    return [
        PortfolioOut.model_validate(p)
        for p in await portfolio_service.list_for_user(user)
    ]


@router.get("/{portfolio_id}", response_model=PortfolioOut, summary="Get a portfolio")
async def get(
    portfolio_id: int, user: User = Depends(get_current_user)
) -> PortfolioOut:
    p = await portfolio_service.get_for_user(user=user, portfolio_id=portfolio_id)
    return PortfolioOut.model_validate(p)


@router.patch(
    "/{portfolio_id}", response_model=PortfolioOut, summary="Update a portfolio"
)
async def update(
    portfolio_id: int,
    payload: PortfolioUpdate,
    user: User = Depends(get_current_user),
) -> PortfolioOut:
    p = await portfolio_service.update(
        user=user,
        portfolio_id=portfolio_id,
        name=payload.name,
        description=payload.description,
    )
    return PortfolioOut.model_validate(p)


@router.delete(
    "/{portfolio_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a portfolio",
)
async def delete(portfolio_id: int, user: User = Depends(get_current_user)) -> None:
    await portfolio_service.delete(user=user, portfolio_id=portfolio_id)
