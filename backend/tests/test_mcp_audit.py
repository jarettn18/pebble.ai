from contextlib import contextmanager
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from pebble.mcp.audit_decorator import audited
from pebble.mcp.context import MCPRequestContext, reset_context, set_context
from pebble.mcp.tools_budgets import list_budgets
from pebble.models.api_key import APIKey
from pebble.models.user import User


@contextmanager
def _ctx(user, key, db):
    token = set_context(MCPRequestContext(user=user, api_key=key, db=db))
    try:
        yield
    finally:
        reset_context(token)


@pytest.mark.asyncio
async def test_audited_logs_success(monkeypatch):
    user = User(id=uuid4(), active=True)
    key = APIKey(id=uuid4(), user_id=user.id, scopes=[])
    db = AsyncMock()
    captured = {}

    async def fake(**kwargs):
        captured.update(kwargs)

    monkeypatch.setattr(
        "pebble.services.mcp_audit.write_audit_entry", fake
    )

    @audited("test_tool")
    async def tool(**kwargs):
        return {"ok": True, "x": kwargs["x"]}

    with _ctx(user, key, db):
        result = await tool(x=42)

    assert result == {"ok": True, "x": 42}
    assert captured["tool_name"] == "test_tool"
    assert captured["status"] == "ok"
    assert captured["args"] == {"x": 42}


@pytest.mark.asyncio
async def test_audited_logs_failure(monkeypatch):
    """ValueError (and other non-HTTPException errors) classify as 'error'."""
    user = User(id=uuid4(), active=True)
    key = APIKey(id=uuid4(), user_id=user.id, scopes=[])
    db = AsyncMock()
    captured = {}

    async def fake(**kwargs):
        captured.update(kwargs)

    monkeypatch.setattr(
        "pebble.services.mcp_audit.write_audit_entry", fake
    )

    @audited("test_tool")
    async def tool(**kwargs):
        raise ValueError("nope")

    with _ctx(user, key, db):
        with pytest.raises(ValueError, match="nope"):
            await tool(x=1)

    assert captured["status"] == "error"
    assert captured["error_message"] == "nope"


@pytest.mark.asyncio
async def test_audited_logs_denied_for_403(monkeypatch):
    """HTTPException with 403 status_code classifies as 'denied'."""
    user = User(id=uuid4(), active=True)
    key = APIKey(id=uuid4(), user_id=user.id, scopes=[])
    db = AsyncMock()
    captured = {}

    async def fake(**kwargs):
        captured.update(kwargs)

    monkeypatch.setattr(
        "pebble.services.mcp_audit.write_audit_entry", fake
    )

    @audited("test_tool")
    async def tool(**kwargs):
        raise HTTPException(
            status_code=403,
            detail="This key is missing required scope: read:foo",
        )

    with _ctx(user, key, db):
        with pytest.raises(HTTPException):
            await tool(x=1)

    assert captured["status"] == "denied"


@pytest.mark.asyncio
async def test_audited_passes_real_tool_kwargs(monkeypatch):
    """End-to-end: the decorator captures kwargs from a real typed-signature
    tool (list_budgets) and forwards them to the audit writer."""
    user = User(id=uuid4(), active=True)
    key = APIKey(id=uuid4(), user_id=user.id, scopes=["read:budgets"])
    db = AsyncMock()
    captured = {}

    async def fake_write(**kwargs):
        captured.update(kwargs)

    async def fake_get_budgets(user_id, db_arg, *, month=None, year=None):
        return {"budgets": []}

    monkeypatch.setattr(
        "pebble.services.mcp_audit.write_audit_entry", fake_write
    )
    monkeypatch.setattr(
        "pebble.services.budgets.get_budgets", fake_get_budgets
    )

    with _ctx(user, key, db):
        result = await list_budgets(month=4, year=2026)

    assert result == {"budgets": []}
    assert captured["tool_name"] == "list_budgets"
    assert captured["status"] == "ok"
    assert captured["args"] == {"month": 4, "year": 2026}


@pytest.mark.asyncio
async def test_audit_failure_does_not_mask_tool_result(monkeypatch):
    user = User(id=uuid4(), active=True)
    key = APIKey(id=uuid4(), user_id=user.id, scopes=["read:budgets"])

    async def boom_audit(**kwargs):
        raise RuntimeError("audit DB unreachable")
    monkeypatch.setattr(
        "pebble.services.mcp_audit.write_audit_entry", boom_audit
    )

    @audited("test_tool")
    async def my_tool(x: int) -> dict:
        return {"x": x}

    with _ctx(user, key, AsyncMock()):
        result = await my_tool(x=42)  # audit fails internally; result still returned
    assert result == {"x": 42}


@pytest.mark.asyncio
async def test_audit_failure_does_not_mask_tool_error(monkeypatch):
    user = User(id=uuid4(), active=True)
    key = APIKey(id=uuid4(), user_id=user.id, scopes=["read:budgets"])

    async def boom_audit(**kwargs):
        raise RuntimeError("audit DB unreachable")
    monkeypatch.setattr(
        "pebble.services.mcp_audit.write_audit_entry", boom_audit
    )

    @audited("bad")
    async def bad():
        raise ValueError("tool said no")

    with pytest.raises(ValueError, match="tool said no"):  # original error wins
        with _ctx(user, key, AsyncMock()):
            await bad()
