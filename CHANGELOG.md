# Changelog

## 2026-03-20 — Phase 3: Income Summary & Dashboard Polish

### Backend — Income Data
- Added `monthly_income`, `income_by_category`, and `income_over_time` fields to dashboard endpoint
- Income calculated as sum of absolute values of negative (income) transactions
- Income by category sorted by amount descending, income over time covers last 6 months
- Added `IncomeByCategory` schema to `schemas/dashboard.py`

### Mobile — Income Summary
- Added income card to dashboard with green color scheme and pie chart breakdown
- Created `app/income.tsx` — income detail screen with monthly total, 6-month bar chart trend, and category breakdown (stacked bar + horizontal bars)
- Added `Stack.Screen` entry for income page with "Income Summary" header and back button
- Dashboard store updated with `monthlyIncome`, `incomeByCategory`, `incomeOverTime` fields

### Mobile — Dashboard Carousel
- Spending and income cards displayed in a horizontal paging carousel with dot indicators
- Swipe between spending and income summaries; tap to navigate to detail pages

### Mobile — Dashboard UX Fix
- Added `silent` parameter to dashboard store `load()` to prevent `RefreshControl` from triggering on focus reload
- Dashboard no longer snaps scroll to top when navigating back from detail pages

---

## 2026-03-20 — Phase 3: Dashboard, Budgets & Spending Charts

### Backend — Dashboard
- Created dashboard service (`services/dashboard.py`) with aggregated `GET /v1/dashboard?month=&year=` endpoint returning:
  - Net worth (computed from account balances, debt types subtracted)
  - Monthly spending total
  - Spending by category (ranked by amount)
  - Budget summaries with spent vs. budgeted per category
  - Spending over time (last 6 months)
- Added `GET /v1/dashboard/net-worth-history?period=1M|3M|1Y|5Y` endpoint
  - Computes historical net worth by working backwards from current balances using daily transaction sums
  - Downsamples for longer periods (weekly for 5Y, every 3 days for 1Y)
  - Returns change amount and percentage vs. period start
- Created dashboard schemas (`schemas/dashboard.py`): `DashboardResponse`, `NetWorthHistoryResponse`, `AccountSummary`, `BudgetSummary`, `SpendingByCategory`, `MonthlySpendingPoint`, `NetWorthPoint`

### Backend — Budget CRUD
- Created budget service (`services/budgets.py`) with full CRUD: `get_budgets`, `get_budget`, `create_budget`, `update_budget`, `delete_budget`
- Server-side spending calculation via `_get_spending_by_category()` — sums non-pending debit transactions per category per month
- Created budget router (`routers/budgets.py`): `GET /v1/budgets?month=&year=`, `GET /v1/budgets/{id}`, `POST /v1/budgets` (201), `PUT /v1/budgets/{id}`, `DELETE /v1/budgets/{id}` (204)
- Created budget schemas (`schemas/budget.py`): `BudgetOut` (with `spent` field), `BudgetCreateRequest`, `BudgetUpdateRequest`, `BudgetListResponse`

### Mobile — Dashboard Overhaul
- Replaced client-side dashboard computation with server-side `GET /v1/dashboard` endpoint
- Created dashboard Zustand store (`stores/dashboard.ts`) for aggregated data
- Added `NetWorthChart` component — SVG line chart with gradient fill, period filter tabs (1M, 3M, 1Y, 5Y), gain/loss indicator with percentage (green/red)
- Added `PieChart` component — SVG pie chart with color-coded legend showing category percentages
- Added `LineChart` component — reusable SVG line chart using `react-native-svg`
- Dashboard now shows: net worth with historical chart, monthly spending with pie chart breakdown, spending by category, budget overview with mini progress bars, accounts list
- Added pull-to-refresh and `useFocusEffect` for fresh data on tab focus

