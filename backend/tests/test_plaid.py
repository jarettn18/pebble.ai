from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import httpx


def _noop_limiter():
    """Patch target for the module-level rate limiter."""
    limiter = MagicMock()
    limiter.acquire = AsyncMock()
    return limiter


def _mock_plaid_client(responses: list[httpx.Response]):
    """Helper: patch httpx.AsyncClient to return a sequence of responses.

    Each call creates a fresh async-context-manager that shares the same
    underlying ``mock_client``, so ``post.side_effect`` iterates through
    *responses* across successive ``async with`` blocks (one per retry-loop
    iteration).
    """
    mock_client = AsyncMock()
    mock_client.post.side_effect = responses

    # Each `async with httpx.AsyncClient() as c` must produce the same mock_client
    def _make_cm(*_args, **_kwargs):
        cm = MagicMock()
        cm.__aenter__ = AsyncMock(return_value=mock_client)
        cm.__aexit__ = AsyncMock(return_value=False)
        return cm

    mock_client_cls = MagicMock(side_effect=_make_cm)
    return mock_client_cls, mock_client


class TestCreateLinkToken:
    def test_returns_link_token_on_success(self, authed_client, fake_user):
        mock_response = httpx.Response(
            200,
            json={
                "link_token": "link-sandbox-test-token",
                "expiration": "2026-03-19T00:00:00Z",
                "request_id": "abc123",
            },
        )

        mock_cls, mock_client = _mock_plaid_client([mock_response])

        with (
            patch("pebble.services.plaid.httpx.AsyncClient", mock_cls),
            patch("pebble.services.plaid._plaid_limiter", _noop_limiter()),
        ):
            resp = authed_client.post("/v1/plaid/link-token")

        assert resp.status_code == 200
        data = resp.json()
        assert data["link_token"] == "link-sandbox-test-token"
        assert data["expiration"] == "2026-03-19T00:00:00Z"

        # Verify the request payload sent to Plaid
        call_kwargs = mock_client.post.call_args
        payload = call_kwargs.kwargs.get("json") or call_kwargs[1].get("json")
        assert payload["user"]["client_user_id"] == str(fake_user.id)
        assert payload["products"] == ["transactions"]
        assert payload["country_codes"] == ["US"]

    def test_returns_502_on_plaid_error(self, authed_client):
        mock_response = httpx.Response(
            400,
            json={
                "error_type": "INVALID_REQUEST",
                "error_code": "MISSING_FIELDS",
                "error_message": "client_id is missing",
            },
        )

        mock_cls, _ = _mock_plaid_client([mock_response])

        with (
            patch("pebble.services.plaid.httpx.AsyncClient", mock_cls),
            patch("pebble.services.plaid._plaid_limiter", _noop_limiter()),
        ):
            resp = authed_client.post("/v1/plaid/link-token")

        assert resp.status_code == 502
        assert resp.json()["detail"] == "client_id is missing"

    def test_requires_auth(self):
        """Endpoint should 401/403 without a token."""
        from fastapi.testclient import TestClient
        from pebble.main import app

        app.dependency_overrides.clear()
        with TestClient(app) as client:
            resp = client.post("/v1/plaid/link-token")
        assert resp.status_code in (401, 403)


