from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from pebble.database import get_db
from pebble.middleware.auth import get_current_user
from pebble.models.user import User
from pebble.schemas.budget import (
    BudgetCreateRequest,
    BudgetListResponse,
    BudgetOut,
    BudgetUpdateRequest,
)
from pebble.services.budgets import (
    create_budget,
    delete_budget,
    get_budget,
    get_budgets,
    update_budget,
)

router = APIRouter(prefix="/v1/budgets", tags=["budgets"])


@router.get("", response_model=BudgetListResponse)
async def list_budgets(
    month: int | None = None,
    year: int | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_budgets(str(user.id), db, month=month, year=year)


@router.get("/{budget_id}", response_model=BudgetOut)
async def get_budget_detail(
    budget_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_budget(str(user.id), budget_id, db)


@router.post("", response_model=BudgetOut, status_code=status.HTTP_201_CREATED)
async def create_budget_endpoint(
    req: BudgetCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await create_budget(str(user.id), req.model_dump(), db)


@router.put("/{budget_id}", response_model=BudgetOut)
async def update_budget_endpoint(
    budget_id: str,
    req: BudgetUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await update_budget(
        str(user.id), budget_id, req.model_dump(exclude_unset=True), db
    )


@router.delete("/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_budget_endpoint(
    budget_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await delete_budget(str(user.id), budget_id, db)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
