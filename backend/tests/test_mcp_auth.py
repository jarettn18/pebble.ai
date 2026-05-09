import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

from fastapi import HTTPException
from pebble.middleware.api_key_auth import authenticate_api_key
from pebble.models.api_key import APIKey
from pebble.models.user import User


@pytest.mark.asyncio
async def test_valid_active_key_returns_user_and_key():
    key = APIKey(
        id=uuid4(), key_hash="x" * 64, scopes=["read:budgets"],
        revoked_at=None,
    )
    user = User(id=uuid4(), active=True)
    key.user = user
    db = AsyncMock()
    db.execute.return_value = MagicMock(scalar_one_or_none=lambda: key)
    got_user, got_key = await authenticate_api_key("pb_test", db)
    assert got_user.id == user.id
    assert got_key.id == key.id


@pytest.mark.asyncio
async def test_revoked_key_rejected():
    key = APIKey(
        key_hash="x" * 64, scopes=[], revoked_at=datetime.now(timezone.utc)
    )
    db = AsyncMock()
    db.execute.return_value = MagicMock(scalar_one_or_none=lambda: key)
    with pytest.raises(HTTPException) as exc:
        await authenticate_api_key("pb_test", db)
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_unknown_key_rejected():
    db = AsyncMock()
    db.execute.return_value = MagicMock(scalar_one_or_none=lambda: None)
    with pytest.raises(HTTPException) as exc:
        await authenticate_api_key("pb_unknown", db)
    assert exc.value.status_code == 401
