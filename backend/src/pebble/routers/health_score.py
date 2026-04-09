from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from pebble.database import get_db
from pebble.middleware.auth import get_current_user
from pebble.models.user import User
from pebble.schemas.health_score import HealthScoreHistoryResponse, HealthScoreResponse
from pebble.services.health_score import get_health_score, get_health_score_history

router = APIRouter(prefix="/v1/health-score", tags=["health-score"])


@router.get("", response_model=HealthScoreResponse)
async def health_score(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_health_score(str(user.id), db)


@router.get("/history", response_model=HealthScoreHistoryResponse)
async def health_score_history(
    period: str = Query(default="3M"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    scores = await get_health_score_history(str(user.id), period, db)
    return {"period": period, "scores": scores}
