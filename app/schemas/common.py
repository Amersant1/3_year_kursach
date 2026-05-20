"""Shared schemas (unified error envelope, etc.)."""

from typing import Any

from pydantic import BaseModel


class ErrorBody(BaseModel):
    code: str
    message: str
    details: Any | None = None


class ErrorResponse(BaseModel):
    """Unified error envelope returned by ``app.core.errors`` handlers."""

    error: ErrorBody
