import uuid

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
) -> dict:
    query = (
        select(Transaction)
        .where(Transaction.user_id == user_id)
        .options(joinedload(Transaction.category))
        .order_by(Transaction.date.desc(), Transaction.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(query)
    rows = result.scalars().unique().all()

    count_result = await db.execute(
        select(func.count()).select_from(Transaction).where(Transaction.user_id == user_id)
    )
    total = count_result.scalar() or 0

    transactions = [
        {
            "id": str(t.id),
            "account_id": str(t.account_id),
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
