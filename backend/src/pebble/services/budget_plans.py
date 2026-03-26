import uuid
from datetime import datetime
from decimal import Decimal, InvalidOperation

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from pebble.models.budget import Budget
from pebble.models.budget_plan import BudgetPlan, BudgetPlanAllocation
from pebble.models.category import Category


async def _validate_category(category_id: str, db: AsyncSession) -> uuid.UUID:
    try:
        cat_uuid = uuid.UUID(category_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid category_id"
        )
    result = await db.execute(select(Category).where(Category.id == cat_uuid))
    if not result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Category not found"
        )
    return cat_uuid


def _plan_to_dict(plan: BudgetPlan) -> dict:
    return {
        "id": str(plan.id),
        "name": plan.name,
        "total_amount": str(plan.total_amount),
        "is_recurring": plan.is_recurring,
        "recurring_start_month": plan.recurring_start_month,
        "recurring_start_year": plan.recurring_start_year,
        "recurring_active": plan.recurring_active,
        "allocations": [
            {
                "id": str(a.id),
                "category_id": str(a.category_id),
                "category_name": a.category.name if a.category else None,
                "category_color": a.category.color if a.category else None,
                "amount": str(a.amount),
            }
            for a in plan.allocations
        ],
        "created_at": plan.created_at.isoformat() if plan.created_at else "",
    }


def _generate_budget_rows(
    plan: BudgetPlan,
    allocations: list[BudgetPlanAllocation],
    months: list[dict],
) -> list[Budget]:
    """Generate individual budget rows for each month x allocation."""
    budgets = []
    for m in months:
        month_val = m["month"]
        year_val = m["year"]
        for alloc in allocations:
            budgets.append(
                Budget(
                    user_id=plan.user_id,
                    category_id=alloc.category_id,
                    amount=alloc.amount,
                    month=month_val,
                    year=year_val,
                    budget_plan_id=plan.id,
                )
            )
    return budgets


async def create_budget_plan(
    user_id: str,
    data: dict,
    db: AsyncSession,
) -> dict:
    try:
        total = Decimal(data["total_amount"])
    except (InvalidOperation, ValueError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid total_amount"
        )

    is_recurring = data.get("is_recurring", False)
    months = data.get("months", [])

    now = datetime.now()
    current_month = now.month
    current_year = now.year

    plan = BudgetPlan(
        user_id=user_id,
        name=data.get("name"),
        total_amount=total,
        is_recurring=is_recurring,
        recurring_start_month=current_month if is_recurring else None,
        recurring_start_year=current_year if is_recurring else None,
        recurring_active=is_recurring,
    )
    db.add(plan)
    await db.flush()  # get plan.id before creating allocations

    # Create allocations
    alloc_objects = []
    for alloc_data in data.get("allocations", []):
        cat_uuid = await _validate_category(alloc_data["category_id"], db)
        try:
            amount = Decimal(alloc_data["amount"])
        except (InvalidOperation, ValueError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid allocation amount",
            )
        alloc = BudgetPlanAllocation(
            budget_plan_id=plan.id,
            category_id=cat_uuid,
            amount=amount,
        )
        db.add(alloc)
        alloc_objects.append(alloc)

    # Generate budget rows for selected months
    budget_months = [{"month": m["month"], "year": m["year"]} for m in months]

    # For recurring, also include current month if not already in list
    if is_recurring:
        current_entry = {"month": current_month, "year": current_year}
        if current_entry not in budget_months:
            budget_months.append(current_entry)

    budget_rows = _generate_budget_rows(plan, alloc_objects, budget_months)
    for b in budget_rows:
        db.add(b)

    await db.commit()

    # Reload with relationships
    result = await db.execute(
        select(BudgetPlan)
        .where(BudgetPlan.id == plan.id)
        .options(
            joinedload(BudgetPlan.allocations).joinedload(
                BudgetPlanAllocation.category
            )
        )
    )
    plan = result.scalars().unique().one()
    return _plan_to_dict(plan)


async def get_budget_plans(user_id: str, db: AsyncSession) -> dict:
    result = await db.execute(
        select(BudgetPlan)
        .where(BudgetPlan.user_id == user_id)
        .options(
            joinedload(BudgetPlan.allocations).joinedload(
                BudgetPlanAllocation.category
            )
        )
        .order_by(BudgetPlan.created_at.desc())
    )
    plans = result.scalars().unique().all()
    return {"budget_plans": [_plan_to_dict(p) for p in plans]}