### Mobile — Spending Summary Screen
- Created `app/spending.tsx` — dedicated spending details screen with:
  - Monthly total card
  - Vertical bar chart showing 6-month spending trend (current month highlighted)
  - Stacked color bar showing proportional category spending
  - Individual horizontal bars per category with color-coded dots and amounts
- Accessible from dashboard via tappable "This Month's Spending" card

### Mobile — Budget Screens
- Created `app/budget/[id].tsx` — budget create/edit screen with amount input, horizontal category picker, period display, save (POST/PUT), and delete with confirmation
- Rebuilt `app/(tabs)/budgets.tsx` — month selector with arrow navigation, total budgeted card, budget rows with progress bars (green/red for over budget), `useFocusEffect` for live updates
- Created budgets Zustand store (`stores/budgets.ts`) with `load`, `refresh`, `upsertBudget`, `removeBudget`
- Budget store syncs transactions before loading to ensure spending data is fresh

### Dependencies
- Added `react-native-svg` for chart rendering

---

## 2026-03-19 — Phase 2: Transaction Categories, Detail & Edit

### Backend — Categories
- Added `plaid_primary` column to `Category` model for mapping Plaid's `personal_finance_category.primary` to internal categories
- Created Alembic migration (`b3f1a2c4d5e6`) that adds the column and seeds 16 default categories (Income, Food & Drink, Transportation, Shopping, etc.)
- Migration resets all Plaid cursors so next sync re-fetches transactions with category assignments
- Added categories service (`services/categories.py`) with `get_plaid_category_map()` for sync-time lookups and `get_all_categories()` for the API
- Added categories router (`routers/categories.py`): `GET /v1/categories` — returns all categories (auth required)
- Added category schemas (`schemas/category.py`): `CategoryOut`, `CategoryListResponse`

### Backend — Auto-Categorization
- Updated Plaid sync to auto-categorize transactions on add/modify using Plaid's `personal_finance_category.primary` field
- Added `_resolve_category_id()` helper in Plaid service that maps Plaid category → internal category UUID

### Backend — Transaction Detail & Edit
- Added `GET /v1/transactions/{id}` endpoint — returns full transaction detail including `category_id` and `notes`
- Added `PATCH /v1/transactions/{id}` endpoint — supports updating `category_id` and `notes` fields
- Added `TransactionDetailOut` and `TransactionUpdateRequest` schemas
- Added `get_transaction()` and `update_transaction()` service functions with ownership validation

### Mobile — Transaction Detail Screen
- Created `app/transaction/[id].tsx` — full transaction detail screen with:
  - Transaction header (merchant, amount, date, pending status)
  - Category picker: scrollable list of all categories fetched from API, with color dots and selection state
  - Clear category option to remove category assignment
  - Notes field with save button
  - Optimistic updates for category changes (instant UI, reverts on API failure)
- Added `TouchableOpacity` wrapper on transaction list rows for navigation to detail screen
- Added `updateTransactionCategory()` to transactions Zustand store for optimistic category updates in the list view

### Bug Fix
- Fixed `[object Object]` error when saving notes — removed double `JSON.stringify()` on PATCH request bodies (API client already serializes)

---

## 2026-03-18 — Phase 2: Plaid Integration & Transactions

### Backend — Plaid Service
- Added Plaid service layer (`services/plaid.py`) calling the Plaid API via httpx
  - `create_link_token` — generates a Link token for the frontend (`POST /link/token/create`)
  - `exchange_public_token` — exchanges a public token for an access token, encrypts it with Fernet, stores a `PlaidItem`, and fetches + stores linked `Account` records
  - `sync_transactions` — cursor-based transaction sync via `/transactions/sync` with add/modify/remove handling
  - `sync_all_items` — syncs all of a user's linked PlaidItems in one call
- Added Plaid router (`routers/plaid.py`) with endpoints:
  - `POST /v1/plaid/link-token` — create Link token (auth required)
  - `POST /v1/plaid/exchange` — exchange public token and store accounts (auth required)
  - `POST /v1/plaid/sync` — sync transactions for a single item (auth required)
  - `POST /v1/plaid/sync-all` — sync transactions for all linked items (auth required)
