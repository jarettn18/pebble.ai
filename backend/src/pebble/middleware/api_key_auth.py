from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from pebble.models.api_key import APIKey
from pebble.models.user import User
from pebble.utils.security import hash_api_key


async def authenticate_api_key(
    raw_key: str, db: AsyncSession
) -> tuple[User, APIKey]:
    """Look up an API key by its raw value and return (user, key).

    Raises 401 if the key is unknown, revoked, or its user is inactive.
    Updates last_used_at on success.
    """
    if not raw_key.startswith("pb_"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Malformed API key")

    key_hash = hash_api_key(raw_key)
    result = await db.execute(
        select(APIKey)
        .options(joinedload(APIKey.user))
        .where(APIKey.key_hash == key_hash)
    )
    key = result.scalar_one_or_none()
    if key is None or not key.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid API key")
    if not key.user.active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account deactivated")

    key.last_used_at = datetime.now(timezone.utc)
    await db.commit()
    return key.user, key


def require_scope(key: APIKey, scope: str) -> None:
    if not key.has_scope(scope):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            f"This key is missing required scope: {scope}",
        )
