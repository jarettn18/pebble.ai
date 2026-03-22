import uuid
from decimal import Decimal, InvalidOperation

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from pebble.models.asset import Asset, AssetType


def _asset_to_dict(a: Asset) -> dict:
    return {
        "id": str(a.id),
        "name": a.name,
        "asset_type": a.asset_type.value,
        "estimated_value": str(a.estimated_value),
        "address": a.address,
        "notes": a.notes,
    }


async def get_assets(user_id: str, db: AsyncSession) -> dict:
    result = await db.execute(
        select(Asset)
        .where(Asset.user_id == user_id)
        .order_by(Asset.created_at.desc())
    )
    assets = result.scalars().all()
    return {"assets": [_asset_to_dict(a) for a in assets]}


async def get_asset(user_id: str, asset_id: str, db: AsyncSession) -> dict:
    try:
        asset_uuid = uuid.UUID(asset_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found"
        )

    result = await db.execute(
        select(Asset).where(Asset.id == asset_uuid, Asset.user_id == user_id)
    )
    asset = result.scalars().first()
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found"
        )

    return _asset_to_dict(asset)


async def create_asset(user_id: str, data: dict, db: AsyncSession) -> dict:
    # Validate asset_type
    try:
        asset_type = AssetType(data["asset_type"])
    except ValueError:
        valid = ", ".join(t.value for t in AssetType)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid asset_type. Must be one of: {valid}",
        )

    # Validate estimated_value
    try:
        estimated_value = Decimal(data["estimated_value"])
    except (InvalidOperation, ValueError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid estimated_value",
        )

    asset = Asset(
        user_id=user_id,
        name=data["name"],
        asset_type=asset_type,
        estimated_value=estimated_value,
        address=data.get("address"),
        notes=data.get("notes"),
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)

    return _asset_to_dict(asset)


async def update_asset(
    user_id: str, asset_id: str, updates: dict, db: AsyncSession
) -> dict:
    try:
        asset_uuid = uuid.UUID(asset_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found"
        )

    result = await db.execute(
        select(Asset).where(Asset.id == asset_uuid, Asset.user_id == user_id)
    )
    asset = result.scalars().first()
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found"
        )

    if "name" in updates and updates["name"] is not None:
        asset.name = updates["name"]
    if "asset_type" in updates and updates["asset_type"] is not None:
        try:
            asset.asset_type = AssetType(updates["asset_type"])
        except ValueError:
            valid = ", ".join(t.value for t in AssetType)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid asset_type. Must be one of: {valid}",
            )
    if "estimated_value" in updates and updates["estimated_value"] is not None:
        try:
            asset.estimated_value = Decimal(updates["estimated_value"])
        except (InvalidOperation, ValueError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid estimated_value",
            )
    if "address" in updates:
        asset.address = updates["address"]
    if "notes" in updates:
        asset.notes = updates["notes"]

    await db.commit()
    await db.refresh(asset)

    return _asset_to_dict(asset)


async def delete_asset(user_id: str, asset_id: str, db: AsyncSession) -> None:
    try:
        asset_uuid = uuid.UUID(asset_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found"
        )

    result = await db.execute(
        select(Asset).where(Asset.id == asset_uuid, Asset.user_id == user_id)
    )
    asset = result.scalars().first()
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found"
        )

    await db.delete(asset)
    await db.commit()
