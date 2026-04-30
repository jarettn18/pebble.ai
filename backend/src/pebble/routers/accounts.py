import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from pebble.database import get_db
from pebble.middleware.auth import get_current_user
from pebble.models.account import Account
from pebble.models.user import User
from pebble.schemas.account import AccountListResponse, AccountOut, AccountUpdate
from pebble.services.accounts import get_accounts

router = APIRouter(prefix="/v1/accounts", tags=["accounts"])


@router.get("", response_model=AccountListResponse)
async def list_accounts(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_accounts(str(user.id), db)


@router.patch("/{account_id}", response_model=AccountOut)
async def update_account(
    account_id: uuid.UUID,
    payload: AccountUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Account).where(Account.id == account_id, Account.user_id == user.id)
    )
    account = result.scalars().first()
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")

    if payload.nickname is not None:
        nickname = payload.nickname.strip()
        account.nickname = nickname or None

    await db.commit()
    await db.refresh(account, attribute_names=["plaid_item"])

    return {
        "id": str(account.id),
        "name": account.name,
        "nickname": account.nickname,
        "mask": account.mask,
        "type": account.type,
        "subtype": account.subtype,
        "balance_current": str(account.balance_current) if account.balance_current is not None else None,
        "balance_available": str(account.balance_available) if account.balance_available is not None else None,
        "iso_currency_code": account.iso_currency_code,
        "institution_name": account.plaid_item.institution_name if account.plaid_item else None,
    }