- Added Plaid schemas (`schemas/plaid.py`): `LinkTokenResponse`, `ExchangeTokenRequest`, `ExchangeTokenResponse`, `SyncRequest`, `SyncResponse`
- Added `_plaid_post` helper for authenticated Plaid API calls with error mapping to 502

### Backend — Transactions
- Added transactions service (`services/transactions.py`) with paginated listing, ordered by date desc, eager-loading category names
- Added transactions router (`routers/transactions.py`): `GET /v1/transactions?limit=50&offset=0`
- Added transaction schemas (`schemas/transaction.py`): `TransactionOut`, `TransactionListResponse`
- Registered `plaid` and `transactions` routers in `main.py`

### Backend — Tests
- Created test infrastructure: `tests/` directory, `conftest.py` with `fake_user`, `fake_db`, and `authed_client` fixtures
- 12 tests covering all Plaid endpoints:
  - `TestCreateLinkToken` — success, Plaid error → 502, auth required
  - `TestExchangePublicToken` — success with account storage, Plaid error → 502, duplicate item → 409, auth required
  - `TestSyncTransactions` — added transactions, modified transactions, removed transactions, unknown item → 404, auth required

### Mobile — Plaid Link Integration
- Added `react-native-plaid-link-sdk` dependency
- Created `usePlaidLink` hook (`src/hooks/usePlaidLink.ts`) — fetches link token, opens Plaid Link native modal, returns result via state
- Updated Dashboard (`app/(tabs)/index.tsx`) with "Connect Bank Account" button
  - Plaid Link `onSuccess` stores result in state; `useEffect` triggers the exchange API call (decoupled from native bridge callback to prevent connection timeouts)
  - Shows success alert with institution name and account count after exchange

### Mobile — Transaction List
- Created transactions Zustand store (`src/stores/transactions.ts`) with 24-hour cache
  - `load()` — serves from cache if fresh, syncs with Plaid if stale or empty
  - `syncAndRefresh()` — forces a Plaid sync then refreshes the list
- Rebuilt Transactions screen (`app/(tabs)/transactions.tsx`):
  - Loads from cache on tab tap, syncs with Plaid only when needed
  - Pull-to-refresh always forces a full sync
  - Displays merchant name, date, category, pending status
  - Debits shown in dark, credits in green

---

## 2026-03-18

### Infrastructure
- Containerized backend and mobile app in Docker (added `backend/Dockerfile`, `mobile/Dockerfile`)
- Updated `docker-compose.yml` with `backend` and `mobile` services alongside Postgres and Redis
- Backend hot-reloads via volume-mounted source + uvicorn `--reload`
- Mobile hot-reloads via volume-mounted source + Expo HMR
- Updated `project.md` running instructions to reflect Docker workflow

### Backend
- Added CORS middleware to `main.py` allowing requests from `http://localhost:8081`
- Added password validation on `RegisterRequest` schema: min 8 chars, requires uppercase, lowercase, and digit
- Implemented refresh token rotation with Redis blacklist (`redis.py`)
  - Each refresh token gets a unique `jti` claim
  - Used tokens are blacklisted in Redis with auto-expiring TTL
  - Replayed tokens return 401

### Mobile
- Added `react-native-web`, `react-dom`, `@expo/metro-runtime` dependencies for Expo web support
- Updated `react-native-web` to `^0.21.0` and `@expo/metro-runtime` to `~55.0.6` for Expo compatibility
- Replaced `Alert.alert()` with inline error state on login and register screens (Alert is a no-op on web)
- Fixed `KeyboardAvoidingView` aria-hidden warning by using `behavior={undefined}` on non-iOS platforms
- Switched web token storage from `localStorage` to `sessionStorage` to reduce XSS token theft window
- Added web fallback for `expo-secure-store` (uses `sessionStorage` on web, SecureStore on native)
