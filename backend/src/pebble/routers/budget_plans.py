from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from pebble.database import get_db
from pebble.middleware.auth import get_current_user
from pebble.models.user import User
from pebble.schemas.budget_plan import (
    BudgetPlanCreateRequest,
    BudgetPlanListResponse,
    BudgetPlanOut,
    BudgetPlanUpdateRequest,
)
from pebble.services.budget_plans import (
    create_budget_plan,
    delete_budget_plan,
    generate_recurring_budgets,
    get_budget_plan,
    get_budget_plans,
    update_budget_plan,
)

router = APIRouter(prefix="/v1/budget-plans", tags=["budget-plans"])


@router.get("", response_model=BudgetPlanListResponse)
async def list_budget_plans(
    month: int | None = Query(None),
    year: int | None = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_budget_plans(str(user.id), db, month=month, year=year)


@router.get("/{plan_id}", response_model=BudgetPlanOut)
async def get_budget_plan_detail(
    plan_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_budget_plan(str(user.id), plan_id, db)


@router.post("", response_model=BudgetPlanOut, status_code=status.HTTP_201_CREATED)
async def create_budget_plan_endpoint(
    req: BudgetPlanCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await create_budget_plan(str(user.id), req.model_dump(), db)


@router.put("/{plan_id}", response_model=BudgetPlanOut)
async def update_budget_plan_endpoint(
    plan_id: str,
    req: BudgetPlanUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await update_budget_plan(
        str(user.id), plan_id, req.model_dump(exclude_unset=True), db
    )


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_budget_plan_endpoint(
    plan_id: str,
    delete_budgets: bool = Query(False),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await delete_budget_plan(str(user.id), plan_id, db, delete_budgets=delete_budgets)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/generate-recurring", status_code=status.HTTP_200_OK)
async def generate_recurring_endpoint(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await generate_recurring_budgets(str(user.id), db)
    return {"status": "ok"}
