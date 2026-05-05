"""MCP tool wrappers for budget CRUD."""

from pebble.mcp.context import get_context
from pebble.mcp.server import mcp
from pebble.middleware.api_key_auth import require_scope
from pebble.services import budgets as svc


def _ctx_user_db():
    ctx = get_context()
    return str(ctx.user.id), ctx.db, ctx.api_key


@mcp.tool()
async def list_budgets(
    month: int | None = None, year: int | None = None
) -> dict:
    """List all budgets, optionally filtered by month/year."""
    user_id, db, key = _ctx_user_db()
    require_scope(key, "read:budgets")
    return await svc.get_budgets(user_id, db, month=month, year=year)


@mcp.tool()
async def get_budget(budget_id: str) -> dict:
    """Get a single budget by id."""
    user_id, db, key = _ctx_user_db()
    require_scope(key, "read:budgets")
    return await svc.get_budget(user_id, budget_id, db)


@mcp.tool()
async def create_budget(
    category_id: str, amount: str, month: int, year: int
) -> dict:
    """Create a new monthly budget for a category. amount is a USD string
    (e.g. "250.00"). This will appear in the user's budgets list immediately."""
    user_id, db, key = _ctx_user_db()
    require_scope(key, "write:budgets")
    return await svc.create_budget(
        user_id,
        {"category_id": category_id, "amount": amount,
         "month": month, "year": year},
        db,
    )


@mcp.tool()
async def update_budget(
    budget_id: str,
    amount: str | None = None,
    category_id: str | None = None,
    month: int | None = None,
    year: int | None = None,
) -> dict:
    """Update fields on an existing budget. Only provided fields are changed."""
    user_id, db, key = _ctx_user_db()
    require_scope(key, "write:budgets")
    payload = {
        k: v
        for k, v in {
            "amount": amount, "category_id": category_id,
            "month": month, "year": year,
        }.items()
        if v is not None
    }
    return await svc.update_budget(user_id, budget_id, payload, db)


@mcp.tool()
async def delete_budget(budget_id: str) -> dict:
    """PERMANENTLY DELETE a budget. This cannot be undone. The user should
    confirm before calling."""
    user_id, db, key = _ctx_user_db()
    require_scope(key, "write:budgets")
    await svc.delete_budget(user_id, budget_id, db)
    return {"deleted": True, "budget_id": budget_id}
