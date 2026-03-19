from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from pebble.database import get_db
from pebble.main import app
from pebble.middleware.auth import get_current_user
from pebble.models.user import User


def _make_fake_user(**overrides):
    defaults = {
        "id": uuid4(),
        "email": "test@example.com",
        "full_name": "Test User",
        "hashed_password": "fake",
        "subscription_tier": "free",
    }
    defaults.update(overrides)
    user = AsyncMock(spec=User)
    for k, v in defaults.items():
        setattr(user, k, v)
    return user


def _make_fake_db():
    db = AsyncMock()
    # execute() returns a result whose scalar_one_or_none() returns None (no duplicates)
    result = MagicMock()
    result.scalar_one_or_none.return_value = None
    db.execute.return_value = result
    return db


@pytest.fixture()
def fake_user():
    return _make_fake_user()


@pytest.fixture()
def fake_db():
    return _make_fake_db()


@pytest.fixture()
def authed_client(fake_user, fake_db):
    """TestClient with auth and db bypassed."""

    async def _override_user():
        return fake_user

    async def _override_db():
        yield fake_db

    app.dependency_overrides[get_current_user] = _override_user
    app.dependency_overrides[get_db] = _override_db
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()
