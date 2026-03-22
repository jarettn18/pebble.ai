# Pebble — Budgeting App with AI Financial Assistant

Mint-like budgeting app with an integrated AI financial assistant. The AI assistant is both an in-app paid feature and a standalone API product for third-party financial services. Mobile-first (iOS/Android), web app planned later.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | Expo (React Native) with Expo Router |
| Backend | Python 3.13 + FastAPI |
| Database | PostgreSQL 16 (async via asyncpg + SQLAlchemy 2.0) |
| Migrations | Alembic |
| Cache/Rate Limit | Redis 7 |
| Bank Data | Plaid |
| AI | Claude API (tool-use/function-calling) |
| Package Mgmt | uv + Hatchling (backend), npm (mobile) |

---

## Monorepo Structure

```
pebble/
├── docker-compose.yml              # PostgreSQL + Redis + Backend + Mobile
├── .env.example
│
├── backend/
│   ├── pyproject.toml
│   ├── .env                         # Local dev secrets (git-ignored)
│   ├── alembic/                     # Migrations
│   └── src/pebble/
│       ├── main.py                  # FastAPI app entry
│       ├── config.py                # Pydantic Settings (reads .env)
│       ├── database.py              # Async engine + session factory
│       ├── models/                  # SQLAlchemy models
│       │   ├── user.py              # User + subscription_tier enum
│       │   ├── account.py           # PlaidItem + Account
│       │   ├── transaction.py       # Transaction (indexed on user_id+date)
│       │   ├── category.py          # Category
│       │   ├── budget.py            # Budget (per category per month)
│       │   ├── asset.py             # Asset (properties + vehicles, net worth)
│       │   ├── chat.py              # ChatConversation + ChatMessage
│       │   └── api_usage.py         # API usage metering
│       ├── schemas/                 # Pydantic request/response
│       │   ├── auth.py              # Register, Login, Token, User schemas
│       │   ├── account.py           # AccountOut, AccountListResponse
│       │   ├── asset.py             # AssetOut, Create/Update, ListResponse
│       │   ├── budget.py            # BudgetOut, Create/Update, ListResponse
│       │   ├── category.py          # CategoryOut, CategoryListResponse
│       │   ├── dashboard.py         # DashboardResponse, NetWorthHistory, SpendingByCategory, AssetSummary
│       │   ├── plaid.py             # LinkToken, Exchange, Sync schemas
│       │   └── transaction.py       # TransactionOut, Detail, Create, Update, List schemas
│       ├── routers/
│       │   ├── auth.py              # /v1/auth/* (register, login, refresh, me)
│       │   ├── accounts.py          # /v1/accounts (list user accounts)
│       │   ├── assets.py            # /v1/assets (CRUD for properties + vehicles)
│       │   ├── budgets.py           # /v1/budgets (CRUD)
│       │   ├── categories.py        # /v1/categories (list all)
│       │   ├── dashboard.py         # /v1/dashboard (aggregated overview + net worth history)
│       │   ├── plaid.py             # /v1/plaid/* (link-token, exchange, sync, sync-all)
│       │   └── transactions.py      # /v1/transactions (list, detail, create, update, delete)
│       ├── services/
│       │   ├── auth.py              # Auth business logic
│       │   ├── accounts.py          # Account queries with institution join
│       │   ├── assets.py            # Asset CRUD (properties + vehicles)
│       │   ├── budgets.py           # Budget CRUD + spending calculation
│       │   ├── categories.py        # Category queries, Plaid category map
│       │   ├── dashboard.py         # Aggregated dashboard + net worth history
│       │   ├── plaid.py             # Plaid API integration (link, exchange, sync, balance refresh)
│       │   └── transactions.py      # Transaction queries, detail, create, update, delete
│       ├── middleware/
│       │   └── auth.py              # JWT + API key auth dependencies
│       ├── ai/                      # AI module (Phase 4)
│       └── utils/
│           └── security.py          # bcrypt, JWT, Fernet, API key utils
│
├── mobile/
│   ├── app.json                     # Expo config (scheme: pebble)
│   ├── app/                         # Expo Router (file-based routing)
│   │   ├── _layout.tsx              # Root layout: QueryClient + AuthGate
│   │   ├── index.tsx                # Entry redirect
│   │   ├── (auth)/
│   │   │   ├── _layout.tsx          # Stack navigator (no header)
│   │   │   ├── login.tsx            # Login screen
│   │   │   └── register.tsx         # Register screen
│   │   ├── (tabs)/
│   │   │   ├── _layout.tsx          # Tab navigator (5 tabs)
│   │   │   ├── index.tsx            # Dashboard (net worth chart, pie chart, budgets)
│   │   │   ├── transactions.tsx     # Transaction list with search, filters & FAB
│   │   │   ├── budgets.tsx          # Budget list with progress bars
│   │   │   ├── ai-chat.tsx          # AI chat (placeholder)
│   │   │   └── settings.tsx         # Settings + logout
│   │   ├── budget/
│   │   │   └── [id].tsx             # Budget create/edit screen
│   │   ├── transaction/
│   │   │   ├── create.tsx           # Create transaction (expense/income toggle)
│   │   │   └── [id].tsx             # Transaction detail, edit & delete screen
│   │   ├── spending.tsx             # Spending summary (trend chart, category bars)
│   │   ├── income.tsx              # Income summary (trend chart, category bars)
│   │   ├── add-asset.tsx           # Add asset form (properties + vehicles)
│   │   └── asset/
│   │       └── [id].tsx            # Asset detail, edit & delete screen
│   └── src/
│       ├── api/
│       │   └── client.ts            # API client with auto JWT refresh
│       ├── components/
│       │   ├── LineChart.tsx         # SVG line chart with bezier curves, gradient fill, axis labels
│       │   ├── NetWorthChart.tsx     # Net worth history chart with period tabs (1M/3M/1Y/5Y)
│       │   └── PieChart.tsx          # SVG donut chart with interactive segments + legend
│       ├── hooks/
│       │   └── usePlaidLink.ts      # Plaid Link hook (fetch token, open modal)
│       ├── utils/
│       │   └── dashboard.ts         # Net worth, spending calc, currency formatting
│       └── stores/
│           ├── auth.ts              # Zustand auth store
│           ├── accounts.ts          # Zustand accounts store (24h cache)
│           ├── assets.ts            # Zustand assets store (CRUD)
│           ├── budgets.ts           # Zustand budgets store
│           ├── dashboard.ts         # Zustand dashboard store (server-side aggregation)
│           └── transactions.ts      # Zustand transactions store (24h cache)
```

