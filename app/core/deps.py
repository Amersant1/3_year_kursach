"""FastAPI dependencies. Keep these thin — they only resolve auth/session."""

from __future__ import annotations

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer

from app.core.errors import AuthError
from app.core.security import decode_access_token
from app.models import User

# tokenUrl drives the "Authorize" button in Swagger UI.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=True)


async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    payload = decode_access_token(token)
    sub = payload.get("sub")
    if not sub:
        raise AuthError("Invalid token payload", code="invalid_token")
    user = await User.get_or_none(id=int(sub))
    if user is None or not user.is_active:
        raise AuthError("User not found or inactive", code="invalid_user")
    return user
