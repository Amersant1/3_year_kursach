from fastapi import APIRouter, Depends

from app.core.deps import get_current_user
from app.models import User
from app.schemas.analytics import PositionPnLOut
from app.schemas.position import PositionOut
from app.services import analytics_service, position_service

router = APIRouter(prefix="/positions", tags=["positions"])


@router.get("", response_model=list[PositionOut], summary="List your positions")
async def list_(
    user: User = Depends(get_current_user),
    portfolio_id: int | None = None,
) -> list[PositionOut]:
    items = await position_service.list_for_user(user, portfolio_id=portfolio_id)
    out = []
    for p in items:
        await position_service.attach_pnl(p)
        out.append(PositionOut.model_validate(p))
    return out


@router.get("/{position_id}", response_model=PositionOut, summary="Get a position")
async def get(
    position_id: int, user: User = Depends(get_current_user)
) -> PositionOut:
    p = await position_service.get_for_user(user=user, position_id=position_id)
    await position_service.attach_pnl(p)
    return PositionOut.model_validate(p)


@router.get(
    "/{position_id}/pnl",
    response_model=PositionPnLOut,
    summary="Detailed PnL for a single position",
)
async def pnl(
    position_id: int, user: User = Depends(get_current_user)
) -> PositionPnLOut:
    return PositionPnLOut.model_validate(
        await analytics_service.position_pnl(user, position_id)
    )
