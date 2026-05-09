from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from pebble.main import app
from pebble.mcp.rate_limit import _limiter
from pebble.models.api_key import APIKey
from pebble.models.user import User


@pytest.fixture()
def _patch_auth(monkeypatch):
    """Make authenticate_api_key always succeed with a fake user/key."""
    user = User(
        id=uuid4(),
        active=True,
        email="t@example.com",
        full_name="T",
        hashed_password="x",
    )
    key = APIKey(id=uuid4(), user_id=user.id, scopes=["read:budgets"])

    async def fake_auth(raw_key, db):
        return user, key

    monkeypatch.setattr(
        "pebble.mcp.auth_middleware.authenticate_api_key", fake_auth
    )
    return user, key


def test_mcp_returns_429_when_rate_limit_hit(_patch_auth):
    user, key = _patch_auth
    saved = (_limiter.per_minute, _limiter.per_day)
    _limiter.per_minute = 1
    _limiter._minute.clear()
    _limiter._day.clear()
    try:
        with TestClient(app) as client:
            # First request consumes the only slot
            client.post(
                "/mcp/",
                headers={"Authorization": "Bearer pb_test"},
                json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"},
            )
            # Don't assert on r1's status — the inner MCP transport may 400
            # without a session; we only care that auth + rate-limit ran.
            # Second request should be rate-limited
            r2 = client.post(
                "/mcp/",
                headers={"Authorization": "Bearer pb_test"},
                json={"jsonrpc": "2.0", "id": 2, "method": "tools/list"},
            )
            assert r2.status_code == 429
            assert r2.headers["Retry-After"]
            assert r2.json()["error"] == "Rate limit exceeded"
    finally:
        _limiter.per_minute, _limiter.per_day = saved
        _limiter._minute.clear()
        _limiter._day.clear()
