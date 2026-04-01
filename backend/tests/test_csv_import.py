from decimal import Decimal
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from pebble.services.csv_import import parse_csv, _detect_columns, _parse_date, _parse_amount

FIXTURES = Path(__file__).parent / "fixtures"


# ---------------------------------------------------------------------------
# Unit tests: parse helpers
# ---------------------------------------------------------------------------

class TestDetectColumns:
    def test_standard_headers(self):
        cols = _detect_columns(["Date", "Description", "Amount", "Category"])
        assert cols["date"] == 0
        assert cols["name"] == 1
        assert cols["amount"] == 2
        assert cols["category"] == 3

    def test_bank_style_headers(self):
        cols = _detect_columns(["Transaction Date", "Memo", "Debit", "Credit"])
        assert cols["date"] == 0
        assert cols["name"] == 1
        assert cols["debit"] == 2
        assert cols["credit"] == 3
        assert cols["amount"] is None

    def test_case_insensitive(self):
        cols = _detect_columns(["DATE", "DESCRIPTION", "AMOUNT"])
        assert cols["date"] == 0
        assert cols["name"] == 1
        assert cols["amount"] == 2

    def test_extra_whitespace(self):
        cols = _detect_columns(["  Date ", " Description ", " Amount "])
        assert cols["date"] == 0
        assert cols["name"] == 1
        assert cols["amount"] == 2


class TestParseDate:
    def test_iso_format(self):
        d = _parse_date("2026-01-15")
        assert d.year == 2026 and d.month == 1 and d.day == 15

    def test_us_format(self):
        d = _parse_date("01/15/2026")
        assert d.year == 2026 and d.month == 1 and d.day == 15

    def test_short_year(self):
        d = _parse_date("01/15/26")
        assert d.year == 2026 and d.month == 1 and d.day == 15

    def test_invalid_date_raises(self):
        with pytest.raises(ValueError):
            _parse_date("not-a-date")


class TestParseAmount:
    def test_plain_number(self):
        assert _parse_amount("85.32") == Decimal("85.32")

    def test_negative(self):
        assert _parse_amount("-3200.00") == Decimal("-3200.00")

    def test_dollar_sign(self):
        assert _parse_amount("$1,234.56") == Decimal("1234.56")

    def test_parentheses_negative(self):
        assert _parse_amount("(50.00)") == Decimal("-50.00")

    def test_invalid_raises(self):
        with pytest.raises(Exception):
            _parse_amount("abc")


# ---------------------------------------------------------------------------
# Unit tests: parse_csv
# ---------------------------------------------------------------------------

class TestParseCSV:
    def test_standard_csv(self):
        content = (FIXTURES / "sample_transactions.csv").read_bytes()
        rows = parse_csv(content)
        assert len(rows) == 15
        assert rows[0]["date_raw"] == "2026-01-05"
        assert rows[0]["name"] == "Whole Foods Market"
        assert rows[0]["amount_raw"] == "85.32"
        assert rows[0]["category_raw"] == "Food & Drink"

    def test_debit_credit_csv(self):
        content = (FIXTURES / "sample_debit_credit.csv").read_bytes()
        rows = parse_csv(content)
        assert len(rows) == 5
        # Debit row should be positive
        assert rows[0]["amount_raw"] == "85.32"
        # Credit row should be negative (income)
        assert rows[2]["amount_raw"] == "-3200.00"

    def test_empty_csv_raises(self):
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            parse_csv(b"")
        assert exc.value.status_code == 400

    def test_headers_only_raises(self):
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            parse_csv(b"Date,Description,Amount\n")
        assert exc.value.status_code == 400

    def test_missing_date_column_raises(self):
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            parse_csv(b"Name,Amount\nTest,100\n")
        assert exc.value.status_code == 400
        assert "date" in exc.value.detail.lower()

    def test_missing_amount_column_raises(self):
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            parse_csv(b"Date,Name\n2026-01-01,Test\n")
        assert exc.value.status_code == 400
        assert "amount" in exc.value.detail.lower()

    def test_utf8_bom_handled(self):
        bom_content = b"\xef\xbb\xbfDate,Description,Amount\n2026-01-01,Test,50.00\n"
        rows = parse_csv(bom_content)
        assert len(rows) == 1
        assert rows[0]["date_raw"] == "2026-01-01"

    def test_semicolon_delimiter(self):
        content = b"Date;Description;Amount\n2026-01-01;Coffee Shop;5.50\n"
        rows = parse_csv(content)
        assert len(rows) == 1
        assert rows[0]["name"] == "Coffee Shop"

    def test_blank_rows_skipped(self):
        content = b"Date,Description,Amount\n2026-01-01,Test,10\n,,\n2026-01-02,Test2,20\n"
        rows = parse_csv(content)
        assert len(rows) == 2


# ---------------------------------------------------------------------------
# Integration tests: API endpoint
# ---------------------------------------------------------------------------

