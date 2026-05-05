from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from pebble.database import get_db
from pebble.middleware.auth import get_current_user
from pebble.models.user import User
from pebble.schemas.api_key import (
    APIKeyCreateRequest,
    APIKeyCreateResponse,
    APIKeyOut,
)
from pebble.services import api_keys as api_keys_service

router = APIRouter(prefix="/v1/api-keys", tags=["api-keys"])


def _to_out(k) -> APIKeyOut:
    return APIKeyOut(
        id=str(k.id),
        name=k.name,
        scopes=list(k.scopes or []),
        last_used_at=k.last_used_at,
        revoked_at=k.revoked_at,
        created_at=k.created_at,
    )


@router.post(
    "",
    response_model=APIKeyCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create(
    req: APIKeyCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        raw, key = await api_keys_service.create_api_key(
            str(user.id), db, name=req.name, scopes=req.scopes
        )
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))
    return APIKeyCreateResponse(api_key=_to_out(key), raw_key=raw)


@router.get("", response_model=list[APIKeyOut])
async def list_(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    keys = await api_keys_service.list_api_keys(str(user.id), db)
    return [_to_out(k) for k in keys]


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke(
    key_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await api_keys_service.revoke_api_key(str(user.id), key_id, db)
