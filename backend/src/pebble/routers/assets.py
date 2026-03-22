from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from pebble.database import get_db
from pebble.middleware.auth import get_current_user
from pebble.models.user import User
from pebble.schemas.asset import (
    AssetCreateRequest,
    AssetListResponse,
    AssetOut,
    AssetUpdateRequest,
)
from pebble.services.assets import (
    create_asset,
    delete_asset,
    get_asset,
    get_assets,
    update_asset,
)

router = APIRouter(prefix="/v1/assets", tags=["assets"])


@router.get("", response_model=AssetListResponse)
async def list_assets(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_assets(str(user.id), db)


@router.get("/{asset_id}", response_model=AssetOut)
async def get_asset_detail(
    asset_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_asset(str(user.id), asset_id, db)


@router.post("", response_model=AssetOut, status_code=status.HTTP_201_CREATED)
async def create_asset_endpoint(
    req: AssetCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await create_asset(str(user.id), req.model_dump(), db)


@router.put("/{asset_id}", response_model=AssetOut)
async def update_asset_endpoint(
    asset_id: str,
    req: AssetUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await update_asset(
        str(user.id), asset_id, req.model_dump(exclude_unset=True), db
    )


@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_asset_endpoint(
    asset_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await delete_asset(str(user.id), asset_id, db)
