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
