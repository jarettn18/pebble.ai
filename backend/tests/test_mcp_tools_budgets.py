import pytest
from unittest.mock import AsyncMock
from uuid import uuid4

from pebble.mcp.context import MCPRequestContext, set_context
from pebble.mcp.tools_budgets import create_budget, delete_budget
from pebble.models.api_key import APIKey
from pebble.models.user import User


@pytest.mark.asyncio
async def test_create_budget_requires_write_scope():
    user = User(id=uuid4(), active=True)
    key = APIKey(id=uuid4(), user_id=user.id, scopes=["read:budgets"])
    set_context(MCPRequestContext(user=user, api_key=key, db=AsyncMock()))
    with pytest.raises(Exception, match="write:budgets"):
        await create_budget(category_id=str(uuid4()), amount="100",
                            month=4, year=2026)


@pytest.mark.asyncio
async def test_delete_budget_calls_service(monkeypatch):
    user = User(id=uuid4(), active=True)
    key = APIKey(id=uuid4(), user_id=user.id, scopes=["write:budgets"])
    set_context(MCPRequestContext(user=user, api_key=key, db=AsyncMock()))
    called = {}
    async def fake(uid, bid, db):
        called["bid"] = bid
    monkeypatch.setattr("pebble.services.budgets.delete_budget", fake)
    bid = str(uuid4())
    result = await delete_budget(budget_id=bid)
    assert called["bid"] == bid
    assert result["deleted"] is True
