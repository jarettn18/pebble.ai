from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from pebble.models.api_key import APIKey
from pebble.utils.security import generate_api_key

VALID_SCOPES: set[str] = {
    "read:transactions",
    "read:accounts",
    "read:budgets",
    "write:budgets",
    "read:insights",
}


async def create_api_key(
    user_id: str, db: AsyncSession, *, name: str, scopes: list[str]
) -> tuple[str, APIKey]:
    unknown = set(scopes) - VALID_SCOPES
    if unknown:
        raise ValueError(f"Unknown scope(s): {sorted(unknown)}")
    raw, hashed = generate_api_key()
    key = APIKey(user_id=user_id, key_hash=hashed, name=name, scopes=list(scopes))
    db.add(key)
    await db.commit()
    await db.refresh(key)
    return raw, key


async def list_api_keys(user_id: str, db: AsyncSession) -> list[APIKey]:
    result = await db.execute(
        select(APIKey)
        .where(APIKey.user_id == user_id)
        .order_by(APIKey.created_at.desc())
    )
    return list(result.scalars().all())


async def revoke_api_key(user_id: str, key_id: str, db: AsyncSession) -> None:
    result = await db.execute(
        select(APIKey).where(APIKey.id == key_id, APIKey.user_id == user_id)
    )
    key = result.scalar_one_or_none()
    if key is None:
        from fastapi import HTTPException, status
        raise HTTPException(status.HTTP_404_NOT_FOUND, "API key not found")
    if key.revoked_at is None:
        key.revoked_at = datetime.now(timezone.utc)
        await db.commit()
