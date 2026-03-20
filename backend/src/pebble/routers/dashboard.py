from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from pebble.database import get_db
from pebble.middleware.auth import get_current_user
from pebble.models.user import User
from pebble.schemas.dashboard import DashboardResponse, NetWorthHistoryResponse
from pebble.services.dashboard import get_dashboard, get_net_worth_history

router = APIRouter(prefix="/v1/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardResponse)
async def dashboard(
    month: int = Query(default=None),
    year: int = Query(default=None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Default to current month/year
    today = date.today()
    m = month if month is not None else today.month
    y = year if year is not None else today.year
    return await get_dashboard(str(user.id), m, y, db)


@router.get("/net-worth-history", response_model=NetWorthHistoryResponse)
async def net_worth_history(
    period: str = Query(default="1M"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_net_worth_history(str(user.id), period, db)
