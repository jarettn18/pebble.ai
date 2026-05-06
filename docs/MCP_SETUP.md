# Pebble MCP Server — Setup Guide

## What it is

Pebble exposes a [Model Context Protocol](https://modelcontextprotocol.io) server so external AI clients (Claude Desktop, Cursor, custom agents) can query your Pebble data — recent transactions, account balances, budgets, financial health score, and more — and, with explicit opt-in, manage budgets on your behalf. Access is gated by a per-user API key with scoped permissions and is fully audit-logged.

## Get a key

1. Open the Pebble mobile app.
2. Go to **Settings → Connected AI tools**.
3. Tap **+ Connect a tool**.
4. Give it a name (e.g. "Claude Desktop"), pick the scopes you want to grant, and tap **Generate API key**.
5. Copy the `pb_…` value shown on the next screen. **This is the only time the full key is displayed** — store it in your client's config now.

### Scopes

| Scope | What it grants |
|---|---|
| `read:transactions` | Read transactions, spending breakdowns, income summaries |
| `read:accounts` | Read account balances and net worth |
| `read:budgets` | Read budgets and budget-vs-actual status |
| `write:budgets` | Create, update, and delete budgets |
| `read:insights` | Read financial health score and curated tips |

By default, grant only the `read:*` scopes you need. `write:budgets` is opt-in and lets the client modify your budget data.

## Claude Desktop config

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "pebble": {
      "url": "https://api.pebble.app/mcp/",
      "headers": {
        "Authorization": "Bearer pb_YOUR_KEY_HERE"
      }
    }
  }
}
```

Restart Claude Desktop. Pebble's tools will appear in the tool picker.

## Cursor config

Edit `~/.cursor/mcp.json` (or **Settings → Cursor Settings → MCP** in the IDE):

```json
{
  "mcpServers": {
    "pebble": {
      "url": "https://api.pebble.app/mcp/",
      "headers": {
        "Authorization": "Bearer pb_YOUR_KEY_HERE"
      }
    }
  }
}
```

## Available tools

| Tool | What it does | Scope |
|---|---|---|
| `get_spending_by_category` | Spending breakdown by category for a date range, with totals and percentages | `read:transactions` |
| `get_spending_over_time` | Monthly spending totals for the last N months (1–12) | `read:transactions` |
| `get_top_merchants` | Top merchants by total spend within a date range | `read:transactions` |
| `get_recent_transactions` | Recent transactions, with optional filters | `read:transactions` |
| `get_income_summary` | Income breakdown by category for a date range | `read:transactions` |
| `compare_spending` | Compare spending across two date periods, side by side | `read:transactions` |
| `get_account_balances` | Current balances for all bank accounts and assets, plus net worth | `read:accounts` |
| `get_budget_status` | Budget vs. actual spending per category (defaults to current month) | `read:budgets` |
| `list_budgets` | List all budgets, optionally filtered by month/year | `read:budgets` |
| `get_budget` | Get a single budget by id | `read:budgets` |
| `create_budget` | Create a new monthly budget for a category | `write:budgets` |
| `update_budget` | Update fields on an existing budget | `write:budgets` |
| `delete_budget` | Permanently delete a budget (asks for confirmation in well-behaved clients) | `write:budgets` |
| `search_financial_tips` | Search a curated knowledge base of financial tips | `read:insights` |
| `get_financial_health_score` | Financial Health Score (0–100) with component breakdown | `read:insights` |

## Revoke a key

In the app: **Settings → Connected AI tools**, tap **Revoke** next to a key, then confirm. The next request from that key returns `401 Unauthorized` — there is no propagation delay. Revocation is permanent; you cannot re-enable a revoked key.

## Limits

- **60 requests per minute, per key**
- **1,000 requests per day, per key**

> Limits are enforced per server instance; multi-instance deployments raise the effective ceiling proportionally.

When a limit is exceeded, the server returns `HTTP 429` with a `Retry-After` header indicating the number of seconds to wait. Limits are tracked independently per key, so generating multiple keys (one per client) avoids cross-client throttling.

## Security

- Keys are scoped — a key without `write:budgets` cannot create, update, or delete budgets, regardless of what the client asks.
- Keys default to read-only. `write:budgets` is opt-in at key-creation time.
- Every tool invocation is recorded in the audit log (tool name, args, status, latency, error). You can review activity at any time.
- Keys are stored hashed; only the prefix and metadata are visible after creation.
- Revoke any key from the app at any time; revocation is immediate.
- Keys are bearer credentials — treat them like passwords. Don't commit them to git, paste them into chat logs, or share screenshots that include them.
