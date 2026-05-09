import pytest
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock

from pebble.services.api_keys import (
    VALID_SCOPES,
    create_api_key,
    list_api_keys,
    revoke_api_key,
)


@pytest.mark.asyncio
async def test_create_returns_raw_key_once():
    db = AsyncMock()
    user_id = str(uuid4())
    raw, key = await create_api_key(
        user_id, db, name="Claude Desktop",
        scopes=["read:budgets", "read:transactions"],
    )
    assert raw.startswith("pb_")
    assert key.name == "Claude Desktop"
    assert set(key.scopes) == {"read:budgets", "read:transactions"}
    db.add.assert_called_once()
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_create_rejects_invalid_scope():
    db = AsyncMock()
    with pytest.raises(ValueError, match="Unknown scope"):
        await create_api_key(
            str(uuid4()), db, name="x", scopes=["read:passwords"]
        )


def test_valid_scopes_includes_v1_set():
    assert VALID_SCOPES == {
        "read:transactions",
        "read:accounts",
        "read:budgets",
        "write:budgets",
        "read:insights",
    }