class TestImportCSVEndpoint:
    def test_successful_import(self, authed_client, fake_user, fake_db):
        csv_content = (FIXTURES / "sample_transactions.csv").read_bytes()

        # Mock: account validation returns an account
        account_id = uuid4()
        acct = MagicMock()
        acct.id = account_id

        acct_result = MagicMock()
        acct_scalars = MagicMock()
        acct_scalars.first.return_value = acct
        acct_result.scalars.return_value = acct_scalars

        # Mock: categories query returns some matches
        cat_food = MagicMock()
        cat_food.name = "Food & Drink"
        cat_food.id = uuid4()
        cat_entertainment = MagicMock()
        cat_entertainment.name = "Entertainment"
        cat_entertainment.id = uuid4()

        cat_result = MagicMock()
        cat_scalars = MagicMock()
        cat_scalars.all.return_value = [cat_food, cat_entertainment]
        cat_result.scalars.return_value = cat_scalars

        # Mock: duplicate check returns no matches
        dup_result = MagicMock()
        dup_scalars = MagicMock()
        dup_scalars.first.return_value = None
        dup_result.scalars.return_value = dup_scalars

        fake_db.execute.side_effect = [acct_result, cat_result] + [dup_result] * 15

        resp = authed_client.post(
            "/v1/transactions/import-csv",
            files={"file": ("transactions.csv", csv_content, "text/csv")},
            data={"account_id": str(account_id)},
        )

        assert resp.status_code == 201
        data = resp.json()
        assert data["imported"] == 15
        assert data["skipped"] == 0
        assert data["failed"] == 0
        assert fake_db.commit.called

    def test_rejects_non_csv(self, authed_client):
        resp = authed_client.post(
            "/v1/transactions/import-csv",
            files={"file": ("data.xlsx", b"fake excel content", "application/vnd.ms-excel")},
            data={"account_id": str(uuid4())},
        )
        assert resp.status_code == 400
        assert "CSV" in resp.json()["detail"]

    def test_rejects_empty_file(self, authed_client):
        resp = authed_client.post(
            "/v1/transactions/import-csv",
            files={"file": ("empty.csv", b"", "text/csv")},
            data={"account_id": str(uuid4())},
        )
        assert resp.status_code == 400

    def test_rejects_invalid_account(self, authed_client, fake_db):
        csv_content = b"Date,Description,Amount\n2026-01-01,Test,50\n"

        # Account not found
        acct_result = MagicMock()
        acct_scalars = MagicMock()
        acct_scalars.first.return_value = None
        acct_result.scalars.return_value = acct_scalars
        fake_db.execute.return_value = acct_result

        resp = authed_client.post(
            "/v1/transactions/import-csv",
            files={"file": ("test.csv", csv_content, "text/csv")},
            data={"account_id": str(uuid4())},
        )
        assert resp.status_code == 400
        assert "Account" in resp.json()["detail"]

    def test_skips_duplicates(self, authed_client, fake_user, fake_db):
        csv_content = b"Date,Description,Amount\n2026-01-01,Coffee,5.00\n"

        account_id = uuid4()
        acct = MagicMock()
        acct.id = account_id
        acct_result = MagicMock()
        acct_scalars = MagicMock()
        acct_scalars.first.return_value = acct
        acct_result.scalars.return_value = acct_scalars

        cat_result = MagicMock()
        cat_scalars = MagicMock()
        cat_scalars.all.return_value = []
        cat_result.scalars.return_value = cat_scalars

        # Duplicate found
        dup_result = MagicMock()
        dup_scalars = MagicMock()
        dup_scalars.first.return_value = MagicMock()  # non-None = duplicate exists
        dup_result.scalars.return_value = dup_scalars

        fake_db.execute.side_effect = [acct_result, cat_result, dup_result]

        resp = authed_client.post(
            "/v1/transactions/import-csv",
            files={"file": ("test.csv", csv_content, "text/csv")},
            data={"account_id": str(account_id)},
        )

        assert resp.status_code == 201
        data = resp.json()
        assert data["imported"] == 0
        assert data["skipped"] == 1

    def test_handles_bad_rows_gracefully(self, authed_client, fake_user, fake_db):
        csv_content = b"Date,Description,Amount\nbad-date,Test,50\n2026-01-01,Good Row,25.00\n"

        account_id = uuid4()
        acct = MagicMock()
        acct.id = account_id
        acct_result = MagicMock()
        acct_scalars = MagicMock()
        acct_scalars.first.return_value = acct
        acct_result.scalars.return_value = acct_scalars

        cat_result = MagicMock()
        cat_scalars = MagicMock()
        cat_scalars.all.return_value = []
        cat_result.scalars.return_value = cat_scalars

        dup_result = MagicMock()
        dup_scalars = MagicMock()
        dup_scalars.first.return_value = None
        dup_result.scalars.return_value = dup_scalars

        fake_db.execute.side_effect = [acct_result, cat_result, dup_result]

        resp = authed_client.post(
            "/v1/transactions/import-csv",
            files={"file": ("test.csv", csv_content, "text/csv")},
            data={"account_id": str(account_id)},
        )

        assert resp.status_code == 201
        data = resp.json()
        assert data["imported"] == 1
        assert data["failed"] == 1
        assert len(data["errors"]) == 1
        assert data["errors"][0]["row"] == 2

    def test_requires_auth(self):
        from fastapi.testclient import TestClient
        from pebble.main import app

        app.dependency_overrides.clear()
        with TestClient(app) as client:
            resp = client.post(
                "/v1/transactions/import-csv",
                files={"file": ("test.csv", b"Date,Amount\n2026-01-01,10", "text/csv")},
                data={"account_id": str(uuid4())},
            )
        assert resp.status_code in (401, 403)
