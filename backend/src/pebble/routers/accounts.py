from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from pebble.database import get_db
from pebble.middleware.auth import get_current_user
from pebble.models.user import User
from pebble.schemas.account import AccountListResponse
from pebble.services.accounts import get_accounts

router = APIRouter(prefix="/v1/accounts", tags=["accounts"])


@router.get("", response_model=AccountListResponse)
async def list_accounts(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_accounts(str(user.id), db)