---

## Database Schema

10 tables, all with UUID primary keys:

| Table | Purpose |
|-------|---------|
| `users` | Auth, profile, subscription tier, optional API key hash |
| `plaid_items` | Plaid connections (access token encrypted with Fernet) |
| `accounts` | Bank accounts linked via Plaid |
| `categories` | Spending categories (name, icon, color, Plaid mapping) |
| `transactions` | Financial transactions, indexed on `(user_id, date DESC)` |
| `budgets` | Monthly budget per category |
| `assets` | Properties & vehicles with estimated values (contributes to net worth) |
| `chat_conversations` | AI chat conversation threads |
| `chat_messages` | Individual messages (user/assistant roles) |
| `api_usage` | Token + request counts per user per billing period |

---

## Auth System

- **Registration/Login**: email + password (bcrypt hashed)
- **JWT tokens**: access (15 min) + refresh (30 days)
- **Mobile storage**: expo-secure-store
- **API client**: auto-refreshes expired access tokens transparently
- **Auth gate**: Expo Router layout redirects unauthenticated users to login
- **External API auth** (Phase 5): API key (SHA-256 hashed in DB), `X-API-Key` header

---

## AI Assistant Architecture (Phase 4)

Claude tool-use (function-calling) — not RAG, not direct SQL.

**Flow**: User message → Claude picks tools → Backend executes parameterized queries (scoped by user_id) → Results fed back to Claude → Natural language response streamed via SSE

**Tools**:
- `get_spending_by_category`, `get_spending_over_time`, `get_top_merchants`
- `get_account_balances`, `get_budget_status`, `get_recent_transactions`
- `get_income_summary`, `compare_spending`

**Dual exposure**:
- Internal: `/v1/ai/chat` (JWT auth, mobile app)
- External: `/api/v1/financial-ai/chat` (API key auth, third parties send financial context in payload)

---

## Plaid Integration (Phase 2)

1. Backend creates Link token → mobile opens Plaid Link UI
2. User connects bank → mobile sends public token to backend
3. Backend exchanges for access token, encrypts with Fernet, stores
4. Sync via `transactions/sync` (cursor-based)
5. Balance refresh via `accounts/get` with 15-minute staleness TTL (avoids excessive API calls)
6. Auto-categorization maps Plaid categories to internal categories on sync
7. MVP: sync on app open. Later: Plaid webhooks

