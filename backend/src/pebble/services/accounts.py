from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from pebble.models.account import Account


async def get_accounts(user_id: str, db: AsyncSession) -> dict:
    result = await db.execute(
        select(Account)
        .where(Account.user_id == user_id)
        .options(joinedload(Account.plaid_item))
        .order_by(Account.name)
    )
    rows = result.scalars().unique().all()
    return {
        "accounts": [
            {
                "id": str(a.id),
                "name": a.name,
                "official_name": a.official_name,
                "type": a.type,
                "subtype": a.subtype,
                "balance_current": str(a.balance_current) if a.balance_current is not None else None,
                "balance_available": str(a.balance_available) if a.balance_available is not None else None,
                "iso_currency_code": a.iso_currency_code,
                "institution_name": a.plaid_item.institution_name if a.plaid_item else None,
            }
            for a in rows
        ]
    }
