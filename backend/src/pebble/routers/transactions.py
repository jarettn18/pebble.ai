from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from pebble.database import get_db
from pebble.middleware.auth import get_current_user
from pebble.models.user import User
from pebble.schemas.transaction import (
    TransactionDetailOut,
    TransactionListResponse,
    TransactionUpdateRequest,
)
from pebble.services.transactions import get_transaction, get_transactions, update_transaction

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


@router.get("/{transaction_id}", response_model=TransactionDetailOut)
async def get_transaction_detail(
    transaction_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_transaction(str(user.id), transaction_id, db)


@router.patch("/{transaction_id}", response_model=TransactionDetailOut)
async def update_transaction_endpoint(
    transaction_id: str,
    req: TransactionUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await update_transaction(
        str(user.id), transaction_id, req.model_dump(exclude_unset=True), db
    )