---

## Phased Rollout

| Phase | Focus | Status |
|-------|-------|--------|
| 1 | Foundation — Docker, FastAPI, models, auth, Expo scaffold | **Done** |
| 2 | Plaid + Transactions — bank linking, sync, transaction list | **Done** |
| 3 | Budgets + Polish — CRUD, charts, search, error states | **In progress** |
| 4 | AI Assistant — tools, Claude integration, chat UI, SSE | Not started |
| 5 | Monetization — subscriptions, API keys, external API, rate limits | Not started |

---

## Completed (Phase 1)

### Backend
- [x] Docker Compose with Postgres 16 + Redis 7 (containers running)
- [x] FastAPI app scaffold (`main.py`, `config.py`, `database.py`)
- [x] Pydantic Settings loading from `.env`
- [x] All 9 SQLAlchemy models with UUID PKs, timestamps, relationships
- [x] Composite index on `transactions(user_id, date)` for query performance
- [x] Alembic configured for async — initial migration generated and applied
- [x] Auth endpoints: `POST /v1/auth/register`, `POST /v1/auth/login`, `POST /v1/auth/refresh`, `GET /v1/auth/me`
- [x] JWT access tokens (15 min) + refresh tokens (30 days)
- [x] Password hashing with bcrypt
- [x] Fernet encryption utils (for Plaid access tokens)
- [x] API key generation + SHA-256 hashing utils
- [x] JWT + API key auth middleware (FastAPI dependencies)
- [x] Health check endpoint (`GET /health`)
- [x] End-to-end verified: register → login → authenticated request → token refresh

### Mobile
- [x] Expo project with TypeScript (zero type errors)
- [x] Expo Router file-based routing configured
- [x] Auth gate in root layout (auto-redirects based on auth state)
- [x] Login screen with email/password
- [x] Register screen with name/email/password + client-side validation
- [x] Tab navigator with 5 tabs (Dashboard, Transactions, Budgets, AI Chat, Settings)
- [x] Dashboard screen with greeting + placeholder cards
- [x] Settings screen with user info display + logout confirmation
- [x] Placeholder screens for Transactions, Budgets, AI Chat
- [x] API client (`src/api/client.ts`) with automatic JWT refresh on 401
- [x] Secure token storage via expo-secure-store
- [x] Zustand auth store (register, login, logout, loadUser)
- [x] React Query provider configured

### Infrastructure
- [x] `.env.example` with all required environment variables
- [x] `.gitignore` (Python, Node, IDE, OS, env files)
- [x] Local `.env` with generated JWT secret + Fernet key

## Completed (Phase 2)

### Backend
- [x] Plaid service: link token, exchange, encrypt/store access token (httpx, not plaid-python SDK)
- [x] Transaction sync using `transactions/sync` (cursor-based)
- [x] Balance refresh endpoint with 15-minute staleness TTL to minimize API calls
- [x] Auto-categorization of Plaid transactions to internal categories on sync
- [x] Seed 30+ default categories (Food, Transport, Shopping, Bills, etc.) with Plaid mapping
- [x] Routers: `POST /v1/plaid/link-token`, `exchange`, `sync`, `sync-all`, `refresh-balances`
- [x] Routers: `GET /v1/accounts`, `GET /v1/transactions`
- [x] Plaid timeout increased from 30s to 90s for reliability

### Mobile
- [x] Plaid Link integration (`react-native-plaid-link-sdk`)
- [x] Account connection flow with multi-account support
- [x] Transaction list with pull-to-refresh sync + 24-hour cache
- [x] Transaction detail/edit screen (recategorize, view details)
- [x] Dashboard wired to real account balances + spending data

## Completed (Phase 3 — In Progress)

### Backend
- [x] Budget CRUD service + router (`POST/GET/PUT/DELETE /v1/budgets`)
- [x] Budget progress calculation (spent vs. budget per category per month)
- [x] Dashboard aggregation endpoint (`GET /v1/dashboard`) — net worth, spending, budgets, categories
- [x] Net worth history endpoint (`GET /v1/dashboard/net-worth-history?period=`) with walk-back algorithm
- [x] Net worth includes manual transactions (not captured in Plaid balances)
- [x] Transaction create/delete endpoints (`POST /v1/transactions`, `DELETE /v1/transactions/{id}`)
- [x] Transaction filtering: search, category, type (expense/income), date range
- [x] Downsampling for long chart periods (3-day for 1Y, 7-day for 5Y) with guaranteed latest point
- [x] Dashboard returns monthly income, income by category, and income over time (6 months)

