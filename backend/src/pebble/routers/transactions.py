from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from pebble.database import get_db
from pebble.middleware.auth import get_current_user
from pebble.models.user import User
from pebble.schemas.transaction import TransactionListResponse
from pebble.services.transactions import get_transactions

router = APIRouter(prefix="/v1/transactions", tags=["transactions"])


@router.get("", response_model=TransactionListResponse)
async def list_transactions(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_transactions(
        user_id=str(user.id),
        db=db,
        limit=limit,
        offset=offset,
    )
