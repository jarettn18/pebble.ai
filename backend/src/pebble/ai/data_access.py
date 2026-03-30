"""Tool handler functions for the AI assistant.

Each function takes user_id, db, and typed kwargs.
Returns plain dicts with string amounts — optimised for Claude token efficiency.
"""

import calendar
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from pebble.models.account import Account
from pebble.models.asset import Asset
from pebble.models.budget import Budget
from pebble.models.category import Category
from pebble.models.transaction import Transaction

DEBT_TYPES = {"credit", "loan"}


def _pct(part: Decimal, total: Decimal) -> str:
    if total == 0:
        return "0"
    return str(round(float(part) / float(total) * 100, 1))


def _date_range(date_from: str, date_to: str) -> tuple[date, date]:
    return date.fromisoformat(date_from), date.fromisoformat(date_to)


# ──────────────────────────────────────────────────────────────
# 1. get_spending_by_category
# ──────────────────────────────────────────────────────────────

async def get_spending_by_category(
    user_id: str, db: AsyncSession, *, date_from: str, date_to: str,
) -> dict:
    d_from, d_to = _date_range(date_from, date_to)

    result = await db.execute(
        select(
            Category.name,
            func.coalesce(func.sum(Transaction.amount), 0),
        )
        .join(Category, Transaction.category_id == Category.id)
        .where(
            Transaction.user_id == user_id,
            Transaction.date >= d_from,
            Transaction.date <= d_to,
            Transaction.pending.is_(False),
            Transaction.amount > 0,
        )
        .group_by(Category.name)
        .order_by(func.sum(Transaction.amount).desc())
    )
    rows = result.all()
    total = sum(r[1] for r in rows)

    return {
        "date_range": f"{date_from} to {date_to}",
        "total": str(total),
        "categories": [
            {"name": r[0], "amount": str(r[1]), "pct": _pct(r[1], total)}
            for r in rows
        ],
    }


# ──────────────────────────────────────────────────────────────
# 2. get_spending_over_time
# ──────────────────────────────────────────────────────────────

async def get_spending_over_time(
    user_id: str, db: AsyncSession, *, months: int = 6,
) -> dict:
    months = min(max(months, 1), 12)
    today = date.today()
    m, y = today.month, today.year

    periods: list[tuple[int, int]] = []
    for _ in range(months):
        periods.append((m, y))
        m -= 1
        if m < 1:
            m = 12
            y -= 1
    periods.reverse()

    start_m, start_y = periods[0]
    start_date = date(start_y, start_m, 1)

    result = await db.execute(
        select(
            extract("year", Transaction.date).label("yr"),
            extract("month", Transaction.date).label("mo"),
            func.coalesce(func.sum(Transaction.amount), 0),
        )
        .where(
            Transaction.user_id == user_id,
            Transaction.date >= start_date,
            Transaction.date <= today,
            Transaction.pending.is_(False),
            Transaction.amount > 0,
        )
        .group_by("yr", "mo")
    )
    time_map = {(int(r[0]), int(r[1])): r[2] for r in result.all()}

    return {
        "months": [
            {
                "label": f"{calendar.month_abbr[mo]} {yr}",
                "amount": str(time_map.get((yr, mo), Decimal("0"))),
            }
            for mo, yr in periods
        ],
    }


# ──────────────────────────────────────────────────────────────
# 3. get_top_merchants
# ──────────────────────────────────────────────────────────────

async def get_top_merchants(
    user_id: str, db: AsyncSession, *, date_from: str, date_to: str, limit: int = 10,
) -> dict:
    d_from, d_to = _date_range(date_from, date_to)
    limit = min(max(limit, 1), 25)

    result = await db.execute(
        select(
            func.coalesce(Transaction.merchant_name, Transaction.name),
            func.sum(Transaction.amount),
            func.count(),
        )
        .where(
            Transaction.user_id == user_id,
            Transaction.date >= d_from,
            Transaction.date <= d_to,
            Transaction.pending.is_(False),
            Transaction.amount > 0,
        )
        .group_by(func.coalesce(Transaction.merchant_name, Transaction.name))
        .order_by(func.sum(Transaction.amount).desc())
        .limit(limit)
    )
    return {
        "date_range": f"{date_from} to {date_to}",
        "merchants": [
            {"name": r[0], "total": str(r[1]), "count": r[2]}
            for r in result.all()
        ],
    }


