from fastapi import APIRouter, Depends, status

from app.core.deps import get_current_user
from app.models import User
from app.schemas.asset import AssetCreate, AssetOut
from app.services import asset_service

router = APIRouter(prefix="/assets", tags=["assets"])


@router.post(
    "",
    response_model=AssetOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create or fetch an asset (idempotent on symbol+class)",
)
async def create(
    payload: AssetCreate, _: User = Depends(get_current_user)
) -> AssetOut:
    asset = await asset_service.create_or_get(
        symbol=payload.symbol,
        name=payload.name,
        asset_class=payload.asset_class,
        pricing_provider=payload.pricing_provider,
    )
    return AssetOut.model_validate(asset)


@router.get("", response_model=list[AssetOut], summary="List assets")
async def list_(_: User = Depends(get_current_user)) -> list[AssetOut]:
    return [AssetOut.model_validate(a) for a in await asset_service.list_assets()]


@router.get("/{asset_id}", response_model=AssetOut, summary="Get an asset by id")
async def get(asset_id: int, _: User = Depends(get_current_user)) -> AssetOut:
    return AssetOut.model_validate(await asset_service.get_asset(asset_id))
