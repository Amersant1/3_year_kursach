from fastapi import APIRouter, Depends, File, UploadFile, status

from app.core.deps import get_current_user
from app.core.errors import ConflictError
from app.models import User
from app.schemas.transaction import (
    ImportResult,
    ImportRowError,
    TransactionCreate,
    TransactionOut,
)
from app.services import transaction_service

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.post(
    "",
    response_model=TransactionOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a transaction (drives position lifecycle)",
)
async def create(
    payload: TransactionCreate, user: User = Depends(get_current_user)
) -> TransactionOut:
    tx = await transaction_service.create(user=user, payload=payload)
    return TransactionOut.model_validate(tx)


@router.get(
    "", response_model=list[TransactionOut], summary="List your transactions"
)
async def list_(
    user: User = Depends(get_current_user),
    portfolio_id: int | None = None,
) -> list[TransactionOut]:
    items = await transaction_service.list_for_user(user, portfolio_id=portfolio_id)
    return [TransactionOut.model_validate(t) for t in items]


@router.get(
    "/{transaction_id}",
    response_model=TransactionOut,
    summary="Get a transaction",
)
async def get(
    transaction_id: int, user: User = Depends(get_current_user)
) -> TransactionOut:
    tx = await transaction_service.get_for_user(
        user=user, transaction_id=transaction_id
    )
    return TransactionOut.model_validate(tx)


@router.post(
    "/import",
    response_model=ImportResult,
    summary="Bulk-import transactions from a CSV file (best-effort)",
)
async def import_csv(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
) -> ImportResult:
    data = await file.read()
    if not data:
        raise ConflictError("Empty file uploaded", code="bad_csv")
    created, errors, total = await transaction_service.import_csv(
        user=user, file_bytes=data
    )
    return ImportResult(
        created=[TransactionOut.model_validate(t) for t in created],
        errors=[ImportRowError(row=r, error=e) for r, e in errors],
        total_rows=total,
    )