# ──────────────────────────────────────────────────────────────
# 4. get_account_balances
# ──────────────────────────────────────────────────────────────

async def get_account_balances(user_id: str, db: AsyncSession) -> dict:
    result = await db.execute(
        select(Account)
        .where(Account.user_id == user_id)
        .options(joinedload(Account.plaid_item))
        .order_by(Account.name)
    )
    accounts = result.scalars().unique().all()

    net_worth = Decimal("0")
    account_list = []
    for a in accounts:
        bal = a.balance_current or Decimal("0")
        if a.type in DEBT_TYPES:
            net_worth -= bal
        else:
            net_worth += bal
        account_list.append({
            "name": a.name,
            "type": a.type,
            "subtype": a.subtype,
            "balance": str(bal),
            "institution": a.plaid_item.institution_name if a.plaid_item else None,
        })

    # Include assets in net worth
    asset_result = await db.execute(
        select(Asset.name, Asset.asset_type, Asset.estimated_value)
        .where(Asset.user_id == user_id)
    )
    assets = []
    for r in asset_result.all():
        val = r[2] or Decimal("0")
        net_worth += val
        assets.append({"name": r[0], "type": r[1].value, "value": str(val)})

    return {
        "accounts": account_list,
        "assets": assets,
        "net_worth": str(net_worth),
    }


# ──────────────────────────────────────────────────────────────
# 5. get_budget_status
# ──────────────────────────────────────────────────────────────

async def get_budget_status(
    user_id: str, db: AsyncSession, *, month: int | None = None, year: int | None = None,
) -> dict:
    today = date.today()
    month = month or today.month
    year = year or today.year

    # Get budgets with categories
    result = await db.execute(
        select(Budget)
        .where(Budget.user_id == user_id, Budget.month == month, Budget.year == year)
        .options(joinedload(Budget.category))
    )
    budgets = result.scalars().unique().all()

    if not budgets:
        return {
            "month": f"{calendar.month_name[month]} {year}",
            "budgets": [],
            "total_budgeted": "0",
            "total_spent": "0",
        }

    # Spending per category for this month
    first_day = date(year, month, 1)
    last_day = date(year, month + 1, 1) if month < 12 else date(year + 1, 1, 1)

    spend_result = await db.execute(
        select(Transaction.category_id, func.coalesce(func.sum(Transaction.amount), 0))
        .where(
            Transaction.user_id == user_id,
            Transaction.date >= first_day,
            Transaction.date < last_day,
            Transaction.pending.is_(False),
            Transaction.amount > 0,
            Transaction.category_id.isnot(None),
        )
        .group_by(Transaction.category_id)
    )
    spending_map = {r[0]: r[1] for r in spend_result.all()}

    total_budgeted = Decimal("0")
    total_spent = Decimal("0")
    budget_rows = []
    for b in budgets:
        spent = spending_map.get(b.category_id, Decimal("0"))
        total_budgeted += b.amount
        total_spent += spent
        remaining = b.amount - spent
        budget_rows.append({
            "category": b.category.name if b.category else "Unknown",
            "budgeted": str(b.amount),
            "spent": str(spent),
            "remaining": str(remaining),
            "pct_used": _pct(spent, b.amount),
        })

    return {
        "month": f"{calendar.month_name[month]} {year}",
        "budgets": budget_rows,
        "total_budgeted": str(total_budgeted),
        "total_spent": str(total_spent),
    }


# ──────────────────────────────────────────────────────────────
# 6. get_recent_transactions
# ──────────────────────────────────────────────────────────────

