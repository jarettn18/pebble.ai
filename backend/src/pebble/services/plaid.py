import asyncio
import logging
import uuid
from datetime import date as date_type, datetime, timezone

import httpx

logger = logging.getLogger(__name__)
from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from pebble.config import settings
from pebble.models.account import Account, PlaidItem
from pebble.models.transaction import Transaction
from pebble.services.categories import get_category_id_by_name, get_plaid_category_map
from pebble.services.health_score import invalidate_health_score_cache
from pebble.services.rate_limiter import AsyncRateLimiter
from pebble.utils.security import decrypt_value, encrypt_value

PLAID_ENV_URLS = {
    "sandbox": "https://sandbox.plaid.com",
    "development": "https://development.plaid.com",
    "production": "https://production.plaid.com",
}


_plaid_limiter = AsyncRateLimiter(rate=5, period=1.0)

PLAID_MAX_RETRIES = 3
PLAID_BACKOFF_BASE = 1.0  # seconds


def _base_url() -> str:
    return PLAID_ENV_URLS[settings.plaid_env]


async def create_link_token(user_id: str) -> dict:
    data = await _plaid_post(
        "/link/token/create",
        {
            "client_name": "Pebble",
            "language": "en",
            "country_codes": ["US"],
            "products": ["transactions"],
            "user": {"client_user_id": user_id},
        },
    )
    return {"link_token": data["link_token"], "expiration": data["expiration"]}


async def _plaid_post(path: str, payload: dict) -> dict:
    url = f"{_base_url()}{path}"
    payload = {"client_id": settings.plaid_client_id, "secret": settings.plaid_secret, **payload}

    await _plaid_limiter.acquire()

    for attempt in range(1, PLAID_MAX_RETRIES + 1):
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, json=payload, timeout=90)

        if resp.status_code == 429:
            if attempt == PLAID_MAX_RETRIES:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Plaid rate limit exceeded, please try again later",
                )
            retry_after = resp.headers.get("Retry-After")
            if retry_after:
                wait = float(retry_after)
            else:
                wait = PLAID_BACKOFF_BASE * (2 ** (attempt - 1))
            logger.warning("Plaid 429 on %s, retrying in %.1fs (attempt %d/%d)", path, wait, attempt, PLAID_MAX_RETRIES)
            await asyncio.sleep(wait)
            continue

        if resp.status_code != 200:
            detail = resp.json().get("error_message", f"Plaid error on {path}")
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail)

        return resp.json()

    raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Plaid error on {path}")


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
            mask=acct.get("mask"),
            type=acct["type"],
            subtype=acct.get("subtype"),
            balance_current=balances.get("current"),
            balance_available=balances.get("available"),
            iso_currency_code=balances.get("iso_currency_code"),
        )
        db.add(account)
        accounts_linked += 1

    await db.commit()
    await invalidate_health_score_cache(str(user_id))

    return {"item_id": str(plaid_item.id), "accounts_linked": accounts_linked}


# Plaid INCOME detailed subcategories → internal category name
_INCOME_DETAILED_MAP: dict[str, str] = {
    "INCOME_INTEREST_EARNED": "Interest",
    "INCOME_DIVIDENDS": "Dividends",
}

# Fallback: keywords in transaction name → category name (for when Plaid
# doesn't provide a detailed subcategory, e.g. sandbox)
_INCOME_NAME_KEYWORDS: list[tuple[list[str], str]] = [
    (["interest", "intrst", "int pymnt"], "Interest"),
    (["dividend", "div pymnt"], "Dividends"),
]


def _resolve_category_id(
    txn: dict,
    category_map: dict[str, uuid.UUID],
    detailed_overrides: dict[str, uuid.UUID],
) -> uuid.UUID | None:
    pfc = txn.get("personal_finance_category")
    if not pfc:
        return None
    primary = pfc.get("primary")
    detailed = pfc.get("detailed")

    # For INCOME, check detailed subcategory first, then fall back to name matching
    if primary == "INCOME":
        if detailed and detailed in detailed_overrides:
            return detailed_overrides[detailed]

        # Fallback: match transaction name keywords
        name_lower = (txn.get("name") or "").lower()
        for keywords, cat_name in _INCOME_NAME_KEYWORDS:
            if any(kw in name_lower for kw in keywords):
                cat_id = detailed_overrides.get(f"_name_{cat_name}")
                if cat_id:
                    return cat_id

    return category_map.get(primary)


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

    category_map = await get_plaid_category_map(db)

    # Build detailed overrides for INCOME subcategories (Interest, Dividends, etc.)
    detailed_overrides: dict[str, uuid.UUID] = {}
    income_cat_names = set(_INCOME_DETAILED_MAP.values()) | {cat for _, cat in _INCOME_NAME_KEYWORDS}
    for cat_name in income_cat_names:
        cat_id = await get_category_id_by_name(db, cat_name)
        if cat_id:
            # Add under detailed key
            for detailed_name, mapped_name in _INCOME_DETAILED_MAP.items():
                if mapped_name == cat_name:
                    detailed_overrides[detailed_name] = cat_id
            # Add under name-fallback key
            detailed_overrides[f"_name_{cat_name}"] = cat_id

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
                category_id=_resolve_category_id(txn, category_map, detailed_overrides),
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
                existing_txn.category_id = _resolve_category_id(txn, category_map, detailed_overrides)
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
    if total_added or total_modified or total_removed:
        await invalidate_health_score_cache(str(user_id))

    return {"added": total_added, "modified": total_modified, "removed": total_removed}


BALANCE_STALE_SECONDS = 15 * 60  # 15 minutes


async def refresh_balances(item: "PlaidItem", db: AsyncSession) -> None:
    """Refresh account balances from Plaid for a given item."""
    access_token = decrypt_value(item.access_token_encrypted)
    data = await _plaid_post("/accounts/get", {"access_token": access_token})

    for acct_data in data.get("accounts", []):
        result = await db.execute(
            select(Account).where(Account.plaid_account_id == acct_data["account_id"])
        )
        account = result.scalars().first()
        if account:
            balances = acct_data.get("balances", {})
            account.balance_current = balances.get("current")
            account.balance_available = balances.get("available")
            if account.mask is None and acct_data.get("mask"):
                account.mask = acct_data["mask"]


async def refresh_balances_if_stale(user_id: str, db: AsyncSession) -> bool:
    """Refresh balances only if the most recent account update is older than the TTL.

    Returns True if balances were refreshed, False if still fresh.
    """
    result = await db.execute(
        select(Account.updated_at)
        .where(Account.user_id == user_id)
        .order_by(Account.updated_at.desc())
        .limit(1)
    )
    latest = result.scalar()

    if latest is not None:
        age = (datetime.now(timezone.utc) - latest.replace(tzinfo=timezone.utc)).total_seconds()
        if age < BALANCE_STALE_SECONDS:
            return False

    # Stale or no accounts — refresh all items
    items_result = await db.execute(
        select(PlaidItem).where(PlaidItem.user_id == uuid.UUID(user_id) if isinstance(user_id, str) else user_id)
    )
    items = items_result.scalars().all()

    for item in items:
        await refresh_balances(item, db)

    await db.commit()
    await invalidate_health_score_cache(str(user_id))
    return True


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
