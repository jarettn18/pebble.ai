import uuid
from datetime import date
from decimal import Decimal, InvalidOperation

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from pebble.models.budget import Budget
from pebble.models.category import Category
from pebble.models.transaction import Transaction
from pebble.services.health_score import invalidate_health_score_cache


def _budget_to_dict(b: Budget, spent: Decimal = Decimal("0")) -> dict:
    return {
        "id": str(b.id),
        "category_id": str(b.category_id),
        "category_name": b.category.name if b.category else None,
        "category_color": b.category.color if b.category else None,
        "amount": str(b.amount),
        "spent": str(spent),
        "month": b.month,
        "year": b.year,
    }


async def _get_spending_by_category(
    user_id: str,
    month: int,
    year: int,
    db: AsyncSession,
) -> dict[uuid.UUID, Decimal]:
    """Sum positive (debit) transaction amounts per category for a given month."""
    first_day = date(year, month, 1)
    if month == 12:
        last_day = date(year + 1, 1, 1)
    else:
        last_day = date(year, month + 1, 1)

    result = await db.execute(
        select(
            Transaction.category_id,
            func.coalesce(func.sum(Transaction.amount), 0),
        )
        .where(
            Transaction.user_id == user_id,
            Transaction.date >= first_day,
            Transaction.date < last_day,
            Transaction.pending.is_(False),
            Transaction.amount > 0,
            Transaction.category_id.isnot(None),
        )
        .group_by(Transaction.category_id)
    )
    return {row[0]: row[1] for row in result.all()}


async def _validate_category(category_id: str, db: AsyncSession) -> uuid.UUID:
    try:
        cat_uuid = uuid.UUID(category_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid category_id")

    result = await db.execute(select(Category).where(Category.id == cat_uuid))
    if not result.scalars().first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Category not found")
    return cat_uuid


async def get_budgets(
    user_id: str,
    db: AsyncSession,
    month: int | None = None,
    year: int | None = None,
) -> dict:
    query = (
        select(Budget)
        .where(Budget.user_id == user_id)
        .options(joinedload(Budget.category))
        .order_by(Budget.year.desc(), Budget.month.desc())
    )
    if month is not None:
        query = query.where(Budget.month == month)
    if year is not None:
        query = query.where(Budget.year == year)

    result = await db.execute(query)
    rows = result.scalars().unique().all()

    # Get spending per category for the requested period
    spending: dict[uuid.UUID, Decimal] = {}
    if month is not None and year is not None:
        spending = await _get_spending_by_category(user_id, month, year, db)

    return {
        "budgets": [
            _budget_to_dict(b, spending.get(b.category_id, Decimal("0")))
            for b in rows
        ]
    }


async def get_budget(
    user_id: str,
    budget_id: str,
    db: AsyncSession,
) -> dict:
    try:
        bid = uuid.UUID(budget_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Budget not found")

    result = await db.execute(
        select(Budget)
        .where(Budget.id == bid, Budget.user_id == user_id)
        .options(joinedload(Budget.category))
    )
    budget = result.scalars().unique().one_or_none()
    if not budget:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Budget not found")

    spending = await _get_spending_by_category(user_id, budget.month, budget.year, db)
    return _budget_to_dict(budget, spending.get(budget.category_id, Decimal("0")))


async def create_budget(
    user_id: str,
    data: dict,
    db: AsyncSession,
) -> dict:
    cat_uuid = await _validate_category(data["category_id"], db)

    try:
        amount = Decimal(data["amount"])
    except (InvalidOperation, ValueError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid amount")

    budget = Budget(
        user_id=user_id,
        category_id=cat_uuid,
        amount=amount,
        month=data["month"],
        year=data["year"],
    )
    db.add(budget)
    await db.commit()
    await db.refresh(budget, ["category"])
    await invalidate_health_score_cache(user_id)
    return _budget_to_dict(budget)


async def update_budget(
    user_id: str,
    budget_id: str,
    updates: dict,
    db: AsyncSession,
) -> dict:
    try:
        bid = uuid.UUID(budget_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Budget not found")

    result = await db.execute(
        select(Budget)
        .where(Budget.id == bid, Budget.user_id == user_id)
        .options(joinedload(Budget.category))
    )
    budget = result.scalars().unique().one_or_none()
    if not budget:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Budget not found")

    if "category_id" in updates and updates["category_id"] is not None:
        budget.category_id = await _validate_category(updates["category_id"], db)
    if "amount" in updates and updates["amount"] is not None:
        try:
            budget.amount = Decimal(updates["amount"])
        except (InvalidOperation, ValueError):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid amount")
    if "month" in updates and updates["month"] is not None:
        budget.month = updates["month"]
    if "year" in updates and updates["year"] is not None:
        budget.year = updates["year"]

    await db.commit()
    await db.refresh(budget, ["category"])
    await invalidate_health_score_cache(user_id)
    return _budget_to_dict(budget)


async def delete_budget(
    user_id: str,
    budget_id: str,
    db: AsyncSession,
) -> None:
    try:
        bid = uuid.UUID(budget_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Budget not found")

    result = await db.execute(
        select(Budget).where(Budget.id == bid, Budget.user_id == user_id)
    )
    budget = result.scalars().one_or_none()
    if not budget:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Budget not found")

    await db.delete(budget)
    await db.commit()
    await invalidate_health_score_cache(user_id)
