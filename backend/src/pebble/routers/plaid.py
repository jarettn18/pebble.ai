from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from pebble.database import get_db
from pebble.middleware.auth import get_current_user
from pebble.models.user import User
from pebble.schemas.plaid import (
    ExchangeTokenRequest,
    ExchangeTokenResponse,
    LinkTokenResponse,
    SyncRequest,
    SyncResponse,
)
from pebble.services.plaid import create_link_token, exchange_public_token, refresh_balances_if_stale, sync_all_items, sync_transactions

router = APIRouter(prefix="/v1/plaid", tags=["plaid"])


@router.post("/link-token", response_model=LinkTokenResponse)
async def link_token(user: User = Depends(get_current_user)):
    return await create_link_token(str(user.id))


@router.post("/exchange", response_model=ExchangeTokenResponse)
async def exchange(
    req: ExchangeTokenRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await exchange_public_token(
        public_token=req.public_token,
        user_id=str(user.id),
        db=db,
        institution_id=req.institution_id,
        institution_name=req.institution_name,
    )


@router.post("/sync", response_model=SyncResponse)
async def sync(
    req: SyncRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await sync_transactions(
        item_id=req.item_id,
        user_id=str(user.id),
        db=db,
    )


@router.post("/sync-all", response_model=SyncResponse)
async def sync_all(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await sync_all_items(
        user_id=str(user.id),
        db=db,
    )


@router.post("/refresh-balances")
async def refresh_balances(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    refreshed = await refresh_balances_if_stale(str(user.id), db)
    return {"refreshed": refreshed}
