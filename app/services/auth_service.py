"""Auth domain logic (SPEC §2). Routers stay thin and call into here."""

from __future__ import annotations

from app.core.errors import AuthError, ConflictError
from app.core.security import hash_password, verify_password
from app.models import User


async def register(email: str, password: str) -> User:
    if await User.exists(email=email):
        raise ConflictError("Email already registered", code="email_taken")
    return await User.create(email=email, hashed_password=hash_password(password))


async def authenticate(email: str, password: str) -> User:
    user = await User.get_or_none(email=email)
    if user is None or not user.is_active or not verify_password(
        password, user.hashed_password
    ):
        # Same error for both branches — don't leak which side failed.
        raise AuthError("Invalid credentials", code="invalid_credentials")
    return user
