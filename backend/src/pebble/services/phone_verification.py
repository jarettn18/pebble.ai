import datetime
import json
import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from pebble.models.user import User
from pebble.redis import redis_client
from pebble.schemas.auth import InitiateRegisterRequest, VerifyRegisterRequest
from pebble.services.sms import check_verification_code, send_verification_code
from pebble.utils.security import hash_password

VERIFY_PREFIX = "phone_verify:"
VERIFY_TTL = 300  # 5 minutes


async def initiate_registration(
    req: InitiateRegisterRequest, db: AsyncSession
) -> str:
    """Validate uniqueness, store pending registration in Redis, send SMS via Twilio Verify. Returns verification_id."""
    # Check email uniqueness
    existing_email = await db.execute(select(User).where(User.email == req.email))
    if existing_email.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    # Check phone uniqueness
    existing_phone = await db.execute(
        select(User).where(User.phone_number == req.phone_number)
    )
    if existing_phone.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Phone number already registered",
        )

    verification_id = str(uuid.uuid4())

    blob = {
        "email": req.email,
        "hashed_password": hash_password(req.password),
        "full_name": req.full_name,
        "phone_number": req.phone_number,
        "date_of_birth": req.date_of_birth.isoformat(),
    }

    await redis_client.setex(
        f"{VERIFY_PREFIX}{verification_id}",
        VERIFY_TTL,
        json.dumps(blob),
    )

    await send_verification_code(req.phone_number)

    return verification_id


async def verify_and_create_user(
    req: VerifyRegisterRequest, db: AsyncSession
) -> User:
    """Verify the SMS code via Twilio Verify and create the user account."""
    key = f"{VERIFY_PREFIX}{req.verification_id}"
    raw = await redis_client.get(key)
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification expired or invalid",
        )

    blob = json.loads(raw)

    # Verify code with Twilio
    is_valid = await check_verification_code(blob["phone_number"], req.code)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code.",
        )

    # Code is valid — create user
    user = User(
        email=blob["email"],
        hashed_password=blob["hashed_password"],
        full_name=blob["full_name"],
        phone_number=blob["phone_number"],
        phone_verified=True,
        date_of_birth=datetime.date.fromisoformat(blob["date_of_birth"]),
    )

    try:
        db.add(user)
        await db.commit()
        await db.refresh(user)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email or phone number already registered",
        )

    await redis_client.delete(key)
    return user


async def resend_code(verification_id: str) -> None:
    """Resend verification code via Twilio Verify."""
    key = f"{VERIFY_PREFIX}{verification_id}"
    raw = await redis_client.get(key)
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification expired or invalid",
        )

    blob = json.loads(raw)
    await send_verification_code(blob["phone_number"])
