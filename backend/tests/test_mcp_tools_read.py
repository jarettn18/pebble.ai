import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock
from uuid import uuid4

from pebble.mcp.context import MCPRequestContext, set_context
from pebble.mcp.tools_read import get_account_balances
from pebble.models.api_key import APIKey
from pebble.models.user import User


@pytest.fixture(autouse=True)
def _stub_audit(monkeypatch):
    async def _noop(**kwargs):
        return None
    monkeypatch.setattr(
        "pebble.services.mcp_audit.write_audit_entry", _noop
    )


@pytest.mark.asyncio
async def test_read_tool_denied_without_scope():
    user = User(id=uuid4(), active=True)
    key = APIKey(id=uuid4(), user_id=user.id, scopes=["read:budgets"])
    db = AsyncMock()
    set_context(MCPRequestContext(user=user, api_key=key, db=db))
    with pytest.raises(Exception, match="read:accounts"):
        await get_account_balances()


@pytest.mark.asyncio
async def test_read_tool_calls_data_access_with_user_id(monkeypatch):
    user = User(id=uuid4(), active=True)
    key = APIKey(id=uuid4(), user_id=user.id, scopes=["read:accounts"])
    db = AsyncMock()
    set_context(MCPRequestContext(user=user, api_key=key, db=db))

    called = {}
    async def fake(user_id, db_arg):
        called["user_id"] = user_id
        return {"net_worth": "1000.00"}
    monkeypatch.setattr(
        "pebble.ai.data_access.get_account_balances", fake
    )
    result = await get_account_balances()
    assert called["user_id"] == str(user.id)
    assert result["net_worth"] == "1000.00"
