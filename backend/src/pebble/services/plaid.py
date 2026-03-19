import uuid
from datetime import date as date_type

import httpx
from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from pebble.config import settings
from pebble.models.account import Account, PlaidItem
from pebble.models.transaction import Transaction
from pebble.utils.security import decrypt_value, encrypt_value

PLAID_ENV_URLS = {
    "sandbox": "https://sandbox.plaid.com",
    "development": "https://development.plaid.com",
    "production": "https://production.plaid.com",
}


def _base_url() -> str:
    return PLAID_ENV_URLS[settings.plaid_env]


async def create_link_token(user_id: str) -> dict:
    url = f"{_base_url()}/link/token/create"
    payload = {
        "client_id": settings.plaid_client_id,
        "secret": settings.plaid_secret,
        "client_name": "Pebble",
        "language": "en",
        "country_codes": ["US"],
        "products": ["transactions"],
        "user": {
            "client_user_id": user_id,
        },
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(url, json=payload, timeout=30)

    if resp.status_code != 200:
        detail = resp.json().get("error_message", "Failed to create link token")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=detail,
        )

    data = resp.json()
    return {"link_token": data["link_token"], "expiration": data["expiration"]}


async def _plaid_post(path: str, payload: dict) -> dict:
    url = f"{_base_url()}{path}"
    payload = {"client_id": settings.plaid_client_id, "secret": settings.plaid_secret, **payload}

    async with httpx.AsyncClient() as client:
        resp = await client.post(url, json=payload, timeout=30)

    if resp.status_code != 200:
        detail = resp.json().get("error_message", f"Plaid error on {path}")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail)

    return resp.json()


async def exchange_public_token(
    public_token: str,
    user_id: str,
    db: AsyncSession,
    institution_id: str | None = None,
    institution_name: str | None = None,
) -> dict:
    # Exchange the public token for an access token
    data = await _plaid_post(
        "/item/public_token/exchange",
        {"public_token": public_token},
    )

    access_token = data["access_token"]
    item_id = data["item_id"]

    # Check for duplicate item
    existing = await db.execute(
        select(PlaidItem).where(PlaidItem.plaid_item_id == item_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This institution is already linked",
        )

    # Store the item with encrypted access token
    plaid_item = PlaidItem(
        user_id=user_id,
        plaid_item_id=item_id,
        access_token_encrypted=encrypt_value(access_token),
        institution_id=institution_id,
        institution_name=institution_name,
    )
    db.add(plaid_item)
    await db.flush()

    # Fetch accounts from Plaid
    accounts_data = await _plaid_post(
        "/accounts/get",
        {"access_token": access_token},
    )

    accounts_linked = 0
    for acct in accounts_data.get("accounts", []):
        balances = acct.get("balances", {})
        account = Account(
            user_id=user_id,
            plaid_item_id=plaid_item.id,
            plaid_account_id=acct["account_id"],
            name=acct["name"],
            official_name=acct.get("official_name"),
            type=acct["type"],
            subtype=acct.get("subtype"),
            balance_current=balances.get("current"),
            balance_available=balances.get("available"),
            iso_currency_code=balances.get("iso_currency_code"),
        )
        db.add(account)
        accounts_linked += 1

    await db.commit()

    return {"item_id": str(plaid_item.id), "accounts_linked": accounts_linked}


async def sync_transactions(
    item_id: str,
    user_id: str,
    db: AsyncSession,
) -> dict:
    # Load the PlaidItem and verify ownership
    result = await db.execute(
        select(PlaidItem).where(
            PlaidItem.id == uuid.UUID(item_id),
            PlaidItem.user_id == uuid.UUID(user_id),
        )
    )
    plaid_item = result.scalar_one_or_none()
    if not plaid_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Linked account not found",
        )

    access_token = decrypt_value(plaid_item.access_token_encrypted)

    # Build a map of plaid_account_id -> Account.id for this item
    acct_result = await db.execute(
        select(Account).where(Account.plaid_item_id == plaid_item.id)
    )
    account_map: dict[str, uuid.UUID] = {
        a.plaid_account_id: a.id for a in acct_result.scalars().all()
    }

    cursor = plaid_item.cursor
    total_added = 0
    total_modified = 0
    total_removed = 0

    has_more = True
    while has_more:
        payload: dict = {"access_token": access_token, "count": 500}
        if cursor:
            payload["cursor"] = cursor

        data = await _plaid_post("/transactions/sync", payload)

        # Process added transactions
        for txn in data.get("added", []):
            acct_id = account_map.get(txn["account_id"])
            if not acct_id:
                continue
            db.add(Transaction(
                user_id=user_id,
                account_id=acct_id,
                plaid_transaction_id=txn["transaction_id"],
                amount=txn["amount"],
                date=date_type.fromisoformat(txn["date"]),
                name=txn["name"],
                merchant_name=txn.get("merchant_name"),
                pending=txn.get("pending", False),
            ))
            total_added += 1

        # Process modified transactions
        for txn in data.get("modified", []):
            existing = await db.execute(
                select(Transaction).where(
                    Transaction.plaid_transaction_id == txn["transaction_id"]
                )
            )
            existing_txn = existing.scalar_one_or_none()
            if existing_txn:
                existing_txn.amount = txn["amount"]
                existing_txn.date = date_type.fromisoformat(txn["date"])
                existing_txn.name = txn["name"]
                existing_txn.merchant_name = txn.get("merchant_name")
                existing_txn.pending = txn.get("pending", False)
                total_modified += 1

        # Process removed transactions
        removed_ids = [r["transaction_id"] for r in data.get("removed", [])]
        if removed_ids:
            await db.execute(
                delete(Transaction).where(
                    Transaction.plaid_transaction_id.in_(removed_ids)
                )
            )
            total_removed += len(removed_ids)

        has_more = data.get("has_more", False)
        cursor = data.get("next_cursor", cursor)

    # Persist the new cursor
    plaid_item.cursor = cursor
    await db.commit()

    return {"added": total_added, "modified": total_modified, "removed": total_removed}


async def sync_all_items(user_id: str, db: AsyncSession) -> dict:
    """Sync transactions for all of a user's linked PlaidItems."""
    result = await db.execute(
        select(PlaidItem).where(PlaidItem.user_id == uuid.UUID(user_id))
    )
    items = result.scalars().all()

    total = {"added": 0, "modified": 0, "removed": 0}
    for item in items:
        counts = await sync_transactions(str(item.id), user_id, db)
        total["added"] += counts["added"]
        total["modified"] += counts["modified"]
        total["removed"] += counts["removed"]

    return total
