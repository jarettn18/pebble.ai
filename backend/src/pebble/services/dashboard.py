import calendar
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from pebble.models.account import Account
from pebble.models.budget import Budget
from pebble.models.category import Category
from pebble.models.transaction import Transaction

DEBT_TYPES = {"credit", "loan"}

PERIOD_DAYS = {
    "1M": 30,
    "3M": 90,
    "1Y": 365,
    "5Y": 1825,
}


async def get_net_worth_history(
    user_id: str,
    period: str,
    db: AsyncSession,
) -> dict:
    """Compute historical net worth by working backwards from current balances.

    For any past date:
      net_worth_at(date) = current_net_worth + sum(transaction.amount from date+1 to today)

    This works because every transaction amount represents money that left the
    user's net worth (positive = spent/debited, negative = received/credited),
    regardless of account type.
    """
    days = PERIOD_DAYS.get(period, 30)
    today = date.today()
    start_date = today - timedelta(days=days)

    # Current net worth from account balances
    acct_result = await db.execute(
        select(Account.type, Account.balance_current)
        .where(Account.user_id == user_id)
    )
    current_nw = Decimal("0")
    has_accounts = False
    for row in acct_result.all():
        if row.balance_current is not None:
            has_accounts = True
            if row.type in DEBT_TYPES:
                current_nw -= row.balance_current
            else:
                current_nw += row.balance_current

    if not has_accounts:
        return {"period": period, "points": [], "current": None, "change": None, "change_pct": None}

    # Adjust for manual transactions (not in any account balance)
    manual_sum_result = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.user_id == user_id,
            Transaction.plaid_transaction_id.is_(None),
            Transaction.pending.is_(False),
        )
    )
    current_nw -= manual_sum_result.scalar() or Decimal("0")

    # Daily Plaid transaction totals — used to walk balances backwards.
    # Manual transactions are excluded because they are already fully
    # accounted for in the current_nw adjustment above.
    plaid_txn_result = await db.execute(
        select(
            Transaction.date,
            func.sum(Transaction.amount),
        )
        .where(
            Transaction.user_id == user_id,
            Transaction.date >= start_date,
            Transaction.pending.is_(False),
            Transaction.plaid_transaction_id.isnot(None),
        )
        .group_by(Transaction.date)
        .order_by(Transaction.date.desc())
    )
    plaid_daily: dict[date, Decimal] = {
        row[0]: row[1] for row in plaid_txn_result.all()
    }

    # Daily manual transaction totals — tracked separately so we can
    # accumulate them as we walk backwards (manual txns only affect NW
    # from their date onward).
    manual_txn_result = await db.execute(
        select(
            Transaction.date,
            func.sum(Transaction.amount),
        )
        .where(
            Transaction.user_id == user_id,
            Transaction.date >= start_date,
            Transaction.pending.is_(False),
            Transaction.plaid_transaction_id.is_(None),
        )
        .group_by(Transaction.date)
        .order_by(Transaction.date.desc())
    )
    manual_daily: dict[date, Decimal] = {
        row[0]: row[1] for row in manual_txn_result.all()
    }

    # Build points from today backwards, then reverse.
    # For Plaid txns: reverse them from the balance (balance already includes them).
    # For manual txns: add them back as we go backwards (they were subtracted from current_nw).
    points = []
    running_nw = current_nw
    d = today
    while d >= start_date:
        points.append({"date": d.isoformat(), "value": str(running_nw)})
        # Reverse Plaid transactions to undo their effect on balances
        if d in plaid_daily:
            running_nw += plaid_daily[d]
        # Add back manual transactions (they were subtracted from current_nw
        # as a lump sum, so we restore them day by day going backwards)
        if d in manual_daily:
            running_nw += manual_daily[d]
        d -= timedelta(days=1)

    points.reverse()

    # Downsample for longer periods to keep response small,
    # but always include the last point (today).
    if days > 365:
        sampled = points[::7]
        if sampled[-1] != points[-1]:
            sampled.append(points[-1])
        points = sampled
    elif days > 90:
        sampled = points[::3]
        if sampled[-1] != points[-1]:
            sampled.append(points[-1])
        points = sampled

    first_value = Decimal(points[0]["value"]) if points else current_nw
    change = current_nw - first_value
    change_pct = (
        str(round((change / abs(first_value)) * 100, 2))
        if first_value != 0
        else "0"
    )

    return {
        "period": period,
        "points": points,
        "current": str(current_nw),
        "change": str(change),
        "change_pct": change_pct,
    }


