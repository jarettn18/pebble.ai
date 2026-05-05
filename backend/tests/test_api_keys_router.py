def test_create_api_key_returns_raw_once(authed_client, fake_user, fake_db):
    # patch service
    from pebble.services import api_keys as svc
    from pebble.models.api_key import APIKey
    from uuid import uuid4
    from datetime import datetime, timezone

    fake_key = APIKey(
        id=uuid4(), user_id=fake_user.id, key_hash="x"*64,
        name="Claude", scopes=["read:budgets"],
        revoked_at=None, last_used_at=None,
        created_at=datetime.now(timezone.utc),
    )
    async def fake_create(user_id, db, *, name, scopes):
        return ("pb_secret123", fake_key)
    monkeypatched = svc.create_api_key
    svc.create_api_key = fake_create
    try:
        r = authed_client.post(
            "/v1/api-keys",
            json={"name": "Claude", "scopes": ["read:budgets"]},
        )
        assert r.status_code == 201
        body = r.json()
        assert body["raw_key"] == "pb_secret123"
        assert body["api_key"]["name"] == "Claude"
    finally:
        svc.create_api_key = monkeypatched
