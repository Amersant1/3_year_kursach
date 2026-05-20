from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordRequestForm

from app.core.deps import get_current_user
from app.models import User
from app.schemas.auth import RegisterIn, TokenOut, UserOut
from app.services import auth_service
from app.core.security import create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
)
async def register(payload: RegisterIn) -> UserOut:
    user = await auth_service.register(payload.email, payload.password)
    return UserOut.model_validate(user)


@router.post(
    "/login",
    response_model=TokenOut,
    summary="Exchange credentials for a JWT (OAuth2 password flow)",
)
async def login(form: OAuth2PasswordRequestForm = Depends()) -> TokenOut:
    # OAuth2PasswordRequestForm uses ``username``; we treat it as email.
    user = await auth_service.authenticate(form.username, form.password)
    return TokenOut(access_token=create_access_token(user.id))


@router.get("/me", response_model=UserOut, summary="Current user")
async def me(user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(user)
