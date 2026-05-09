import csv
import io
import uuid
from datetime import date as date_type
from decimal import Decimal, InvalidOperation

from fastapi import HTTPException, status
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from pebble.models.account import Account
from pebble.models.category import Category
from pebble.models.transaction import Transaction
from pebble.schemas.csv_import import CSVImportError, CSVImportResponse
from pebble.services.health_score import invalidate_health_score_cache

MAX_ROWS = 5_000

DATE_ALIASES = {"date", "transaction date", "posting date", "posted date", "trans date", "settlement date"}
NAME_ALIASES = {"description", "name", "memo", "payee", "narrative", "details", "transaction description", "particulars"}
AMOUNT_ALIASES = {"amount", "transaction amount", "value"}
DEBIT_ALIASES = {"debit", "debit amount", "withdrawals", "money out"}
CREDIT_ALIASES = {"credit", "credit amount", "deposits", "money in"}
CATEGORY_ALIASES = {"category", "type", "transaction type", "transaction category"}

DATE_FORMATS = ["%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y", "%d/%m/%Y", "%Y/%m/%d"]


def _normalize(header: str) -> str:
    return header.strip().lower().replace("_", " ")


def _detect_columns(headers: list[str]) -> dict[str, int | None]:
    mapping: dict[str, int | None] = {
        "date": None,
        "name": None,
        "amount": None,
        "debit": None,
        "credit": None,
        "category": None,
    }
    for i, h in enumerate(headers):
        norm = _normalize(h)
        if norm in DATE_ALIASES:
            mapping["date"] = i
        elif norm in NAME_ALIASES:
            mapping["name"] = i
        elif norm in AMOUNT_ALIASES:
            mapping["amount"] = i
        elif norm in DEBIT_ALIASES:
            mapping["debit"] = i
        elif norm in CREDIT_ALIASES:
            mapping["credit"] = i
        elif norm in CATEGORY_ALIASES:
            mapping["category"] = i
    return mapping


def _parse_date(value: str) -> date_type:
    value = value.strip()
    from datetime import datetime

    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"Cannot parse date: {value}")


def _parse_amount(value: str) -> Decimal:
    value = value.strip().replace("$", "").replace(",", "")
    if value.startswith("(") and value.endswith(")"):
        value = "-" + value[1:-1]
    return Decimal(value).quantize(Decimal("0.01"))


def parse_csv(file_content: bytes) -> list[dict]:
    # Strip BOM and decode
    if file_content.startswith(b"\xef\xbb\xbf"):
        file_content = file_content[3:]

    try:
        text = file_content.decode("utf-8")
    except UnicodeDecodeError:
        text = file_content.decode("latin-1")

    # Detect delimiter
    sample = text[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
    except csv.Error:
        dialect = csv.excel

    reader = csv.reader(io.StringIO(text), dialect)

    try:
        headers = next(reader)
    except StopIteration:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV file is empty",
        )

    col_map = _detect_columns(headers)

    has_amount = col_map["amount"] is not None
    has_debit_credit = col_map["debit"] is not None or col_map["credit"] is not None

    if col_map["date"] is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not detect a date column. Expected headers like: date, transaction date, posting date",
        )
    if not has_amount and not has_debit_credit:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not detect an amount column. Expected headers like: amount, debit, credit",
        )

    rows: list[dict] = []
    for row in reader:
        if len(rows) >= MAX_ROWS:
            break
        if not any(cell.strip() for cell in row):
            continue  # skip blank rows

        parsed: dict = {}
        parsed["date_raw"] = row[col_map["date"]] if col_map["date"] < len(row) else ""

        if col_map["name"] is not None and col_map["name"] < len(row):
            parsed["name"] = row[col_map["name"]].strip()
        else:
            parsed["name"] = ""

        if has_amount and col_map["amount"] < len(row):
            parsed["amount_raw"] = row[col_map["amount"]].strip()
        elif has_debit_credit:
            debit_val = ""
            credit_val = ""
            if col_map["debit"] is not None and col_map["debit"] < len(row):
                debit_val = row[col_map["debit"]].strip()
            if col_map["credit"] is not None and col_map["credit"] < len(row):
                credit_val = row[col_map["credit"]].strip()
            # Debit = money out (positive in Plaid convention), Credit = money in (negative)
            if debit_val and debit_val not in ("", "0", "0.00"):
                parsed["amount_raw"] = debit_val
            elif credit_val and credit_val not in ("", "0", "0.00"):
                parsed["amount_raw"] = "-" + credit_val.lstrip("-")
            else:
                parsed["amount_raw"] = "0"
        else:
            parsed["amount_raw"] = ""

        if col_map["category"] is not None and col_map["category"] < len(row):
            parsed["category_raw"] = row[col_map["category"]].strip()
        else:
            parsed["category_raw"] = ""

        rows.append(parsed)

    if not rows:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV file contains no data rows",
        )

    return rows


async def validate_account(user_id: str, account_id: str, db: AsyncSession) -> uuid.UUID:
    try:
        acct_uuid = uuid.UUID(account_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid account_id",
        )

    result = await db.execute(
        select(Account).where(Account.id == acct_uuid, Account.user_id == user_id)
    )
    if not result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account not found or does not belong to user",
        )
    return acct_uuid


async def import_transactions(
    user_id: str,
    account_id: uuid.UUID,
    rows: list[dict],
    db: AsyncSession,
) -> CSVImportResponse:
    # Load categories for name matching
    cat_result = await db.execute(select(Category))
    categories = {c.name.lower(): c.id for c in cat_result.scalars().all()}

    imported = 0
    skipped = 0
    failed = 0
    errors: list[CSVImportError] = []

    uid = uuid.UUID(user_id) if isinstance(user_id, str) else user_id

    for i, row in enumerate(rows, start=2):  # row 1 is header
        # Parse date
        try:
            txn_date = _parse_date(row["date_raw"])
        except (ValueError, KeyError):
            failed += 1
            errors.append(CSVImportError(row=i, reason=f"Invalid date: {row.get('date_raw', '')[:50]}"))
            continue

        # Parse amount
        try:
            amount = _parse_amount(row["amount_raw"])
        except (InvalidOperation, ValueError, KeyError):
            failed += 1
            errors.append(CSVImportError(row=i, reason=f"Invalid amount: {row.get('amount_raw', '')[:50]}"))
            continue

        name = (row.get("name", "").strip() or "Imported Transaction")[:255]

        # Resolve category
        category_id = None
        cat_raw = row.get("category_raw", "").strip().lower()
        if cat_raw and cat_raw in categories:
            category_id = categories[cat_raw]

        # Check for duplicates
        dup_result = await db.execute(
            select(Transaction.id).where(
                and_(
                    Transaction.user_id == uid,
                    Transaction.account_id == account_id,
                    Transaction.date == txn_date,
                    Transaction.name == name,
                    Transaction.amount == amount,
                )
            ).limit(1)
        )
        if dup_result.scalars().first():
            skipped += 1
            continue

        txn = Transaction(
            user_id=uid,
            account_id=account_id,
            amount=amount,
            date=txn_date,
            name=name,
            category_id=category_id,
            pending=False,
        )
        db.add(txn)
        imported += 1

    if imported > 0:
        await db.commit()
        await invalidate_health_score_cache(str(uid))

    return CSVImportResponse(
        imported=imported,
        skipped=skipped,
        failed=failed,
        errors=errors[:50],  # cap error list
    )
