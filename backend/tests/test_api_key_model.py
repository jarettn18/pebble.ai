from datetime import datetime, timezone

from pebble.models.api_key import APIKey


def test_api_key_is_active_when_not_revoked():
    key = APIKey(revoked_at=None)
    assert key.is_active is True


def test_api_key_is_inactive_when_revoked():
    key = APIKey(revoked_at=datetime.now(timezone.utc))
    assert key.is_active is False


def test_api_key_has_scope():
    key = APIKey(scopes=["read:budgets", "write:budgets"])
    assert key.has_scope("read:budgets") is True
    assert key.has_scope("read:transactions") is False