class TestExchangePublicToken:
    EXCHANGE_RESPONSE = httpx.Response(
        200,
        json={
            "access_token": "access-sandbox-abc123",
            "item_id": "item-sandbox-xyz789",
            "request_id": "req1",
        },
    )

    ACCOUNTS_RESPONSE = httpx.Response(
        200,
        json={
            "accounts": [
                {
                    "account_id": "acct-1",
                    "name": "Checking",
                    "official_name": "Premium Checking",
                    "type": "depository",
                    "subtype": "checking",
                    "balances": {
                        "current": 1500.00,
                        "available": 1400.00,
                        "iso_currency_code": "USD",
                    },
                },
                {
                    "account_id": "acct-2",
                    "name": "Savings",
                    "official_name": None,
                    "type": "depository",
                    "subtype": "savings",
                    "balances": {
                        "current": 5000.00,
                        "available": 5000.00,
                        "iso_currency_code": "USD",
                    },
                },
            ],
            "request_id": "req2",
        },
    )

    def test_exchanges_token_and_stores_accounts(
        self, authed_client, fake_user, fake_db
    ):
        mock_cls, mock_client = _mock_plaid_client(
            [self.EXCHANGE_RESPONSE, self.ACCOUNTS_RESPONSE]
        )

        with (
            patch("pebble.services.plaid.httpx.AsyncClient", mock_cls),
            patch("pebble.services.plaid.encrypt_value", return_value="encrypted"),
            patch("pebble.services.plaid._plaid_limiter", _noop_limiter()),
        ):
            resp = authed_client.post(
                "/v1/plaid/exchange",
                json={
                    "public_token": "public-sandbox-token",
                    "institution_id": "ins_1",
                    "institution_name": "Chase",
                },
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["accounts_linked"] == 2
        assert data["item_id"] is not None

        # Verify PlaidItem + 2 Accounts were added to the session
        assert fake_db.add.call_count == 3
        assert fake_db.commit.called
        assert fake_db.flush.called

    def test_returns_502_on_plaid_exchange_error(self, authed_client):
        error_response = httpx.Response(
            400,
            json={
                "error_type": "INVALID_INPUT",
                "error_code": "INVALID_PUBLIC_TOKEN",
                "error_message": "the public token is invalid",
            },
        )
        mock_cls, _ = _mock_plaid_client([error_response])

        with (
            patch("pebble.services.plaid.httpx.AsyncClient", mock_cls),
            patch("pebble.services.plaid._plaid_limiter", _noop_limiter()),
        ):
            resp = authed_client.post(
                "/v1/plaid/exchange",
                json={"public_token": "bad-token"},
            )

        assert resp.status_code == 502
        assert resp.json()["detail"] == "the public token is invalid"

    def test_returns_409_on_duplicate_item(self, authed_client, fake_db):
        mock_cls, _ = _mock_plaid_client([self.EXCHANGE_RESPONSE])

        # Simulate existing item found in DB
        result = MagicMock()
        result.scalar_one_or_none.return_value = MagicMock()  # non-None = duplicate
        fake_db.execute.return_value = result

        with (
            patch("pebble.services.plaid.httpx.AsyncClient", mock_cls),
            patch("pebble.services.plaid.encrypt_value", return_value="encrypted"),
            patch("pebble.services.plaid._plaid_limiter", _noop_limiter()),
        ):
            resp = authed_client.post(
                "/v1/plaid/exchange",
                json={"public_token": "public-sandbox-token"},
            )

        assert resp.status_code == 409
        assert "already linked" in resp.json()["detail"]

    def test_requires_auth(self):
        from fastapi.testclient import TestClient
        from pebble.main import app

        app.dependency_overrides.clear()
        with TestClient(app) as client:
            resp = client.post(
                "/v1/plaid/exchange",
                json={"public_token": "test"},
            )
        assert resp.status_code in (401, 403)


def _empty_category_result():
    """Mock result for get_plaid_category_map query (returns no rows)."""
    result = MagicMock()
    result.all.return_value = []
    return result


def _empty_scalar_result():
    """Mock result for queries that return no rows (e.g. get_category_id_by_name)."""
    result = MagicMock()
    result.first.return_value = None
    result.scalar_one_or_none.return_value = None
    return result


class TestSyncTransactions:
    SYNC_RESPONSE = httpx.Response(
        200,
        json={
            "added": [
                {
                    "transaction_id": "txn-1",
                    "account_id": "plaid-acct-1",
                    "amount": 42.50,
                    "date": "2026-03-15",
                    "name": "Grocery Store",
                    "merchant_name": "Whole Foods",
                    "pending": False,
                    "personal_finance_category": {
                        "primary": "FOOD_AND_DRINK",
                        "detailed": "FOOD_AND_DRINK_GROCERIES",
                        "confidence_level": "VERY_HIGH",
                    },
                },
                {
                    "transaction_id": "txn-2",
                    "account_id": "plaid-acct-1",
                    "amount": 9.99,
                    "date": "2026-03-16",
                    "name": "Streaming Service",
                    "merchant_name": "Netflix",
                    "pending": False,
                    "personal_finance_category": {
                        "primary": "ENTERTAINMENT",
                        "detailed": "ENTERTAINMENT_TV_AND_MOVIES",
                        "confidence_level": "VERY_HIGH",
                    },
                },
            ],
            "modified": [],
            "removed": [],
            "has_more": False,
            "next_cursor": "cursor-abc",
        },
    )

    def _make_plaid_item(self, user_id):
        item = MagicMock()
        item.id = uuid4()
        item.user_id = user_id
        item.access_token_encrypted = "encrypted-token"
        item.cursor = None
        return item

    def _make_account(self, plaid_item_id):
        acct = MagicMock()
        acct.id = uuid4()
        acct.plaid_item_id = plaid_item_id
        acct.plaid_account_id = "plaid-acct-1"
        return acct

    def test_syncs_added_transactions(self, authed_client, fake_user, fake_db):
        plaid_item = self._make_plaid_item(fake_user.id)
        account = self._make_account(plaid_item.id)

        # First execute returns PlaidItem, second returns accounts list
        item_result = MagicMock()
        item_result.scalar_one_or_none.return_value = plaid_item

        acct_result = MagicMock()
        acct_scalars = MagicMock()
        acct_scalars.all.return_value = [account]
        acct_result.scalars.return_value = acct_scalars

        fake_db.execute.side_effect = [
            item_result, acct_result, _empty_category_result(),
            _empty_scalar_result(), _empty_scalar_result(),  # get_category_id_by_name x2
        ]

        mock_cls, _ = _mock_plaid_client([self.SYNC_RESPONSE])

        with (
            patch("pebble.services.plaid.httpx.AsyncClient", mock_cls),
            patch("pebble.services.plaid.decrypt_value", return_value="access-sandbox"),
            patch("pebble.services.plaid._plaid_limiter", _noop_limiter()),
        ):
            resp = authed_client.post(
                "/v1/plaid/sync",
                json={"item_id": str(plaid_item.id)},
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["added"] == 2
        assert data["modified"] == 0
        assert data["removed"] == 0

        # 2 transactions added
        assert fake_db.add.call_count == 2
        assert fake_db.commit.called
        # Cursor updated
        assert plaid_item.cursor == "cursor-abc"

    def test_syncs_modified_transactions(self, authed_client, fake_user, fake_db):
        plaid_item = self._make_plaid_item(fake_user.id)
        account = self._make_account(plaid_item.id)

        existing_txn = MagicMock()
        existing_txn.amount = 40.00
        existing_txn.name = "Old Name"

        sync_response = httpx.Response(
            200,
            json={
                "added": [],
                "modified": [
                    {
                        "transaction_id": "txn-1",
                        "account_id": "plaid-acct-1",
                        "amount": 45.00,
                        "date": "2026-03-15",
                        "name": "Updated Store",
                        "merchant_name": "Whole Foods",
                        "pending": False,
                    },
                ],
                "removed": [],
                "has_more": False,
                "next_cursor": "cursor-def",
            },
        )

        item_result = MagicMock()
        item_result.scalar_one_or_none.return_value = plaid_item
        acct_result = MagicMock()
        acct_scalars = MagicMock()
        acct_scalars.all.return_value = [account]
        acct_result.scalars.return_value = acct_scalars
        txn_result = MagicMock()
        txn_result.scalar_one_or_none.return_value = existing_txn

        fake_db.execute.side_effect = [
            item_result, acct_result, _empty_category_result(),
            _empty_scalar_result(), _empty_scalar_result(),  # get_category_id_by_name x2
            txn_result,
        ]

        mock_cls, _ = _mock_plaid_client([sync_response])

        with (
            patch("pebble.services.plaid.httpx.AsyncClient", mock_cls),
            patch("pebble.services.plaid.decrypt_value", return_value="access-sandbox"),
            patch("pebble.services.plaid._plaid_limiter", _noop_limiter()),
        ):
            resp = authed_client.post(
                "/v1/plaid/sync",
                json={"item_id": str(plaid_item.id)},
            )

        assert resp.status_code == 200
        assert resp.json()["modified"] == 1
        assert existing_txn.amount == 45.00
        assert existing_txn.name == "Updated Store"

    def test_syncs_removed_transactions(self, authed_client, fake_user, fake_db):
        plaid_item = self._make_plaid_item(fake_user.id)
        account = self._make_account(plaid_item.id)

        sync_response = httpx.Response(
            200,
            json={
                "added": [],
                "modified": [],
                "removed": [
                    {"transaction_id": "txn-old-1"},
                    {"transaction_id": "txn-old-2"},
                ],
                "has_more": False,
                "next_cursor": "cursor-ghi",
            },
        )

        item_result = MagicMock()
        item_result.scalar_one_or_none.return_value = plaid_item
        acct_result = MagicMock()
        acct_scalars = MagicMock()
        acct_scalars.all.return_value = [account]
        acct_result.scalars.return_value = acct_scalars

        fake_db.execute.side_effect = [
            item_result, acct_result, _empty_category_result(),
            _empty_scalar_result(), _empty_scalar_result(),  # get_category_id_by_name x2
            MagicMock(),  # delete for removed transactions
        ]

        mock_cls, _ = _mock_plaid_client([sync_response])

        with (
            patch("pebble.services.plaid.httpx.AsyncClient", mock_cls),
            patch("pebble.services.plaid.decrypt_value", return_value="access-sandbox"),
            patch("pebble.services.plaid._plaid_limiter", _noop_limiter()),
        ):
            resp = authed_client.post(
                "/v1/plaid/sync",
                json={"item_id": str(plaid_item.id)},
            )

        assert resp.status_code == 200
        assert resp.json()["removed"] == 2

    def test_returns_404_for_unknown_item(self, authed_client, fake_db):
        result = MagicMock()
        result.scalar_one_or_none.return_value = None
        fake_db.execute.return_value = result

        resp = authed_client.post(
            "/v1/plaid/sync",
            json={"item_id": str(uuid4())},
        )

        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"]

    def test_requires_auth(self):
        from fastapi.testclient import TestClient
        from pebble.main import app

        app.dependency_overrides.clear()
        with TestClient(app) as client:
            resp = client.post(
                "/v1/plaid/sync",
                json={"item_id": str(uuid4())},
            )
        assert resp.status_code in (401, 403)