async def get_recent_transactions(
    user_id: str,
    db: AsyncSession,
    *,
    limit: int = 10,
    search: str | None = None,
    category: str | None = None,
    type: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> dict:
    limit = min(max(limit, 1), 25)
    filters = [
        Transaction.user_id == user_id,
        Transaction.pending.is_(False),
    ]

    if search:
        pattern = f"%{search}%"
        filters.append(
            Transaction.name.ilike(pattern) | Transaction.merchant_name.ilike(pattern)
        )

    if category:
        filters.append(Category.name.ilike(f"%{category}%"))

    if type == "expense":
        filters.append(Transaction.amount > 0)
    elif type == "income":
        filters.append(Transaction.amount < 0)

    if date_from:
        filters.append(Transaction.date >= date.fromisoformat(date_from))
    if date_to:
        filters.append(Transaction.date <= date.fromisoformat(date_to))

    query = (
        select(Transaction)
        .join(Category, Transaction.category_id == Category.id, isouter=True)
        .where(*filters)
        .options(joinedload(Transaction.category), joinedload(Transaction.account))
        .order_by(Transaction.date.desc(), Transaction.created_at.desc())
        .limit(limit)
    )
    result = await db.execute(query)
    rows = result.scalars().unique().all()

    return {
        "transactions": [
            {
                "date": t.date.isoformat(),
                "name": t.name,
                "merchant": t.merchant_name,
                "amount": str(t.amount),
                "category": t.category.name if t.category else None,
                "account": t.account.name if t.account else None,
            }
            for t in rows
        ],
        "count": len(rows),
    }


# ──────────────────────────────────────────────────────────────
# 7. get_income_summary
# ──────────────────────────────────────────────────────────────

async def get_income_summary(
    user_id: str, db: AsyncSession, *, date_from: str, date_to: str,
) -> dict:
    d_from, d_to = _date_range(date_from, date_to)

    result = await db.execute(
        select(
            Category.name,
            func.coalesce(func.sum(func.abs(Transaction.amount)), 0),
        )
        .join(Category, Transaction.category_id == Category.id)
        .where(
            Transaction.user_id == user_id,
            Transaction.date >= d_from,
            Transaction.date <= d_to,
            Transaction.pending.is_(False),
            Transaction.amount < 0,
        )
        .group_by(Category.name)
        .order_by(func.sum(func.abs(Transaction.amount)).desc())
    )
    rows = result.all()
    total = sum(r[1] for r in rows)

    return {
        "date_range": f"{date_from} to {date_to}",
        "total": str(total),
        "sources": [
            {"category": r[0], "amount": str(r[1]), "pct": _pct(r[1], total)}
            for r in rows
        ],
    }


# ──────────────────────────────────────────────────────────────
# 8. compare_spending
# ──────────────────────────────────────────────────────────────

async def _period_spending(
    user_id: str, db: AsyncSession, d_from: date, d_to: date,
) -> tuple[Decimal, list[dict]]:
    result = await db.execute(
        select(
            Category.name,
            func.coalesce(func.sum(Transaction.amount), 0),
        )
        .join(Category, Transaction.category_id == Category.id)
        .where(
            Transaction.user_id == user_id,
            Transaction.date >= d_from,
            Transaction.date <= d_to,
            Transaction.pending.is_(False),
            Transaction.amount > 0,
        )
        .group_by(Category.name)
        .order_by(func.sum(Transaction.amount).desc())
    )
    rows = result.all()
    total = sum(r[1] for r in rows)
    categories = [{"name": r[0], "amount": str(r[1])} for r in rows]
    return total, categories


async def compare_spending(
    user_id: str,
    db: AsyncSession,
    *,
    period1_start: str,
    period1_end: str,
    period2_start: str,
    period2_end: str,
) -> dict:
    t1, cats1 = await _period_spending(
        user_id, db, date.fromisoformat(period1_start), date.fromisoformat(period1_end),
    )
    t2, cats2 = await _period_spending(
        user_id, db, date.fromisoformat(period2_start), date.fromisoformat(period2_end),
    )

    diff = t2 - t1
    pct_change = _pct(abs(diff), t1) if t1 else "0"
    if diff < 0:
        pct_change = f"-{pct_change}"

    return {
        "period1": {
            "range": f"{period1_start} to {period1_end}",
            "total": str(t1),
            "categories": cats1,
        },
        "period2": {
            "range": f"{period2_start} to {period2_end}",
            "total": str(t2),
            "categories": cats2,
        },
        "difference": str(diff),
        "pct_change": pct_change,
    }
