"""Build a compact financial profile for injection into the AI system prompt."""

import calendar
import logging
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from pebble.models.user import User
from pebble.redis import redis_client
from pebble.services.dashboard import get_dashboard

logger = logging.getLogger(__name__)

PROFILE_CACHE_PREFIX = "financial_profile:"
PROFILE_TTL = 300  # seconds


def _fmt_amount(value: str | Decimal | None) -> str:
    """Format a numeric string as $X,XXX (no cents unless < $10)."""
    if value is None:
        return "$0"
    d = Decimal(str(value))
    abs_d = abs(d)
    if abs_d < 10 and abs_d != abs_d.to_integral_value():
        formatted = f"{abs_d:,.2f}"
    else:
        formatted = f"{abs_d.to_integral_value():,.0f}"
    return f"-${formatted}" if d < 0 else f"${formatted}"


def _format_profile(data: dict, month: int, year: int) -> str:
    """Transform dashboard data into a compact text block for Claude."""
    lines: list[str] = []

    net_worth = data.get("net_worth")
    if net_worth is None and not data.get("accounts") and not data.get("assets"):
        return ""

    lines.append("=== FINANCIAL SNAPSHOT ===")

    # Net worth
    if net_worth is not None:
        lines.append(f"Net Worth: {_fmt_amount(net_worth)}")

    # Monthly spending & income
    spending = data.get("monthly_spending", "0")
    income = data.get("monthly_income", "0")
    net = Decimal(str(income)) - Decimal(str(spending))
    month_label = calendar.month_abbr[month]
    net_str = f"+{_fmt_amount(net)}" if net >= 0 else _fmt_amount(net)
    lines.append(
        f"Monthly ({month_label} {year}): Spending {_fmt_amount(spending)} | "
        f"Income {_fmt_amount(income)} | Net {net_str}"
    )

    # Top spending categories (max 5)
    categories = data.get("spending_by_category", [])
    total_spending = Decimal(str(spending)) if Decimal(str(spending)) > 0 else Decimal("1")
    if categories:
        parts = []
        for cat in categories[:5]:
            amt = Decimal(str(cat["amount"]))
            pct = round((amt / total_spending) * 100)
            parts.append(f"{cat['category_name']} {_fmt_amount(amt)} ({pct}%)")
        lines.append(f"Top Spending: {', '.join(parts)}")

    # Budget status
    budgets = data.get("budget_summaries", [])
    if budgets:
        on_track = []
        over_budget = []
        for b in budgets:
            budget_amt = Decimal(str(b["amount"]))
            spent_amt = Decimal(str(b["spent"]))
            name = b["category_name"] or "Uncategorized"
            if spent_amt > budget_amt:
                overage = spent_amt - budget_amt
                over_budget.append(f"{name} (+{_fmt_amount(overage)})")
            else:
                on_track.append(name)

        status = f"{len(on_track)}/{len(budgets)} on track"
        if over_budget:
            status += f" | Over: {', '.join(over_budget)}"
        lines.append(f"Budgets: {status}")

    # Spending trend (current month vs previous month)
    spending_over_time = data.get("spending_over_time", [])
    if len(spending_over_time) >= 2:
        current = Decimal(str(spending_over_time[-1]["amount"]))
        previous = Decimal(str(spending_over_time[-2]["amount"]))
        if previous > 0:
            change_pct = round(((current - previous) / previous) * 100)
            direction = "up" if change_pct > 0 else "down"
            lines.append(
                f"Trend: Spending {direction} {abs(change_pct)}% vs last month "
                f"({_fmt_amount(current)} vs {_fmt_amount(previous)})"
            )

    # Accounts (compact list)
    accounts = data.get("accounts", [])
    if accounts:
        acct_parts = []
        for a in accounts[:6]:
            name = a["name"]
            bal = a.get("balance_current")
            if bal is not None:
                acct_parts.append(f"{name} {_fmt_amount(bal)}")
        if acct_parts:
            lines.append(f"Accounts: {' | '.join(acct_parts)}")

    # Assets
    assets = data.get("assets", [])
    if assets:
        asset_parts = []
        for a in assets[:4]:
            asset_parts.append(f"{a['name']} {_fmt_amount(a['estimated_value'])}")
        lines.append(f"Assets: {' | '.join(asset_parts)}")

    return "\n".join(lines)


async def build_financial_profile(user_id: str, db: AsyncSession) -> str:
    """Return a cached or freshly built financial profile string."""
    cache_key = f"{PROFILE_CACHE_PREFIX}{user_id}"

    # Check cache
    cached = await redis_client.get(cache_key)
    if cached is not None:
        logger.debug("Financial profile cache hit for user %s", user_id)
        return cached

    # Build fresh
    logger.debug("Building financial profile for user %s", user_id)
    today = date.today()
    data = await get_dashboard(user_id, month=today.month, year=today.year, db=db)
    profile = _format_profile(data, today.month, today.year)

    # Append demographic context if available
    demographics = await _build_demographics(user_id, db, today)
    if demographics:
        profile = f"{profile}\n{demographics}" if profile else demographics

    # Cache (even empty string — avoids repeated queries for users with no data)
    await redis_client.setex(cache_key, PROFILE_TTL, profile)

    return profile


async def _build_demographics(user_id: str, db: AsyncSession, today: date) -> str:
    """Build a compact demographics line from user profile fields."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        return ""

    parts: list[str] = []

    if user.date_of_birth:
        age = today.year - user.date_of_birth.year
        if (today.month, today.day) < (user.date_of_birth.month, user.date_of_birth.day):
            age -= 1
        parts.append(f"{age}yo")

    if user.marital_status:
        parts.append(user.marital_status)

    if user.dependents and user.dependents > 0:
        parts.append(f"{user.dependents} dependent{'s' if user.dependents != 1 else ''}")

    if user.state:
        parts.append(user.state)

    if user.annual_income is not None:
        parts.append(f"${user.annual_income:,}/yr income")

    if user.occupation:
        parts.append(user.occupation)

    lines: list[str] = []
    if parts:
        lines.append(f"DEMOGRAPHICS: {', '.join(parts)}")

    if user.financial_goals:
        lines.append(f"GOALS: {', '.join(user.financial_goals)}")

    return "\n".join(lines)