async def get_dashboard(
    user_id: str,
    month: int,
    year: int,
    db: AsyncSession,
) -> dict:
    # --- Accounts + net worth ---
    acct_result = await db.execute(
        select(Account)
        .where(Account.user_id == user_id)
        .options(joinedload(Account.plaid_item))
        .order_by(Account.name)
    )
    accounts = acct_result.scalars().unique().all()

    net_worth: Decimal | None = None
    account_list = []
    for a in accounts:
        bal = a.balance_current
        if bal is not None:
            if net_worth is None:
                net_worth = Decimal("0")
            net_worth += -bal if a.type in DEBT_TYPES else bal
        account_list.append({
            "id": str(a.id),
            "name": a.name,
            "type": a.type,
            "subtype": a.subtype,
            "balance_current": str(a.balance_current) if a.balance_current is not None else None,
            "institution_name": a.plaid_item.institution_name if a.plaid_item else None,
        })

    # Adjust net worth for manual transactions (not synced from Plaid).
    # Plaid account balances already reflect Plaid transactions, but manual
    # transactions (plaid_transaction_id IS NULL) are not captured in any
    # account balance, so we subtract their sum.
    # Positive amount = expense (reduces NW), negative = income (increases NW).
    if net_worth is not None:
        manual_sum_result = await db.execute(
            select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                Transaction.user_id == user_id,
                Transaction.plaid_transaction_id.is_(None),
                Transaction.pending.is_(False),
            )
        )
        manual_total = manual_sum_result.scalar() or Decimal("0")
        net_worth -= manual_total

    # --- Monthly spending (sum of positive, non-pending transactions) ---
    first_day = date(year, month, 1)
    if month == 12:
        last_day = date(year + 1, 1, 1)
    else:
        last_day = date(year, month + 1, 1)

    spend_result = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.user_id == user_id,
            Transaction.date >= first_day,
            Transaction.date < last_day,
            Transaction.pending.is_(False),
            Transaction.amount > 0,
        )
    )
    monthly_spending = spend_result.scalar() or Decimal("0")

    # --- Monthly income (sum of absolute negative, non-pending transactions) ---
    income_result = await db.execute(
        select(func.coalesce(func.sum(func.abs(Transaction.amount)), 0)).where(
            Transaction.user_id == user_id,
            Transaction.date >= first_day,
            Transaction.date < last_day,
            Transaction.pending.is_(False),
            Transaction.amount < 0,
        )
    )
    monthly_income = income_result.scalar() or Decimal("0")

    # --- Spending by category ---
    cat_spend_result = await db.execute(
        select(
            Category.name,
            func.coalesce(func.sum(Transaction.amount), 0),
        )
        .join(Category, Transaction.category_id == Category.id)
        .where(
            Transaction.user_id == user_id,
            Transaction.date >= first_day,
            Transaction.date < last_day,
            Transaction.pending.is_(False),
            Transaction.amount > 0,
        )
        .group_by(Category.name)
        .order_by(func.sum(Transaction.amount).desc())
    )
    spending_by_category = [
        {"category_name": row[0], "amount": str(row[1])}
        for row in cat_spend_result.all()
    ]

    # --- Income by category ---
    cat_income_result = await db.execute(
        select(
            Category.name,
            func.coalesce(func.sum(func.abs(Transaction.amount)), 0),
        )
        .join(Category, Transaction.category_id == Category.id)
        .where(
            Transaction.user_id == user_id,
            Transaction.date >= first_day,
            Transaction.date < last_day,
            Transaction.pending.is_(False),
            Transaction.amount < 0,
        )
        .group_by(Category.name)
        .order_by(func.sum(func.abs(Transaction.amount)).desc())
    )
    income_by_category = [
        {"category_name": row[0], "amount": str(row[1])}
        for row in cat_income_result.all()
    ]

    # --- Budget summaries for the month ---
    budget_result = await db.execute(
        select(Budget)
        .where(Budget.user_id == user_id, Budget.month == month, Budget.year == year)
        .options(joinedload(Budget.category))
    )
    budgets = budget_result.scalars().unique().all()

    # Get spending per category (reuse the same date range)
    cat_spending_result = await db.execute(
        select(
            Transaction.category_id,
            func.coalesce(func.sum(Transaction.amount), 0),
        )
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
    cat_spending_map = {row[0]: row[1] for row in cat_spending_result.all()}

    budget_summaries = [
        {
            "category_name": b.category.name if b.category else None,
            "amount": str(b.amount),
            "spent": str(cat_spending_map.get(b.category_id, Decimal("0"))),
        }
        for b in budgets
    ]

    # --- Spending over time (last 6 months including current) ---
    # Calculate 5 months back from current month
    periods: list[tuple[int, int]] = []
    m_iter, y_iter = month, year
    for _ in range(6):
        periods.append((m_iter, y_iter))
        m_iter -= 1
        if m_iter < 1:
            m_iter = 12
            y_iter -= 1
    periods.reverse()  # oldest first

    six_months_ago_m, six_months_ago_y = periods[0]
    six_months_start = date(six_months_ago_y, six_months_ago_m, 1)

    time_result = await db.execute(
        select(
            extract("year", Transaction.date).label("yr"),
            extract("month", Transaction.date).label("mo"),
            func.coalesce(func.sum(Transaction.amount), 0),
        )
        .where(
            Transaction.user_id == user_id,
            Transaction.date >= six_months_start,
            Transaction.date < last_day,
            Transaction.pending.is_(False),
            Transaction.amount > 0,
        )
        .group_by("yr", "mo")
    )
    time_map = {(int(row[0]), int(row[1])): row[2] for row in time_result.all()}

    spending_over_time = [
        {
            "month": mo,
            "year": yr,
            "label": calendar.month_abbr[mo],
            "amount": str(time_map.get((yr, mo), Decimal("0"))),
        }
        for mo, yr in periods
    ]

    # --- Income over time (last 6 months including current) ---
    income_time_result = await db.execute(
        select(
            extract("year", Transaction.date).label("yr"),
            extract("month", Transaction.date).label("mo"),
            func.coalesce(func.sum(func.abs(Transaction.amount)), 0),
        )
        .where(
            Transaction.user_id == user_id,
            Transaction.date >= six_months_start,
            Transaction.date < last_day,
            Transaction.pending.is_(False),
            Transaction.amount < 0,
        )
        .group_by("yr", "mo")
    )
    income_time_map = {(int(row[0]), int(row[1])): row[2] for row in income_time_result.all()}

    income_over_time = [
        {
            "month": mo,
            "year": yr,
            "label": calendar.month_abbr[mo],
            "amount": str(income_time_map.get((yr, mo), Decimal("0"))),
        }
        for mo, yr in periods
    ]

    return {
        "net_worth": str(net_worth) if net_worth is not None else None,
        "monthly_spending": str(monthly_spending),
        "monthly_income": str(monthly_income),
        "accounts": account_list,
        "budget_summaries": budget_summaries,
        "spending_by_category": spending_by_category,
        "income_by_category": income_by_category,
        "spending_over_time": spending_over_time,
        "income_over_time": income_over_time,
    }