### Backend
- [x] Asset CRUD service + router (`POST/GET/PUT/DELETE /v1/assets`) — properties + vehicles
- [x] Asset model with 9 types (primary_residence, rental, investment_property, vacation, land, car, motorcycle, boat, other)
- [x] Net worth includes asset estimated values (dashboard + history chart)
- [x] Transaction filtering by account_id, multi-select category_ids, multi-select types
- [x] Account name included in transaction responses (eager-loaded via joinedload)

### Mobile
- [x] Budget creation/edit screens with category picker
- [x] Budget progress bars in dashboard and budgets tab
- [x] Spending summary page with 6-month trend chart + category breakdown
- [x] Transaction search (debounced 400ms) + filter panel (type toggle, category chips)
- [x] Create transaction screen with expense/income toggle, account picker, category chips
- [x] Delete transaction with confirmation dialog
- [x] Net worth chart with period tabs (1M/3M/1Y/5Y), y-axis dollar labels, x-axis date labels
- [x] Dashboard auto-refreshes balances on tab focus (15-min TTL, cost-efficient)
- [x] SVG chart re-rendering fix (keyed on path data to bust react-native-svg cache)
- [x] Extended 8-color category palette (Sage, Coral, Ochre, Lavender, Terracotta, Teal, Forest Green, Ocean Blue)
- [x] Smooth bezier curves on line charts with enhanced gradient fill
- [x] Centralized theme with Plus Jakarta Sans + Inter font families
- [x] MaterialCommunityIcons for iOS-safe icon rendering
- [x] Carousel snap alignment fix using `snapToInterval`
- [x] Interactive donut chart for spending by category on dashboard (tap segments for amounts)
- [x] Income summary card on dashboard with donut chart
- [x] Income detail page (`app/income.tsx`) with monthly total, 6-month trend chart, category breakdown
- [x] Spending/Income cards in horizontal paging carousel with dot indicators
- [x] Dashboard silent reload on focus (no scroll-to-top snap)
- [x] API client handles Pydantic array validation errors and 204 No Content responses
- [x] Add asset screen with type chip picker, name, value, conditional address, notes
- [x] Asset detail/edit screen with save changes + delete with confirmation
- [x] Assets card on dashboard with type labels and estimated values
- [x] Header "+" button with dropdown menu for adding accounts and assets
- [x] Account-filtered transactions (tap account → transactions filtered by that account)
- [x] Multi-select filters (multiple types + categories simultaneously)
- [x] Account name displayed in transaction rows
- [x] Net worth chart renders when user has assets but no bank accounts

---

## Remaining Work

## TODO:

### Notes:
- Cached balances on dashboard have TTL of 15 minutes, might be better to switch to manual refresh syncing if API calls are not too expensive.

### General
- [ ] Mobile: Add "Report a Bug or Leave Feedback" section with link to GitHub Issues
- [ ] API: Add logging everywhere
- [ ] Ask Claude about password hashing vulnerabilities
- [ ] MFA phone authentication

### Known Bugs
- [ ] 'Link session ended' error under 'Add Another Account' when plaid linking is cancelled
- [ ] Budgets get a hanging loading icon if the back tab is pressed while making a budget
- [ ] Positive values that are categorized do not update the progress bar on the budget (design choice?)
- [ ] Handle budgets of the same category
- [x] Net Worth number does not reflect real-time changes made to transactions, add focus refresh to dashboard tab
- [ ] Fix the way net worth is plotted on the chart. Maybe just plot each individual day regardless of calculation time and zustand store the data.
- [ ] Income summary not refreshing when transactions are categorized. Will need to update based on refresh.

### Phase 2 — Plaid + Transactions
- [x] Plaid service: create link token, exchange public token, encrypt/store access token
- [x] ~~Plaid client utility (`plaid-python` SDK setup)~~ — using httpx directly instead of plaid-python SDK
- [x] Transaction sync service using `transactions/sync` (cursor-based)
- [x] Auto-categorization of Plaid transactions to internal categories
- [x] Seed default categories (Food, Transport, Shopping, Bills, etc.)
- [x] Router: `POST /v1/plaid/link-token`, `POST /v1/plaid/exchange`, `POST /v1/plaid/sync`, `POST /v1/plaid/sync-all`, `POST /v1/plaid/refresh-balances`
- [x] Router: `GET /v1/accounts`
- [x] Router: `GET /v1/transactions`
- [x] Mobile: Plaid Link integration (`react-native-plaid-link-sdk`)
- [x] Mobile: Account connection flow
- [x] Mobile: Transaction list with pull-to-refresh sync + 24-hour cache
- [x] Mobile: Transaction detail/edit (recategorize)
- [x] Mobile: Dashboard wired to real account balances + spending data
- [x] Mobile: Add capability to add multiple accounts

