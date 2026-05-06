from contextlib import contextmanager
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from pebble.mcp.context import MCPRequestContext, reset_context, set_context
from pebble.mcp.tools_budgets import (
    create_budget,
    delete_budget,
    list_budgets,
    update_budget,
)
from pebble.models.api_key import APIKey
from pebble.models.user import User


@contextmanager
def _ctx(user, key, db):
    token = set_context(MCPRequestContext(user=user, api_key=key, db=db))
    try:
        yield
    finally:
        reset_context(token)


@pytest.fixture(autouse=True)
def _stub_audit(monkeypatch):
    async def _noop(**kwargs):
        return None
    monkeypatch.setattr(
        "pebble.services.mcp_audit.write_audit_entry", _noop
    )


@pytest.mark.asyncio
async def test_create_budget_requires_write_scope():
    user = User(id=uuid4(), active=True)
    key = APIKey(id=uuid4(), user_id=user.id, scopes=["read:budgets"])
    with _ctx(user, key, AsyncMock()):
        with pytest.raises(Exception, match="write:budgets"):
            await create_budget(category_id=str(uuid4()), amount="100",
                                month=4, year=2026)


@pytest.mark.asyncio
async def test_delete_budget_calls_service(monkeypatch):
    user = User(id=uuid4(), active=True)
    key = APIKey(id=uuid4(), user_id=user.id, scopes=["write:budgets"])
    db_mock = AsyncMock()
    called = {}

    async def fake(uid, bid, db):
        called["uid"] = uid
        called["bid"] = bid
        called["db"] = db

    monkeypatch.setattr("pebble.services.budgets.delete_budget", fake)
    bid = str(uuid4())
    with _ctx(user, key, db_mock):
        result = await delete_budget(budget_id=bid)
    assert called["bid"] == bid
    assert called["uid"] == str(user.id)
    assert called["db"] is db_mock
    assert result["deleted"] is True


@pytest.mark.asyncio
async def test_update_budget_filters_none_values(monkeypatch):
    user = User(id=uuid4(), active=True)
    key = APIKey(id=uuid4(), user_id=user.id, scopes=["write:budgets"])
    captured = {}

    async def fake(uid, bid, payload, db):
        captured["payload"] = payload
        return {}

    monkeypatch.setattr("pebble.services.budgets.update_budget", fake)
    with _ctx(user, key, AsyncMock()):
        await update_budget(budget_id=str(uuid4()), amount="50.00")
    assert captured["payload"] == {"amount": "50.00"}


@pytest.mark.asyncio
async def test_list_budgets_requires_read_scope():
    user = User(id=uuid4(), active=True)
    key = APIKey(id=uuid4(), user_id=user.id, scopes=[])
    with _ctx(user, key, AsyncMock()):
        with pytest.raises(Exception, match="read:budgets"):
            await list_budgets()


@pytest.mark.asyncio
async def test_create_budget_passes_payload_to_service(monkeypatch):
    user = User(id=uuid4(), active=True)
    key = APIKey(id=uuid4(), user_id=user.id, scopes=["write:budgets"])
    captured = {}

    async def fake(uid, data, db):
        captured["data"] = data
        return {}

    monkeypatch.setattr("pebble.services.budgets.create_budget", fake)
    cid = str(uuid4())
    with _ctx(user, key, AsyncMock()):
        await create_budget(category_id=cid, amount="250.00",
                            month=4, year=2026)
    assert captured["data"] == {
        "category_id": cid,
        "amount": "250.00",
        "month": 4,
        "year": 2026,
    }
