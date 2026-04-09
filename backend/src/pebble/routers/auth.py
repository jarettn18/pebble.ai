from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from pebble.database import get_db
from pebble.middleware.auth import get_current_user
from pebble.models.user import User
from pebble.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UpdateProfileRequest,
    UserResponse,
)
from pebble.services.auth import login_user, refresh_tokens, register_user
from pebble.services.rate_limiter import RateLimitDependency

router = APIRouter(prefix="/v1/auth", tags=["auth"])

_login_limiter = RateLimitDependency(max_requests=5, window_seconds=60)
_register_limiter = RateLimitDependency(max_requests=3, window_seconds=60)


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=201,
    dependencies=[Depends(_register_limiter)],
)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    user = await register_user(req, db)
    from pebble.utils.security import create_access_token, create_refresh_token

    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    dependencies=[Depends(_login_limiter)],
)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    return await login_user(req, db)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(req: RefreshRequest, db: AsyncSession = Depends(get_db)):
    return await refresh_tokens(req.refresh_token, db)


@router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(get_current_user)):
    return _user_response(user)


@router.patch("/profile", response_model=UserResponse)
async def update_profile(
    req: UpdateProfileRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    updates = req.model_dump(exclude_unset=True)
    if not updates:
        return _user_response(user)

    for field, value in updates.items():
        setattr(user, field, value)

    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Invalidate cached financial profile so AI picks up new demographics
    try:
        from pebble.database import redis_client

        if redis_client:
            await redis_client.delete(f"financial_profile:{user.id}")
    except Exception:
        pass

    return _user_response(user)


def _user_response(user: User) -> UserResponse:
    return UserResponse(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        subscription_tier=user.subscription_tier.value,
        date_of_birth=user.date_of_birth,
        occupation=user.occupation,
        annual_income=user.annual_income,
        state=user.state,
        marital_status=user.marital_status,
        dependents=user.dependents,
        financial_goals=user.financial_goals,
    )
