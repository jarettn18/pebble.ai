"""Claude tool-use definitions and handler registry."""

from pebble.ai import data_access

TOOL_DEFINITIONS: list[dict] = [
    {
        "name": "get_spending_by_category",
        "description": "Get spending breakdown by category for a date range. Returns total and per-category amounts with percentages.",
        "input_schema": {
            "type": "object",
            "properties": {
                "date_from": {"type": "string", "description": "Start date (YYYY-MM-DD)"},
                "date_to": {"type": "string", "description": "End date (YYYY-MM-DD)"},
            },
            "required": ["date_from", "date_to"],
        },
    },
    {
        "name": "get_spending_over_time",
        "description": "Get monthly spending totals for the last N months. Shows the trend of total spending.",
        "input_schema": {
            "type": "object",
            "properties": {
                "months": {
                    "type": "integer",
                    "description": "Number of months to look back (1-12, default 6)",
                    "default": 6,
                },
            },
        },
    },
    {
        "name": "get_top_merchants",
        "description": "Get the merchants where the user spends the most, ranked by total amount spent.",
        "input_schema": {
            "type": "object",
            "properties": {
                "date_from": {"type": "string", "description": "Start date (YYYY-MM-DD)"},
                "date_to": {"type": "string", "description": "End date (YYYY-MM-DD)"},
                "limit": {
                    "type": "integer",
                    "description": "Max merchants to return (1-25, default 10)",
                    "default": 10,
                },
            },
            "required": ["date_from", "date_to"],
        },
    },
    {
        "name": "get_account_balances",
        "description": "Get current balances for all bank accounts and assets, plus total net worth.",
        "input_schema": {
            "type": "object",
            "properties": {},
        },
    },
    {
        "name": "get_budget_status",
        "description": "Get budget vs. actual spending for each budgeted category. Defaults to current month if month/year not specified.",
        "input_schema": {
            "type": "object",
            "properties": {
                "month": {"type": "integer", "description": "Month number (1-12). Defaults to current month."},
                "year": {"type": "integer", "description": "Year (e.g. 2026). Defaults to current year."},
            },
        },
    },
    {
        "name": "get_recent_transactions",
        "description": "Get recent transactions with optional filters. Use this to find specific transactions or see recent activity.",
        "input_schema": {
            "type": "object",
            "properties": {
                "limit": {
                    "type": "integer",
                    "description": "Max transactions to return (1-25, default 10)",
                    "default": 10,
                },
                "search": {"type": "string", "description": "Search by transaction name or merchant"},
                "category": {"type": "string", "description": "Filter by category name (partial match)"},
                "type": {
                    "type": "string",
                    "enum": ["expense", "income"],
                    "description": "Filter by transaction type",
                },
                "date_from": {"type": "string", "description": "Start date (YYYY-MM-DD)"},
                "date_to": {"type": "string", "description": "End date (YYYY-MM-DD)"},
            },
        },
    },
    {
        "name": "get_income_summary",
        "description": "Get income breakdown by category for a date range. Returns total income and per-source amounts.",
        "input_schema": {
            "type": "object",
            "properties": {
                "date_from": {"type": "string", "description": "Start date (YYYY-MM-DD)"},
                "date_to": {"type": "string", "description": "End date (YYYY-MM-DD)"},
            },
            "required": ["date_from", "date_to"],
        },
    },
    {
        "name": "compare_spending",
        "description": "Compare spending between two date periods. Shows side-by-side category breakdown with differences.",
        "input_schema": {
            "type": "object",
            "properties": {
                "period1_start": {"type": "string", "description": "First period start date (YYYY-MM-DD)"},
                "period1_end": {"type": "string", "description": "First period end date (YYYY-MM-DD)"},
                "period2_start": {"type": "string", "description": "Second period start date (YYYY-MM-DD)"},
                "period2_end": {"type": "string", "description": "Second period end date (YYYY-MM-DD)"},
            },
            "required": ["period1_start", "period1_end", "period2_start", "period2_end"],
        },
    },
    {
        "name": "search_financial_tips",
        "description": "Search for general financial tips and strategies. Use when the user asks for advice on budgeting, saving, debt management, or financial planning. Returns relevant tips from a curated knowledge base.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The financial topic or question to search for tips about",
                },
            },
            "required": ["query"],
        },
    },
    {
        "name": "get_financial_health_score",
        "description": "Get the user's Financial Health Score (0-100) with breakdown by component: savings rate, debt-to-income, emergency fund, budget adherence, net worth trend, and diversification. Use when the user asks about their financial health, score, or overall financial standing.",
        "input_schema": {
            "type": "object",
            "properties": {},
        },
    },
]

# Maps tool name → async handler function
TOOL_HANDLERS = {
    "get_spending_by_category": data_access.get_spending_by_category,
    "get_spending_over_time": data_access.get_spending_over_time,
    "get_top_merchants": data_access.get_top_merchants,
    "get_account_balances": data_access.get_account_balances,
    "get_budget_status": data_access.get_budget_status,
    "get_recent_transactions": data_access.get_recent_transactions,
    "get_income_summary": data_access.get_income_summary,
    "compare_spending": data_access.compare_spending,
    "search_financial_tips": data_access.search_financial_tips,
    "get_financial_health_score": data_access.get_financial_health_score,
}
