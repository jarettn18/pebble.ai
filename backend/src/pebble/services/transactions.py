import uuid
from datetime import date as date_type
from decimal import Decimal, InvalidOperation

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from pebble.models.transaction import Transaction


async def get_transactions(
    user_id: str,
    db: AsyncSession,
    limit: int = 50,
    offset: int = 0,
    search: str | None = None,
    category_id: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    txn_type: str | None = None,
    account_id: str | None = None,
) -> dict:
    filters = [Transaction.user_id == user_id]

    if account_id:
        try:
            filters.append(Transaction.account_id == uuid.UUID(account_id))
        except ValueError:
            pass

    if search:
        pattern = f"%{search}%"
        filters.append(
            Transaction.name.ilike(pattern) | Transaction.merchant_name.ilike(pattern)
        )

    if category_id:
        cat_ids = [c.strip() for c in category_id.split(",") if c.strip()]
        valid_uuids = []
        for cid in cat_ids:
            try:
                valid_uuids.append(uuid.UUID(cid))
            except ValueError:
                pass
        if len(valid_uuids) == 1:
            filters.append(Transaction.category_id == valid_uuids[0])
        elif valid_uuids:
            filters.append(Transaction.category_id.in_(valid_uuids))

    if date_from:
        try:
            filters.append(Transaction.date >= date_type.fromisoformat(date_from))
        except ValueError:
            pass

    if date_to:
        try:
            filters.append(Transaction.date <= date_type.fromisoformat(date_to))
        except ValueError:
            pass

    if txn_type == "expense":
        filters.append(Transaction.amount >= 0)
    elif txn_type == "income":
        filters.append(Transaction.amount < 0)

    query = (
        select(Transaction)
        .where(*filters)
        .options(joinedload(Transaction.category), joinedload(Transaction.account))
        .order_by(Transaction.date.desc(), Transaction.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(query)
    rows = result.scalars().unique().all()

    count_result = await db.execute(
        select(func.count()).select_from(Transaction).where(*filters)
    )
    total = count_result.scalar() or 0

    transactions = [
        {
            "id": str(t.id),
            "account_id": str(t.account_id),
            "account_name": t.account.name if t.account else None,
            "amount": str(t.amount),
            "date": t.date.isoformat(),
            "name": t.name,
            "merchant_name": t.merchant_name,
            "pending": t.pending,
            "category_name": t.category.name if t.category else None,
        }
        for t in rows
    ]

    return {"transactions": transactions, "count": total}


def _txn_to_detail(t: Transaction) -> dict:
    return {
        "id": str(t.id),
        "account_id": str(t.account_id),
        "amount": str(t.amount),
        "date": t.date.isoformat(),
        "name": t.name,
        "merchant_name": t.merchant_name,
        "pending": t.pending,
        "category_name": t.category.name if t.category else None,
        "category_id": str(t.category_id) if t.category_id else None,
        "notes": t.notes,
    }


async def get_transaction(
    user_id: str,
    transaction_id: str,
    db: AsyncSession,
) -> dict:
    try:
        txn_uuid = uuid.UUID(transaction_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    result = await db.execute(
        select(Transaction)
        .where(Transaction.id == txn_uuid, Transaction.user_id == user_id)
        .options(joinedload(Transaction.category))
    )
    txn = result.scalars().unique().one_or_none()
    if not txn:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    return _txn_to_detail(txn)


async def create_transaction(
    user_id: str,
    data: dict,
    db: AsyncSession,
) -> dict:
    # Validate account belongs to user
    from pebble.models.account import Account

    try:
        acct_uuid = uuid.UUID(data["account_id"])
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid account_id")

    result = await db.execute(
        select(Account).where(Account.id == acct_uuid, Account.user_id == user_id)
    )
    if not result.scalars().first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Account not found")

    try:
        amount = Decimal(data["amount"])
    except (InvalidOperation, ValueError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid amount")

    try:
        txn_date = date_type.fromisoformat(data["date"])
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid date format, use YYYY-MM-DD")

    category_id = None
    if data.get("category_id"):
        try:
            category_id = uuid.UUID(data["category_id"])
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid category_id")

    txn = Transaction(
        user_id=user_id,
        account_id=acct_uuid,
        amount=amount,
        date=txn_date,
        name=data["name"],
        merchant_name=data.get("merchant_name"),
        category_id=category_id,
        notes=data.get("notes"),
        pending=False,
    )
    db.add(txn)
    await db.commit()
    await db.refresh(txn, ["category"])

    return _txn_to_detail(txn)


async def delete_transaction(
    user_id: str,
    transaction_id: str,
    db: AsyncSession,
) -> None:
    try:
        txn_uuid = uuid.UUID(transaction_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    result = await db.execute(
        select(Transaction).where(Transaction.id == txn_uuid, Transaction.user_id == user_id)
    )
    txn = result.scalars().first()
    if not txn:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    await db.delete(txn)
    await db.commit()


async def update_transaction(
    user_id: str,
    transaction_id: str,
    updates: dict,
    db: AsyncSession,
) -> dict:
    try:
        txn_uuid = uuid.UUID(transaction_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    result = await db.execute(
        select(Transaction)
        .where(Transaction.id == txn_uuid, Transaction.user_id == user_id)
        .options(joinedload(Transaction.category))
    )
    txn = result.scalars().unique().one_or_none()
    if not txn:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    if "category_id" in updates:
        val = updates["category_id"]
        txn.category_id = uuid.UUID(val) if val else None
    if "notes" in updates:
        txn.notes = updates["notes"]

    await db.commit()
    await db.refresh(txn, ["category"])

    return _txn_to_detail(txn)