async def get_budget_plan(user_id: str, plan_id: str, db: AsyncSession) -> dict:
    try:
        pid = uuid.UUID(plan_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Budget plan not found"
        )

    result = await db.execute(
        select(BudgetPlan)
        .where(BudgetPlan.id == pid, BudgetPlan.user_id == user_id)
        .options(
            joinedload(BudgetPlan.allocations).joinedload(
                BudgetPlanAllocation.category
            )
        )
    )
    plan = result.scalars().unique().one_or_none()
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Budget plan not found"
        )
    return _plan_to_dict(plan)


async def update_budget_plan(
    user_id: str,
    plan_id: str,
    updates: dict,
    db: AsyncSession,
) -> dict:
    try:
        pid = uuid.UUID(plan_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Budget plan not found"
        )

    result = await db.execute(
        select(BudgetPlan)
        .where(BudgetPlan.id == pid, BudgetPlan.user_id == user_id)
        .options(
            joinedload(BudgetPlan.allocations).joinedload(
                BudgetPlanAllocation.category
            )
        )
    )
    plan = result.scalars().unique().one_or_none()
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Budget plan not found"
        )

    if "name" in updates:
        plan.name = updates["name"]

    if "total_amount" in updates and updates["total_amount"] is not None:
        try:
            plan.total_amount = Decimal(updates["total_amount"])
        except (InvalidOperation, ValueError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid total_amount"
            )

    if "recurring_active" in updates and updates["recurring_active"] is not None:
        plan.recurring_active = updates["recurring_active"]

    if "allocations" in updates and updates["allocations"] is not None:
        # Remove old allocations
        for old_alloc in plan.allocations:
            await db.delete(old_alloc)

        # Create new ones
        new_allocs = []
        for alloc_data in updates["allocations"]:
            cat_uuid = await _validate_category(alloc_data["category_id"], db)
            try:
                amount = Decimal(alloc_data["amount"])
            except (InvalidOperation, ValueError):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid allocation amount",
                )
            alloc = BudgetPlanAllocation(
                budget_plan_id=plan.id,
                category_id=cat_uuid,
                amount=amount,
            )
            db.add(alloc)
            new_allocs.append(alloc)

    await db.commit()

    # Reload
    result = await db.execute(
        select(BudgetPlan)
        .where(BudgetPlan.id == pid)
        .options(
            joinedload(BudgetPlan.allocations).joinedload(
                BudgetPlanAllocation.category
            )
        )
    )
    plan = result.scalars().unique().one()
    return _plan_to_dict(plan)


async def delete_budget_plan(
    user_id: str,
    plan_id: str,
    db: AsyncSession,
    delete_budgets: bool = False,
) -> None:
    try:
        pid = uuid.UUID(plan_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Budget plan not found"
        )

    result = await db.execute(
        select(BudgetPlan).where(BudgetPlan.id == pid, BudgetPlan.user_id == user_id)
    )
    plan = result.scalars().one_or_none()
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Budget plan not found"
        )

    if delete_budgets:
        # Delete all generated budgets for this plan
        budgets_result = await db.execute(
            select(Budget).where(Budget.budget_plan_id == pid)
        )
        for b in budgets_result.scalars().all():
            await db.delete(b)
    else:
        # Unlink budgets from plan (keep them as standalone)
        budgets_result = await db.execute(
            select(Budget).where(Budget.budget_plan_id == pid)
        )
        for b in budgets_result.scalars().all():
            b.budget_plan_id = None

    await db.delete(plan)
    await db.commit()


async def generate_recurring_budgets(user_id: str, db: AsyncSession) -> None:
    """Generate next month's budgets from active recurring plans.

    Call this on dashboard load or via a scheduled task.
    """
    now = datetime.now()
    current_month = now.month
    current_year = now.year

    result = await db.execute(
        select(BudgetPlan)
        .where(
            BudgetPlan.user_id == user_id,
            BudgetPlan.is_recurring.is_(True),
            BudgetPlan.recurring_active.is_(True),
        )
        .options(joinedload(BudgetPlan.allocations))
    )
    plans = result.scalars().unique().all()

    for plan in plans:
        # Check if budgets already exist for current month
        existing = await db.execute(
            select(Budget).where(
                Budget.budget_plan_id == plan.id,
                Budget.month == current_month,
                Budget.year == current_year,
            )
        )
        if existing.scalars().first():
            continue

        # Generate budgets for current month
        budget_rows = _generate_budget_rows(
            plan,
            plan.allocations,
            [{"month": current_month, "year": current_year}],
        )
        for b in budget_rows:
            db.add(b)

    await db.commit()