### Phase 3 — Budgets + Polish
- [x] Budget CRUD service + router (`POST/GET/PUT/DELETE /v1/budgets`)
- [x] Budget progress calculation (spent vs. budget per category per month)
- [x] Dashboard router (`GET /v1/dashboard`) — aggregated overview data
- [x] Mobile: Budget creation/edit screens
- [x] Mobile: Budget progress bars/cards
- [x] Mobile: Spending summary charts
- [x] Mobile: Transaction search + filtering (by category, type, date range)
- [x] Mobile: Add/Delete a transaction (with expense/income toggle)
- [ ] Mobile: Loading states, error handling, empty states across all screens
- [x] Mobile: Income/Earning summary charts
- [x] Mobile: Transaction details by account when tapping on an account in dashboard
- [x] Router: Add asset endpoints `POST/GET/PUT/DELETE /v1/assets` (properties + vehicles)
- [x] Mobile: Add asset frontend (add, detail/edit, delete screens)
- [x] Mobile: Header "+" dropdown menu for adding accounts and property
- [x] Mobile: Attach the account to the transactions details
- [x] Mobile: Refactor filtering (multi-select types + categories, account filter)

### Phase 4 — AI Assistant
- [ ] AI data access layer (`ai/data_access.py`) — parameterized queries scoped by user_id
- [ ] AI tool definitions (`ai/tools.py`) — 8 tools for Claude function-calling
- [ ] AI system prompts (`ai/prompts.py`)
- [ ] AI service orchestrator (`ai/service.py`) — message → tools → Claude → response
- [ ] SSE streaming endpoint: `POST /v1/ai/chat`
- [ ] AI schemas (`ai/schemas.py`)
- [ ] Conversation persistence (save messages to chat_conversations/chat_messages)
- [ ] Basic usage tracking (request + token counts)
- [ ] Mobile: Chat UI with message bubbles, input, streaming display
- [ ] Mobile: Conversation list/history

### Phase 5 — Monetization + External API
- [ ] Subscription tier enforcement (free vs. pro feature gating)
- [ ] API key generation endpoint (`POST /v1/settings/api-key`)
- [ ] External AI endpoint: `POST /api/v1/financial-ai/chat` (API key auth, context in payload)
- [ ] Rate limiting per tier (Redis-backed, `ai/usage.py`)
- [ ] Usage dashboard endpoint (`GET /v1/usage`)
- [ ] Mobile: Subscription/upgrade screen
- [ ] Mobile: API key management in settings
- [ ] API documentation for external consumers


### Phase 6 — Iteration
- [ ] AI System: Allow asset optimization/Balance Transfers
- [ ] AI System: Debt Restructuring/Credit Optimization
- [ ] API: Rate limiting on API calls
- [ ] Mobile: Support for dark mode
- [ ] Mobile: Update Transaction Categories to mimic Mint Category Schema
- [ ] Mobile: Data imports and exports
- [ ] Mobile: Sign in Google/Apple
- [ ] Mobile: Update Settings screen to support account changes
---

## Running Locally

```bash
# Start everything (Postgres, Redis, Backend, Mobile web)
docker compose up --build

# Or run in the background
docker compose up --build -d

# Rebuild after dependency changes (package.json, pyproject.toml)
docker compose up --build

# Stop all services
docker compose down

# View logs for a specific service
docker compose logs -f backend
docker compose logs -f mobile

# Query the database
docker exec -it pebble-postgres-1 psql -U pebble -d pebble

# Run iOS natively (requires Xcode, cannot run in Docker)
cd mobile
npm install
npx expo run:ios
```

---

## Infrastructure Targets

| Service | Local | Production |
|---------|-------|-----------|
| PostgreSQL | Docker (port 5432) | Neon |
| Redis | Docker (port 6379) | Upstash |
| Backend | Docker (port 8000) | Railway or Render |
| Mobile (web) | Docker (port 8081) | Static deploy |
| Mobile (iOS) | `npx expo run:ios` | EAS Build + TestFlight |
