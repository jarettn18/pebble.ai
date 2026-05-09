from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from pebble.database import get_db
from pebble.middleware.auth import get_current_user
from pebble.models.user import User
from pebble.schemas.auth import (
    InitiateRegisterRequest,
    InitiateRegisterResponse,
    LoginRequest,
    RefreshRequest,
    ResendCodeRequest,
    TokenResponse,
    UpdateProfileRequest,
    UserResponse,
    VerifyRegisterRequest,
)
from pebble.services.auth import login_user, refresh_tokens
from pebble.services.phone_verification import (
    initiate_registration,
    resend_code,
    verify_and_create_user,
)
from pebble.services.rate_limiter import RateLimitDependency

router = APIRouter(prefix="/v1/auth", tags=["auth"])

_login_limiter = RateLimitDependency(max_requests=5, window_seconds=60)
_register_limiter = RateLimitDependency(max_requests=3, window_seconds=60)
_verify_limiter = RateLimitDependency(max_requests=5, window_seconds=60)
_resend_limiter = RateLimitDependency(max_requests=3, window_seconds=300)


@router.post(
    "/register/initiate",
    response_model=InitiateRegisterResponse,
    status_code=200,
    dependencies=[Depends(_register_limiter)],
)
async def register_initiate(
    req: InitiateRegisterRequest, db: AsyncSession = Depends(get_db)
):
    verification_id = await initiate_registration(req, db)
    return InitiateRegisterResponse(verification_id=verification_id)


@router.post(
    "/register/verify",
    response_model=TokenResponse,
    status_code=201,
    dependencies=[Depends(_verify_limiter)],
)
async def register_verify(
    req: VerifyRegisterRequest, db: AsyncSession = Depends(get_db)
):
    user = await verify_and_create_user(req, db)
    from pebble.utils.security import create_access_token, create_refresh_token

    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.post(
    "/register/resend",
    status_code=200,
    dependencies=[Depends(_resend_limiter)],
)
async def register_resend(req: ResendCodeRequest):
    await resend_code(req.verification_id)
    return {"message": "Verification code resent"}


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


@router.post("/deactivate", status_code=200)
async def deactivate_account(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user.active = False
    db.add(user)
    await db.commit()
    return {"message": "Account deactivated"}


def _user_response(user: User) -> UserResponse:
    return UserResponse(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        subscription_tier=user.subscription_tier.value,
        phone_number=user.phone_number,
        phone_verified=user.phone_verified,
        date_of_birth=user.date_of_birth,
        occupation=user.occupation,
        annual_income=user.annual_income,
        state=user.state,
        marital_status=user.marital_status,
        dependents=user.dependents,
        financial_goals=user.financial_goals,
        onboarding_completed=user.onboarding_completed,
        active=user.active,
    )
