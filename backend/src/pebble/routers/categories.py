from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from pebble.database import get_db
from pebble.middleware.auth import get_current_user
from pebble.models.user import User
from pebble.schemas.category import CategoryListResponse
from pebble.services.categories import get_all_categories

router = APIRouter(prefix="/v1/categories", tags=["categories"])


@router.get("", response_model=CategoryListResponse)
async def list_categories(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_all_categories(db)
