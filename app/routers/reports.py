"""Report endpoints (SPEC §6). Streams a generated CSV/XLSX download."""

from fastapi import APIRouter, Depends, Response

from app.core.deps import get_current_user
from app.models import User
from app.schemas.report import ReportRequest
from app.services import portfolio_service, report_service

router = APIRouter(prefix="/reports", tags=["reports"])


@router.post(
    "/generate",
    summary="Build a CSV/XLSX report with the selected sections",
    responses={200: {"content": {"application/octet-stream": {}}}},
)
async def generate(
    payload: ReportRequest, user: User = Depends(get_current_user)
) -> Response:
    if payload.portfolio_id is not None:
        await portfolio_service.get_for_user(
            user=user, portfolio_id=payload.portfolio_id
        )
    report = await report_service.generate(
        user,
        portfolio_id=payload.portfolio_id,
        sections=payload.sections,
        fmt=payload.format,
        days=payload.days,
    )
    return Response(
        content=report.content,
        media_type=report.media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{report.filename}"'
        },
    )
