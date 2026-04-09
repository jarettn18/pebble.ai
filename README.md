# Pebble — Budgeting App with AI Financial Assistant

Mint-like budgeting app with an integrated AI financial assistant. The AI assistant is both an in-app paid feature and a standalone API product for third-party financial services. Mobile-first (iOS/Android), web app planned later.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | Expo (React Native) with Expo Router |
| Backend | Python 3.13 + FastAPI |
| Database | PostgreSQL 16 + pgvector (async via asyncpg + SQLAlchemy 2.0) |
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
│       │   ├── budget.py            # Budget (per category per month, optional plan FK)
│       │   ├── budget_plan.py       # BudgetPlan + BudgetPlanAllocation (unified plans)
│       │   ├── asset.py             # Asset (properties + vehicles, net worth)
│       │   ├── chat.py              # ChatConversation + ChatMessage
│       │   ├── financial_tip.py     # FinancialTip (pgvector Vector(384) embedding)
│       │   ├── health_score.py     # FinancialHealthScore (0-100 score snapshots with component breakdown)
│       │   └── api_usage.py         # API usage metering
│       ├── schemas/                 # Pydantic request/response
│       │   ├── auth.py              # Register, Login, Token, User schemas
│       │   ├── account.py           # AccountOut, AccountListResponse
│       │   ├── asset.py             # AssetOut, Create/Update, ListResponse
│       │   ├── budget.py            # BudgetOut, Create/Update, ListResponse
│       │   ├── budget_plan.py       # BudgetPlanOut, Create/Update, Allocation schemas
│       │   ├── category.py          # CategoryOut, CategoryListResponse
│       │   ├── csv_import.py        # CSVImportResponse, CSVImportError
│       │   ├── dashboard.py         # DashboardResponse, NetWorthHistory, SpendingByCategory, AssetSummary
│       │   ├── health_score.py      # HealthScoreResponse, ComponentScore, BenchmarkInsight, HistoryResponse
│       │   ├── ai_chat.py            # ChatRequest, ConversationOut, MessageOut schemas
│       │   ├── plaid.py             # LinkToken, Exchange, Sync schemas
│       │   └── transaction.py       # TransactionOut, Detail, Create, Update, List schemas
│       ├── routers/
│       │   ├── auth.py              # /v1/auth/* (register, login, refresh, me)
│       │   ├── accounts.py          # /v1/accounts (list user accounts)
│       │   ├── assets.py            # /v1/assets (CRUD for properties + vehicles)
│       │   ├── budgets.py           # /v1/budgets (CRUD)
│       │   ├── budget_plans.py      # /v1/budget-plans (CRUD, recurring generation)
│       │   ├── categories.py        # /v1/categories (list all, update color)
│       │   ├── dashboard.py         # /v1/dashboard (aggregated overview + net worth history)
│       │   ├── health_score.py      # /v1/health-score (score + history endpoints)
│       │   ├── ai_chat.py            # /v1/ai/* (chat SSE, conversations CRUD)
│       │   ├── csv_import.py         # /v1/transactions/import-csv (CSV file upload + parsing)
│       │   ├── plaid.py             # /v1/plaid/* (link-token, exchange, sync, sync-all)
│       │   └── transactions.py      # /v1/transactions (list, detail, create, update, delete)
│       ├── services/
│       │   ├── auth.py              # Auth business logic
│       │   ├── accounts.py          # Account queries with institution join
│       │   ├── assets.py            # Asset CRUD (properties + vehicles)
│       │   ├── budgets.py           # Budget CRUD + spending calculation
│       │   ├── budget_plans.py      # Budget plan CRUD, allocation management, recurring generation
│       │   ├── categories.py        # Category queries, Plaid category map
│       │   ├── dashboard.py         # Aggregated dashboard + net worth history
│       │   ├── health_score.py     # Financial Health Score calculation + caching + snapshots
│       │   ├── benchmarks.py       # Static demographic benchmarks (Census/BLS/Fed SCF percentile data)
│       │   ├── plaid.py             # Plaid API integration (link, exchange, sync, balance refresh)
│       │   ├── rate_limiter.py      # AsyncRateLimiter (token-bucket for Plaid) + RateLimitDependency (per-endpoint sliding window)
│       │   ├── csv_import.py         # CSV parsing, column auto-detection, bulk transaction import
│       │   └── transactions.py      # Transaction queries, detail, create, update, delete
│       ├── middleware/
│       │   └── auth.py              # JWT + API key auth dependencies
│       ├── ai/                      # AI module (Phase 5)
│       │   ├── __init__.py
│       │   ├── prompts.py           # System prompt with persona + financial profile placeholder
│       │   ├── tools.py             # 10 tool definitions + handler registry
│       │   ├── data_access.py       # Tool handler functions (parameterized queries)
│       │   ├── service.py           # AIChatService orchestrator (streaming + tool loop)
│       │   ├── profile.py           # Financial profile builder (cached in Redis, 300s TTL)
│       │   ├── rag.py               # RAG module — pgvector semantic search for financial tips
│       │   ├── rag_seed.py          # Seeding script to populate tips with embeddings
│       │   └── tips_data.json       # Curated financial education tips
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
│   │   │   ├── budgets.tsx          # Budget list with progress bars, expandable plans, swipe-to-delete
│   │   │   ├── ai-chat.tsx          # AI chat (streaming, markdown, conversation history)
│   │   │   └── settings.tsx         # Settings + logout
│   │   ├── budget/
│   │   │   ├── create.tsx           # Multi-step budget plan creation wizard
│   │   │   ├── [id].tsx             # Budget create/edit screen
│   │   │   └── plan/
│   │   │       └── [id].tsx         # Budget plan detail with inline editing
│   │   ├── transaction/
│   │   │   ├── create.tsx           # Create transaction (expense/income toggle)
│   │   │   └── [id].tsx             # Transaction detail, edit & delete screen
│   │   ├── spending.tsx             # Spending summary (trend chart, category bars)
│   │   ├── income.tsx              # Income summary (trend chart, category bars)
│   │   ├── health-score.tsx        # Financial Health Score detail (gauge, breakdown bars, insights, history)
│   │   ├── budget-transactions.tsx # Budget category drill-down (transactions for a budget)
│   │   ├── account-transactions.tsx# Account drill-down (balance + transactions for an account)
│   │   ├── add-asset.tsx           # Add asset form (properties + vehicles)
│   │   ├── import-csv.tsx          # CSV transaction import (file picker, account selector, results)
│   │   └── asset/
│   │       └── [id].tsx            # Asset detail, edit & delete screen
│   └── src/
│       ├── api/
│       │   ├── client.ts            # API client with auto JWT refresh
│       │   └── streaming.ts         # SSE streaming client (XHR onprogress for React Native)
│       ├── components/
│       │   ├── CategoryAllocation.tsx # Category allocation list with inline amount inputs
│       │   ├── ColorPickerModal.tsx   # Bottom-sheet color picker with 16 preset swatches
│       │   ├── MonthPicker.tsx       # Multi-select month grid with recurring toggle
│       │   ├── LineChart.tsx         # SVG line chart with bezier curves, gradient fill, axis labels
│       │   ├── NetWorthChart.tsx     # Net worth history chart with period tabs (1M/3M/1Y/5Y)
│       │   ├── PieChart.tsx          # SVG donut chart with interactive segments + legend
│       │   ├── TransactionRow.tsx    # Shared transaction row + separator components
│       │   └── TransactionListCard.tsx # Shared transaction list card (used across 4+ screens)
│       ├── hooks/
│       │   └── usePlaidLink.ts      # Plaid Link hook (fetch token, open modal)
│       ├── utils/
│       │   ├── categoryIcons.ts     # Shared getCategoryIcon() mapping (30+ categories → MaterialCommunityIcons)
│       │   ├── color.ts             # withOpacity, contrastForeground color utilities
│       │   └── dashboard.ts         # Net worth, spending calc, currency formatting
│       └── stores/
│           ├── auth.ts              # Zustand auth store
│           ├── accounts.ts          # Zustand accounts store (24h cache)
│           ├── aiChat.ts            # Zustand AI chat store (streaming, conversations)
│           ├── assets.ts            # Zustand assets store (CRUD)
│           ├── budgets.ts           # Zustand budgets store
│           ├── budgetPlans.ts       # Zustand budget plans store
│           ├── dashboard.ts         # Zustand dashboard store (server-side aggregation)
│           ├── healthScore.ts      # Zustand health score store (score + insights + history)
│           └── transactions.ts      # Zustand transactions store (24h cache)
```

---

## Database Schema

14 tables, all with UUID primary keys:

| Table | Purpose |
|-------|---------|
| `users` | Auth, profile, subscription tier, optional API key hash |
| `plaid_items` | Plaid connections (access token encrypted with Fernet) |
| `accounts` | Bank accounts linked via Plaid |
| `categories` | Spending categories (name, icon, color, Plaid mapping) |
| `transactions` | Financial transactions, indexed on `(user_id, date DESC)` |
| `budgets` | Monthly budget per category (optional FK to budget_plans) |
| `budget_plans` | Unified budget plans with total amount, recurrence settings |
| `budget_plan_allocations` | Per-category allocations within a budget plan |
| `assets` | Properties & vehicles with estimated values (contributes to net worth) |
| `chat_conversations` | AI chat conversation threads |
| `chat_messages` | Individual messages (user/assistant roles) |
| `financial_tips` | Curated tips with pgvector embeddings for RAG semantic search |
| `financial_health_scores` | Health score snapshots (0-100, component scores, grade, details JSON) |
| `api_usage` | Token + request counts per user per billing period |

---

## Auth System

- **Registration/Login**: email + password (bcrypt hashed)
- **JWT tokens**: access (15 min) + refresh (30 days)
- **Mobile storage**: expo-secure-store
- **API client**: auto-refreshes expired access tokens transparently
- **Auth gate**: Expo Router layout redirects unauthenticated users to login
- **External API auth** (Phase 6): API key (SHA-256 hashed in DB), `X-API-Key` header

---

## AI Assistant Architecture (Phase 5)

Claude tool-use (function-calling) + RAG for financial education tips.

**Flow**: User message → Financial profile injected into system prompt (cached 300s in Redis) → Claude picks tools → Backend executes parameterized queries (scoped by user_id) → Results fed back to Claude → Natural language response streamed via SSE

**Tools** (10):
- `get_spending_by_category`, `get_spending_over_time`, `get_top_merchants`
- `get_account_balances`, `get_budget_status`, `get_recent_transactions`
- `get_income_summary`, `compare_spending`
- `search_financial_tips` (pgvector semantic search over curated tips)
- `get_financial_health_score` (0-100 score breakdown + demographic benchmark insights)

**RAG**: Financial tips stored with 384-dim embeddings (all-MiniLM-L6-v2), searched via pgvector cosine distance. Returns top 3 relevant tips for advisory questions.

**Financial Profile**: Compact snapshot of user's financial state (net worth, spending/income, budget status, top categories, accounts, assets) injected into every chat for context-aware responses.

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
7. Outbound rate limiting: token-bucket throttle (5 req/s) + retry with exponential backoff on 429s (up to 3 attempts)
8. MVP: sync on app open. Later: Plaid webhooks

---

## Rate Limiting

Two layers of rate limiting protect the backend:

**Outbound (Plaid API)**: Token-bucket throttle at 5 requests/second. Automatic retry with exponential backoff (1s/2s/4s) on 429 responses, respects `Retry-After` header.

**Inbound (per-endpoint)**: Sliding-window counters keyed by user ID (authenticated) or IP (public). Returns `429 Too Many Requests` when exceeded.

| Endpoint | Limit | Key |
|----------|-------|-----|
| `POST /v1/auth/login` | 5/min | IP |
| `POST /v1/auth/register` | 3/min | IP |
| `POST /v1/ai/chat` | 10/min | User ID |
| `POST /v1/transactions/import-csv` | 3/min | User ID |

---

## Phased Rollout

| Phase | Focus | Status |
|-------|-------|--------|
| 1 | Foundation — Docker, FastAPI, models, auth, Expo scaffold | **Done** |
| 2 | Plaid + Transactions — bank linking, sync, transaction list | **Done** |
| 3 | Budgets + Polish — CRUD, charts, search, error states | **Done** |
| 4 | Budget Overhaul — unified budget plans, multi-month, recurring | **Done** |
| 5 | AI Assistant — tools, Claude integration, chat UI, SSE, RAG tips, financial profile | **Done** |
| 6 | Monetization — subscriptions, API keys, external API, rate limits | **In Progress** (rate limiting done) |
| 7 | Financial Health Score — deterministic 0-100 score, demographic benchmarks, AI insights | **Done** |
| 8 | Iteration — dark mode, data import/export, social auth | **In Progress** |
| 9 | Staging & Native Build — staging env, dev client, ATS config | **Done** |

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

## Completed (Phase 3)

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
- [x] Carousel snap alignment fix using `snapToOffsets` with `disableIntervalMomentum`
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
- [x] Accounts widget card with dark teal-green background, white text, decorative icon overlay, and shadow
- [x] Account names truncate with ellipsis (75% width) to prevent overlap with balance
- [x] Account-filtered transactions (tap account → dedicated account transactions screen)
- [x] Multi-select filters (multiple types + categories simultaneously)
- [x] Account name displayed in transaction rows
- [x] Net worth chart renders when user has assets but no bank accounts
- [x] Overall budget pill uses surface color for better visual consistency
- [x] Budget progress bar track near-white for contrast against surface background
- [x] Centralized `progressBarStyles` in theme.ts — shared across dashboard, budgets, spending, income screens
- [x] Extracted `TransactionRow` component from transactions tab into reusable `src/components/TransactionRow.tsx`
- [x] Dashboard budget pill expands on chevron tap to show per-category budget breakdowns with individual progress bars
- [x] Spending & income summary screens show current month's transactions (tappable to detail screen)
- [x] Budget store loads non-blocking (transaction sync fires in background, silent reload when data exists)
- [x] Budget category drill-down screen (tap budget category → see filtered transactions with budget progress)
- [x] Account drill-down screen (tap account → see balance and transactions for that account)
- [x] "See all" transactions link in dashboard accounts widget
- [x] Shared `TransactionListCard` component — used across spending, income, budget-transactions, account-transactions, and transactions screens
- [x] Transactions screen restyled with always-visible filter card (search + type/category chips) and card-based transaction list
- [x] Dashboard budget categories show "$X left of $Y" with tappable rows and list icon buttons
- [x] `formatCurrency` drops `.00` decimals for whole numbers
- [x] Category color picker — tap icon circle on budget card to choose from 16 preset colors via bottom-sheet modal
- [x] `PATCH /v1/categories/{id}` endpoint for updating category colors with hex validation
- [x] `category_color` field propagated through budget, dashboard spending/income, and budget summary API responses
- [x] Category colors reflected across all screens: budget progress bars, dashboard pie charts, budget pill breakdown, spending/income category bars and dots
- [x] Color utility functions: `withOpacity` (hex alpha append) and `contrastForeground` (luminance-based icon color)
- [x] React performance: `useMemo` for derived state, `useCallback` for handlers, `Promise.all` for parallel fetches, hoisted constants
- [x] Tappable monthly trend bars on spending/income screens — tap a bar to view that month's category breakdown and transactions
- [x] Carousel snap fix — `snapToOffsets` + `snapToEnd` replacing broken `snapToInterval`, removed last-card padding

---

## Remaining Work

## TODO:

### Notes:
- Cached balances on dashboard have TTL of 15 minutes, might be better to switch to manual refresh syncing if API calls are not too expensive.

### General
- [ ] Mobile: Add "Report a Bug or Leave Feedback" section with link to GitHub Issues
- [x] API: Add logging everywhere (LoggingMiddleware with request timing, sanitized headers)
- [ ] Ask Claude about password hashing vulnerabilities
- [ ] MFA phone authentication

### Known Bugs
- [ ] 'Link session ended' error under 'Add Another Account' when plaid linking is cancelled
- [ ] Budgets get a hanging loading icon if the back tab is pressed while making a budget
- [ ] Positive values that are categorized do not update the progress bar on the budget (design choice?)
- [x] Handle budgets of the same category (aggregated by category_id on budgets tab)
- [x] Net Worth number does not reflect real-time changes made to transactions, add focus refresh to dashboard tab
- [ ] Fix the way net worth is plotted on the chart. Maybe just plot each individual day regardless of calculation time and zustand store the data.
- [ ] Income summary not refreshing when transactions are categorized. Will need to update based on refresh.
- [x] When budget allocations are edited. Have to save form twice in order to process.
- [x] Chevron becomes muted color when expands and collapses.
- [x] Cascade animation plays on tab focus instead of only on budget expand
- [x] Over-budget amount has extra left margin on budgets tab
- [x] "View details" not anchored to bottom-left of dashboard summary cards

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
- [x] Mobile: Overall budget - down chevron that has cascading dropdown that gives an breakdown of progress toward each budget
- [ ] Add more transaction filters


### Phase 4 — Budget Overhaul

Redesign the budgeting system from individual per-category budgets to unified budget plans with multi-month and recurring support.

#### Backend Changes
- [x] New `budget_plans` table with `budget_plan_allocations` — Alembic migration `e6f7a8b9c0d1`
- [x] `budgets` table updated with nullable `budget_plan_id` FK (SET NULL on delete)
- [x] `POST /v1/budget-plans` — create plan with allocations + month list or recurring flag, generates budget rows
- [x] `GET /v1/budget-plans` — list plans with allocations (joinedload)
- [x] `PUT /v1/budget-plans/{id}` — update name, total, allocations, toggle recurrence
- [x] `DELETE /v1/budget-plans/{id}?delete_budgets=` — delete plan, optionally delete generated budgets
- [x] `POST /v1/budget-plans/generate-recurring` — idempotent recurring budget generation
- [x] Budget plan service with full CRUD + recurring generation logic

#### Mobile Changes
- [x] Multi-step budget creation wizard (`budget/create.tsx`) — Set Total → Allocate → Duration → Review
- [x] `MonthPicker` component — grid of 12 upcoming months with "Until I turn off" recurring toggle
- [x] `CategoryAllocation` component — category list with inline amount inputs, running total tracker
- [x] Budget plan detail screen (`budget/plan/[id].tsx`) — inline editing for name, total amount, and allocation amounts
- [x] Budget plan detail: recurrence toggle, allocation list with category icons, delete with 3-option alert
- [x] Budgets tab: aggregated budgets by category (merges multiple plans), stable sort order on edits
- [x] Budgets tab: expandable plan cards with chevron toggle, allocation rows with inline amount editing
- [x] Budgets tab: swipe-to-delete on plan cards with animated gesture (PanResponder + Animated)
- [x] Budgets tab: category cards navigate to budget-transactions on tap, hamburger icon for list view
- [x] Multi-colored overall budget progress bar — segments per category proportional to spending
- [x] Dashboard: multi-colored budget progress bar matching budgets tab
- [x] Zustand `budgetPlans` store with load/refresh/removePlan
- [x] Fixed duplicate React key errors across dashboard, spending, and income screens
- [x] Shared `getCategoryIcon()` utility extracted to `src/utils/categoryIcons.ts` (30+ category → icon mappings)
- [x] Budget-transactions screen refactored: dynamic title, category icon with colored circle, tappable color picker
- [x] Category navigation from spending & income summary screens (tap category → budget-transactions)
- [x] Dashboard budget deduplication by `category_id` with plan-total-based budget amounts
- [x] Cascade animation fix: `PlanCard` extracted as `React.memo` to prevent all cards re-animating on expand
- [x] Cascade dropdown allocations sorted descending by amount, inline editing removed (read-only display)
- [x] Long-press quick-edit modal removed — plan editing consolidated to plan detail screen
- [x] Budget plan detail: edit mode for add/remove allocations with category picker modal
- [x] Color propagation fix: store refreshes (`budgets`, `plans`, `dashboard`) after color PATCH across all screens
- [x] Backend: budget row regeneration on plan allocation updates (deletes old + creates new for current month)
- [x] Backend: `category_id` added to spending/income dashboard schemas for category filtering
- [x] Fixed allocation save race condition — stores + fresh GET all resolve before UI updates
- [x] Dashboard UX: "View details" anchored to bottom-left of income/spending summary cards
- [x] Dashboard UX: fixed over-budget amount extra left margin (split `errorText` into `overText` for budget amounts)
- [x] Cascade animation only plays on budget expand (not tab focus) — `PlansSection` memo component with `useRef`-derived animation state
- [x] Expanded budget state persists across tab navigations — module-level `persistedExpandedIds` Set
- [x] Budgets tab: extracted `PlansSection`, `PlanCard`, `BudgetCategoryRow` as top-level `memo` components
- [x] Budgets tab: O(1) `Map` lookup for category sort order (replaced `indexOf`)
- [x] Budgets tab: stabilized `renderItem`, `keyExtractor`, `refreshControl` as `useCallback`/`useMemo`
- [x] React best practices refactor — extracted inline FlatList `renderItem` functions across 3 files:
  - `CategoryAllocation.tsx`: `CategoryRow` + `Separator` extracted, `useCallback` wrappers, `memo` export
  - `transaction/[id].tsx`: `CategoryChip` extracted as `memo` component
  - `budget/plan/[id].tsx`: `CategoryPickerRow` extracted as `memo` component, `useCallback` for `addCategory`
- [x] React best practices refactor — hoisted constants & memoized computations:
  - `NetWorthChart.tsx`: `MONTH_ABBR` hoisted to module level, x-axis labels wrapped in `useMemo`, `memo` export
  - `PieChart.tsx`: `wedgePath` extracted to module-level pure function, segment geometry consolidated into single `useMemo`, `memo` export
  - `MonthPicker.tsx`: wrapped export in `memo`
- [x] React best practices refactor — added `React.memo` to 4 reusable display components: `TransactionRow`, `TransactionListCard`, `LineChart`, `ColorPickerModal`
- [x] Verified `useEffect` dependencies in `transaction/create.tsx` and `NetWorthChart.tsx` — all correct, no changes needed

### Phase 5 — AI Assistant
- [x] AI data access layer (`ai/data_access.py`) — 8 parameterized query handlers scoped by user_id
- [x] AI tool definitions (`ai/tools.py`) — 8 tools in Anthropic tool-use schema + handler registry
- [x] AI system prompts (`ai/prompts.py`) — persona, formatting rules, `{current_date}` placeholder
- [x] AI service orchestrator (`ai/service.py`) — tool loop (max 3 rounds), SSE streaming, auto-title generation
- [x] SSE streaming endpoint: `POST /v1/ai/chat` with `StreamingResponse` (text/event-stream)
- [x] Conversation CRUD endpoints: `GET /v1/ai/conversations`, `GET /v1/ai/conversations/{id}`, `DELETE /v1/ai/conversations/{id}`
- [x] AI schemas (`schemas/ai_chat.py`) — ChatRequest, ConversationOut, MessageOut, response wrappers
- [x] Conversation persistence (messages saved to chat_conversations/chat_messages)
- [x] Usage tracking (request_count + token_count per billing period in api_usage)
- [x] Mobile: SSE streaming client (`api/streaming.ts`) using XHR onprogress (fetch ReadableStream unsupported in RN)
- [x] Mobile: Zustand AI chat store (`stores/aiChat.ts`) with optimistic message append, streaming state, abort handle
- [x] Mobile: Full chat UI with message bubbles, markdown rendering (`react-native-marked`), keyboard avoidance
- [x] Mobile: Conversation history modal with load/delete
- [x] Mobile: Empty state with suggested prompt chips
- [x] Mobile: Tool call indicator with pulse animation
- [x] Mobile: React best practices audit — hoisted non-primitive props, ref-based transient values, explicit ternaries, stable FlatList callbacks

## Completed (Phase 5)

### Backend
- [x] AI data access layer (`ai/data_access.py`) — 8 async tool handlers with parameterized queries scoped by user_id
- [x] AI tool definitions (`ai/tools.py`) — 8 tools in Anthropic tool-use schema format + handler registry
- [x] System prompt (`ai/prompts.py`) — concise financial assistant persona, dollar formatting, no fabrication, `{current_date}` placeholder
- [x] Service orchestrator (`ai/service.py`) — tool loop (max 3 rounds), SSE streaming, auto-title generation, 20-message sliding window
- [x] Schemas (`schemas/ai_chat.py`) — ChatRequest, ConversationOut, MessageOut, response wrappers
- [x] Router (`routers/ai_chat.py`) — `POST /v1/ai/chat` (SSE), `GET /v1/ai/conversations`, `GET /v1/ai/conversations/{id}`, `DELETE /v1/ai/conversations/{id}`
- [x] Conversation persistence (chat_conversations + chat_messages tables)
- [x] Usage tracking (request_count + token_count per billing period in api_usage)
- [x] Config: `anthropic_api_key`, `anthropic_model` (Haiku for cost-effective dev)
- [x] Dependency: `anthropic>=0.40.0`
- [x] Financial profile builder (`ai/profile.py`) — compact financial snapshot cached in Redis (300s TTL)
- [x] RAG module (`ai/rag.py`) — pgvector semantic search for financial tips (all-MiniLM-L6-v2, 384-dim)
- [x] Financial tips seeding (`ai/rag_seed.py` + `ai/tips_data.json`) — curated tips with embeddings
- [x] `FinancialTip` model with pgvector `Vector(384)` column
- [x] 9th tool: `search_financial_tips` — semantic search over curated financial education content
- [x] System prompt enhanced with `{financial_profile}` placeholder for context-aware responses
- [x] Request logging middleware — method, path, status, duration (ms), sanitized headers at DEBUG level
- [x] Docker: PostgreSQL image upgraded to `pgvector/pgvector:pg16` for vector extension support

### Mobile
- [x] SSE streaming client (`api/streaming.ts`) — XHR `onprogress` (fetch ReadableStream unsupported in RN), typed callbacks, abort handle
- [x] Zustand AI chat store (`stores/aiChat.ts`) — optimistic message append, streaming state, conversation CRUD, abort handle
- [x] Full chat UI (`ai-chat.tsx`) — message bubbles, markdown rendering, keyboard avoidance, auto-scroll
- [x] Markdown rendering with `react-native-marked` — custom theme matching app palette, transparent background fix
- [x] Conversation history modal with load/delete
- [x] Empty state with 4 suggested prompt chips
- [x] Tool call indicator with pulse animation and contextual labels per tool
- [x] React best practices: hoisted non-primitive props, ref-based transient values, explicit ternaries, stable FlatList callbacks
- [x] Dependency: `react-native-marked`
- [x] Mock AI responses in `streaming.ts` for frontend development without backend (`USE_MOCK` toggle)

### CSV Transaction Import
- [x] Backend: CSV import service (`services/csv_import.py`) — auto-detect columns, flexible date parsing, debit/credit handling, duplicate detection, bulk insert
- [x] Backend: `POST /v1/transactions/import-csv` endpoint (multipart form-data: file + account_id)
- [x] Backend: Response schema with imported/skipped/failed counts + per-row error details
- [x] Backend: Security hardening — name truncation (255 chars), error message sanitization, 5MB/5K row limits
- [x] Backend: Test suite (`tests/test_csv_import.py`) — 29 tests covering parsing, validation, edge cases, API integration
- [x] Backend: Test fixtures — standard CSV and debit/credit format samples
- [x] Mobile: `expo-document-picker` integration for native file selection
- [x] Mobile: `apiUpload()` function in API client for multipart form data with auth
- [x] Mobile: Import screen (`import-csv.tsx`) — account picker, file picker, loading state, results view with expandable errors
- [x] Mobile: "Import Transactions" option added to dashboard plus-button dropdown
- [x] Mobile: Post-import refresh of transactions + dashboard stores

### Phase 6 — Monetization + External API
- [ ] Subscription tier enforcement (free vs. pro feature gating)
- [ ] API key generation endpoint (`POST /v1/settings/api-key`)
- [ ] External AI endpoint: `POST /api/v1/financial-ai/chat` (API key auth, context in payload)
- [ ] Rate limiting per tier (Redis-backed, `ai/usage.py`)
- [ ] Usage dashboard endpoint (`GET /v1/usage`)
- [ ] Mobile: Subscription/upgrade screen
- [ ] Mobile: API key management in settings
- [ ] API documentation for external consumers


### Phase 9 — Staging & Native Build
- [x] Staging environment configured on AWS (ELB + backend services)
- [x] `EXPO_PUBLIC_API_URL` environment variable for pointing mobile app to staging server
- [x] `mobile/.env` file with staging ELB endpoint
- [x] Migrated from Expo Go to Expo development build (`npx expo prebuild` + `npx expo run:ios`)
- [x] iOS App Transport Security exception for staging ELB domain (`us-east-1.elb.amazonaws.com` allows HTTP)
- [x] Plaid Link native module now functional (requires dev client, silently no-ops in Expo Go)
- [x] Physical device deployment via `npx expo run:ios --device`

### Phase 7 — Iteration
- [ ] AI System: Allow asset optimization/Balance Transfers
- [ ] AI System: Debt Restructuring/Credit Optimization
- [ ] API: Rate limiting on API calls
- [ ] Mobile: Support for dark mode
- [ ] Mobile: Update Transaction Categories to mimic Mint Category Schema
- [x] Mobile: Data imports (CSV import with auto-column detection)
- [ ] Mobile: Data exports
- [ ] Mobile: Sign in Google/Apple
- [ ] Mobile: Update Settings screen to support account changes
- [ ] Mobile: Remove FAB for adding transactions
- [ ] AI: Bill negotiation, Credit optimization
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

# Run iOS dev client pointing to staging
cd mobile
echo 'EXPO_PUBLIC_API_URL=http://pebble-staging-710423421.us-east-1.elb.amazonaws.com' > .env
npx expo prebuild
npx expo run:ios

# Install on physical iPhone (connect via USB)
npx expo run:ios --device
```

---

## Infrastructure Targets

| Service | Local | Staging | Production |
|---------|-------|---------|-----------|
| PostgreSQL | Docker (port 5432) | AWS RDS | Neon |
| Redis | Docker (port 6379) | AWS ElastiCache | Upstash |
| Backend | Docker (port 8000) | AWS ELB (`pebble-staging-*.us-east-1.elb.amazonaws.com`) | Railway or Render |
| Mobile (web) | Docker (port 8081) | — | Static deploy |
| Mobile (iOS) | `npx expo run:ios` | Dev client → staging ELB | EAS Build + TestFlight |
