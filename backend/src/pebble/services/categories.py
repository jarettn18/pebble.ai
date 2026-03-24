import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from pebble.models.category import Category


async def get_plaid_category_map(db: AsyncSession) -> dict[str, uuid.UUID]:
    """Return a mapping of Plaid primary category string -> internal category UUID."""
    result = await db.execute(
        select(Category.plaid_primary, Category.id).where(
            Category.plaid_primary.isnot(None)
        )
    )
    return {row.plaid_primary: row.id for row in result.all()}


async def get_category_id_by_name(db: AsyncSession, name: str) -> uuid.UUID | None:
    """Return the UUID for a category by its name, or None."""
    result = await db.execute(
        select(Category.id).where(Category.name == name)
    )
    row = result.first()
    return row.id if row else None


async def get_all_categories(db: AsyncSession) -> dict:
    """Return all categories ordered by name."""
    result = await db.execute(select(Category).order_by(Category.name))
    rows = result.scalars().all()
    return {
        "categories": [
            {
                "id": str(c.id),
                "name": c.name,
                "icon": c.icon,
                "color": c.color,
            }
            for c in rows
        ]
    }


async def update_category_color(
    db: AsyncSession, category_id: str, color: str
) -> dict:
    """Update a category's color and return the updated category."""
    try:
        cat_uuid = uuid.UUID(category_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid category ID")

    result = await db.execute(select(Category).where(Category.id == cat_uuid))
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    category.color = color
    await db.commit()
    await db.refresh(category)

    return {
        "id": str(category.id),
        "name": category.name,
        "icon": category.icon,
        "color": category.color,
    }
