from contextlib import contextmanager
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from pebble.mcp.audit_decorator import audited
from pebble.mcp.context import MCPRequestContext, reset_context, set_context
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
