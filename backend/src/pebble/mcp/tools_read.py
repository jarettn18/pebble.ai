"""MCP tool wrappers around pebble.ai.data_access read functions."""

from pebble.ai import data_access
from pebble.mcp.context import get_context
from pebble.mcp.server import mcp
from pebble.middleware.api_key_auth import require_scope


def _ctx_user_db():
    ctx = get_context()
    return str(ctx.user.id), ctx.db, ctx.api_key


@mcp.tool()
async def get_spending_by_category(date_from: str, date_to: str) -> dict:
    """Get spending breakdown by category for a date range. Returns total
    and per-category amounts with percentages."""
    user_id, db, key = _ctx_user_db()
    require_scope(key, "read:transactions")
    return await data_access.get_spending_by_category(
        user_id, db, date_from=date_from, date_to=date_to
    )


@mcp.tool()
async def get_spending_over_time(months: int = 6) -> dict:
    """Monthly spending totals for the last N months (1-12)."""
    user_id, db, key = _ctx_user_db()
    require_scope(key, "read:transactions")
    return await data_access.get_spending_over_time(
        user_id, db, months=months
    )


@mcp.tool()
async def get_top_merchants(
    date_from: str, date_to: str, limit: int = 10
) -> dict:
    """Top merchants by total spend within a date range."""
    user_id, db, key = _ctx_user_db()
    require_scope(key, "read:transactions")
    return await data_access.get_top_merchants(
        user_id, db, date_from=date_from, date_to=date_to, limit=limit
    )


@mcp.tool()
async def get_account_balances() -> dict:
    """Current balances for all bank accounts and assets, plus net worth."""
    user_id, db, key = _ctx_user_db()
    require_scope(key, "read:accounts")
    return await data_access.get_account_balances(user_id, db)


@mcp.tool()
async def get_budget_status(
    month: int | None = None, year: int | None = None
) -> dict:
    """Budget vs. actual spending per category. Defaults to current month."""
    user_id, db, key = _ctx_user_db()
    require_scope(key, "read:budgets")
    return await data_access.get_budget_status(
        user_id, db, month=month, year=year
    )


@mcp.tool()
async def get_recent_transactions(
    limit: int = 10,
    search: str | None = None,
    category: str | None = None,
    type: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> dict:
    """Recent transactions with optional filters."""
    user_id, db, key = _ctx_user_db()
    require_scope(key, "read:transactions")
    return await data_access.get_recent_transactions(
        user_id, db,
        limit=limit, search=search, category=category, type=type,
        date_from=date_from, date_to=date_to,
    )


@mcp.tool()
async def get_income_summary(date_from: str, date_to: str) -> dict:
    """Income breakdown by category for a date range."""
    user_id, db, key = _ctx_user_db()
    require_scope(key, "read:transactions")
    return await data_access.get_income_summary(
        user_id, db, date_from=date_from, date_to=date_to
    )


@mcp.tool()
async def compare_spending(
    period1_start: str, period1_end: str,
    period2_start: str, period2_end: str,
) -> dict:
    """Compare spending between two date periods, side by side."""
    user_id, db, key = _ctx_user_db()
    require_scope(key, "read:transactions")
    return await data_access.compare_spending(
        user_id, db,
        period1_start=period1_start, period1_end=period1_end,
        period2_start=period2_start, period2_end=period2_end,
    )


@mcp.tool()
async def search_financial_tips(query: str) -> dict:
    """Search a curated knowledge base of financial tips."""
    user_id, db, key = _ctx_user_db()
    require_scope(key, "read:insights")
    return await data_access.search_financial_tips(user_id, db, query=query)


@mcp.tool()
async def get_financial_health_score() -> dict:
    """Financial Health Score (0-100) with component breakdown."""
    user_id, db, key = _ctx_user_db()
    require_scope(key, "read:insights")
    return await data_access.get_financial_health_score(user_id, db)
