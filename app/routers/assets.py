from fastapi import APIRouter, Depends, status

from app.core.deps import get_current_user
from app.core.errors import NotFoundError
from app.models import AssetQuote, User
from app.schemas.analytics import AssetValuationOut
from app.schemas.asset import (
    AssetCreate,
    AssetOut,
    AssetQuoteOut,
    AssetUpdate,
    FundamentalsIn,
    FundamentalsOut,
    ManualPriceIn,
)
from app.services import analytics_service, asset_service, pricing_service

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
        currency=payload.currency,
        sector=payload.sector,
        region=payload.region,
        provider_symbol=payload.provider_symbol,
    )
    return AssetOut.model_validate(asset)


@router.get("", response_model=list[AssetOut], summary="List assets")
async def list_(_: User = Depends(get_current_user)) -> list[AssetOut]:
    return [AssetOut.model_validate(a) for a in await asset_service.list_assets()]


@router.get("/{asset_id}", response_model=AssetOut, summary="Get an asset by id")
async def get(asset_id: int, _: User = Depends(get_current_user)) -> AssetOut:
    return AssetOut.model_validate(await asset_service.get_asset(asset_id))


@router.patch(
    "/{asset_id}",
    response_model=AssetOut,
    summary="Update an asset's descriptive metadata",
)
async def update(
    asset_id: int,
    payload: AssetUpdate,
    _: User = Depends(get_current_user),
) -> AssetOut:
    asset = await asset_service.update_asset(
        asset_id, payload.model_dump(exclude_unset=True)
    )
    return AssetOut.model_validate(asset)


@router.delete(
    "/{asset_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an asset (only if no positions/transactions reference it)",
)
async def delete(asset_id: int, _: User = Depends(get_current_user)) -> None:
    await asset_service.delete_asset(asset_id)


@router.post(
    "/{asset_id}/refresh",
    response_model=AssetQuoteOut,
    summary="Refresh price + history from the asset's provider",
)
async def refresh(asset_id: int, _: User = Depends(get_current_user)) -> AssetQuoteOut:
    asset = await asset_service.get_asset(asset_id)
    await pricing_service.backfill_history(asset)
    quote = await pricing_service.refresh_quote(asset)
    if quote is None:
        quote = await AssetQuote.get_or_none(asset_id=asset_id)
    if quote is None:
        raise NotFoundError(
            "No price available from provider yet", code="no_quote"
        )
    return AssetQuoteOut.model_validate(quote)


@router.get(
    "/{asset_id}/quote",
    response_model=AssetQuoteOut,
    summary="Latest stored quote for an asset",
)
async def quote(asset_id: int, _: User = Depends(get_current_user)) -> AssetQuoteOut:
    q = await AssetQuote.get_or_none(asset_id=asset_id)
    if q is None:
        raise NotFoundError("No quote stored for asset", code="no_quote")
    return AssetQuoteOut.model_validate(q)


@router.put(
    "/{asset_id}/price",
    response_model=AssetQuoteOut,
    summary="Set a manual price (manual/custom assets)",
)
async def set_price(
    asset_id: int, payload: ManualPriceIn, _: User = Depends(get_current_user)
) -> AssetQuoteOut:
    asset = await asset_service.get_asset(asset_id)
    q = await pricing_service.set_manual_quote(asset, payload.price, payload.currency)
    return AssetQuoteOut.model_validate(q)


@router.get(
    "/{asset_id}/fundamentals",
    response_model=FundamentalsOut,
    summary="Get valuation assumptions for an asset",
)
async def get_fundamentals(
    asset_id: int, _: User = Depends(get_current_user)
) -> FundamentalsOut:
    fund = await asset_service.get_fundamentals(asset_id)
    if fund is None:
        raise NotFoundError(
            "No fundamentals set for asset", code="no_fundamentals"
        )
    return FundamentalsOut.model_validate(fund)


@router.put(
    "/{asset_id}/fundamentals",
    response_model=FundamentalsOut,
    summary="Upsert valuation assumptions for an asset",
)
async def put_fundamentals(
    asset_id: int, payload: FundamentalsIn, _: User = Depends(get_current_user)
) -> FundamentalsOut:
    fund = await asset_service.upsert_fundamentals(
        asset_id, payload.model_dump(exclude_unset=True)
    )
    return FundamentalsOut.model_validate(fund)


@router.get(
    "/{asset_id}/valuation",
    response_model=AssetValuationOut,
    summary="Fundamental valuation (DCF / Gordon / CAPM / Black-Scholes)",
)
async def valuation(
    asset_id: int, _: User = Depends(get_current_user)
) -> AssetValuationOut:
    result = await analytics_service.asset_valuation(asset_id)
    return AssetValuationOut.model_validate(result)
