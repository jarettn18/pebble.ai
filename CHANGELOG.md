# Changelog

## 2026-03-22 — Drill-Down Screens, Shared Components & Transactions Restyle

### Backend — Dashboard Budget Summary
- Added `category_id` field to `BudgetSummary` schema (`schemas/dashboard.py`) so the frontend can filter transactions by budget category
- Updated dashboard service (`services/dashboard.py`) to include `category_id` in the budget summaries response

### Mobile — Budget Transactions Screen
- Created `app/budget-transactions.tsx` — dedicated screen for viewing transactions within a budget category
- Shows budget summary card with category name, spent amount, progress bar (spent vs budgeted), and remaining/over amount
- Fetches transactions filtered by `category_id` and current month date range
- Tapping a transaction navigates to the transaction detail screen
- Registered route in `_layout.tsx` with "Budget Transactions" header

### Mobile — Account Transactions Screen
- Created `app/account-transactions.tsx` — dedicated screen for viewing transactions within a specific account
- Shows account summary card with institution name, account name, and current balance (debt accounts shown in red)
- Fetches transactions filtered by `account_id`
- Dashboard account taps now navigate to this dedicated screen instead of the transactions tab with a filter

### Mobile — Dashboard Budget Categories
- Budget category rows in the expanded breakdown are now tappable, navigating to the budget transactions screen
- Added list icon button on each category row for quick access to filtered transactions
- Replaced "X% of $Y" display with "$X left of $Y" (or "$X over of $Y" in red) using `Math.floor` to drop cents
- Budget expand/collapse chevron now uses sage green (`colors.primary`) instead of muted gray
- Reduced `progressBarStyles.value` font size from 22 to 16

### Mobile — Budgets Tab
- Added list icon button on each budget row that navigates to the budget transactions screen (tap-to-edit preserved)
- Replaced percentage display with "$X left of $Y" format matching the dashboard

### Mobile — Shared TransactionListCard Component
- Extracted `TransactionListCard` from duplicated code across 4 screens into `src/components/TransactionListCard.tsx`
- Handles card wrapper, "Transactions (N)" title, row mapping with separators, tap-to-detail navigation, and empty state
- Refactored `spending.tsx`, `income.tsx`, `budget-transactions.tsx`, and `account-transactions.tsx` to use the shared component
- Removed duplicated card, empty state styles and unused imports from all 4 screens

### Mobile — Dashboard "See All" Link
- Added "See all" link inline with "My Accounts" header in the accounts widget card
- Navigates to the Transactions tab for full transaction browsing

### Mobile — Transactions Screen Restyle
- Replaced hidden filter toggle with always-visible filter card containing search, type chips, and category chips
- Transaction list now renders inside `TransactionListCard` (card with border/shadow) instead of a plain FlatList
- Wrapped everything in a ScrollView with pull-to-refresh support
- Removed filter toggle button, active filters summary bar, and `showFilters` state
- FAB (+) button for creating transactions preserved
- Uses `fonts.medium`/`fonts.semiBold` from theme instead of inline `fontWeight`

### Mobile — formatCurrency Enhancement
- Updated `formatCurrency` in `utils/dashboard.ts` to drop `.00` decimals when the value is a whole number (e.g., "$500" instead of "$500.00")

---

## 2026-03-22 — Component Refactors, Budget Breakdown & Transaction Lists

### Mobile — Shared TransactionRow Component
- Extracted `TransactionRow`, `TransactionSeparator`, and `Transaction` type from `transactions.tsx` into reusable `src/components/TransactionRow.tsx`
- Transaction list on transactions tab now imports from shared component

### Mobile — Centralized Progress Bar Styles
- Created `progressBarStyles` in `theme.ts` — shared container, header, label, value, track, and fill styles used across all budget/progress bar UIs
- Added `colors.progressBar` (`#45655a`) as default progress bar fill color
- Replaced duplicated progress bar styles in `budgets.tsx` (summary pill + individual budget cards) and `index.tsx` (dashboard budget pill)
- Replaced duplicated horizontal bar track/fill styles in `income.tsx` and `spending.tsx` with shared `progressBarStyles.track` / `progressBarStyles.fill`

### Mobile — Dashboard Budget Expandable Breakdown
- Added chevron toggle below the overall budget pill on the dashboard
- Tapping chevron expands to show per-category budget breakdowns, each with its own progress bar, percentage, and remaining amount
- Collapsing animates smoothly via `LayoutAnimation.easeInEaseOut`

### Mobile — Transaction Lists on Spending & Income Screens
- `spending.tsx` and `income.tsx` now fetch current month's transactions (filtered by expense/income type) and display them below category breakdowns
- Transaction rows are tappable, navigating to the transaction detail screen
- Uses shared `TransactionRow` component

### Mobile — Budget Store: Non-Blocking Sync
- Budget loading no longer blocks on transaction sync — fires `load()` in background with `.catch(() => {})`
- Silent reload (no loading spinner) when budgets already exist in state, preventing UI flash on revisit

---

## 2026-03-22 — Dashboard Accounts Widget & Styling Polish

### Dashboard — Accounts Widget
- Replaced individual account row cards with a unified "My Accounts" widget card
- Widget styled with dark teal-green background (`#2d5a56`), white text, and `shadow-xl` depth
- Decorative wallet icon overlay at 20% opacity in top-right corner
- Account rows separated by subtle `rgba(255,255,255,0.1)` dividers
- Account names truncate with ellipsis at 75% row width to prevent overlap with balance
- Debt balances (credit/loan) displayed in teal (`#adeef0`) for distinction
- Balances aligned to bottom of account name row via `alignItems: flex-end`
- Removed old `AccountRow` component and unused account icon/color constants

### Dashboard — Budget Pill
- Overall budget pill background changed from translucent primary-fixed to `colors.surface` for visual consistency
- Budget progress bar track changed to near-white (`rgba(255,255,255,0.95)`) for better contrast against surface

### Dashboard — Carousel Fix
- Replaced `snapToInterval` with explicit `snapToOffsets` and `disableIntervalMomentum` to fix carousel cards getting stuck between positions

---

## 2026-03-21 — UI Overhaul: Charts, Design System & Dashboard UX

### Theme & Design System
- Updated `spendingPalette` and `incomePalette` from monochrome green gradients to 8 distinct category colors: Sage, Soft Coral, Ochre, Dusty Lavender, Terracotta, Teal, Forest Green, Ocean Blue
- Added `categoryPalette` as canonical 8-color source in theme.ts
- Updated primary text color to forest green (`#1b3d2f`)
- Darkened secondary text color to `#2a3230`
- Surface color changed to `#f5efef` for card contrast against white background

### PieChart — Donut Redesign
- Rewrote PieChart from filled pie wedges to donut chart using SVG `<Circle>` strokes (18px stroke width)
- Added curved divider lines at segment boundaries with subtle bezier curves
- Added interactive tap-to-select: tapping a donut segment shows category name and formatted amount in center bubble
- Press-and-hold on donut segments shows bubble only while pressing
- Tapping legend dots toggles between percentage and dollar amount display, with center bubble
- Reduced default donut size from 140 to 110 to fix scaling issues

### LineChart — Smooth Curves & Gradient
- Replaced straight line segments with smooth cubic bezier curves
- Increased stroke width from 2px to 3px
- Enhanced gradient fill (25% opacity fade to background color)
- Added Inter font family to axis labels

### NetWorthChart
- Added Plus Jakarta Sans font families to change text and period tab labels

### Spending & Income Screens
- Added font families throughout (card titles, bar values/labels, category names/amounts, empty state)
- Vertical bars now have rounded tops only (flat bottom)
- Both screens use the new 8-color category palette

### Dashboard — Add Button & Dropdown
- Replaced bottom "Add Another Account" and "Add Property or Vehicle" buttons with a `+` button in the header next to "Dashboard"
- `+` button styled as a circle with a subtle border (textPrimary at 15% opacity)
- Dropdown menu appears on tap with "Add Account" and "Add Property or Vehicle" options, anchored to top right
- Dropdown takes up ~1/3 of screen width with transparent overlay for dismissal
- Removed "Spending by Category" card (now redundant with pie chart legend)

### Dashboard — Carousel Fix
- Swapped income and spending cards (income first)
- Fixed second carousel card misalignment by replacing `pagingEnabled` with `snapToInterval` accounting for card margin
- Income card text color changed to secondary text

### Dashboard — Budget Pill
- Updated Overall Budget pill text colors to use `textPrimary` instead of `onPrimaryFixedVariant`
- Net worth label changed to "YOUR NETWORTH"

---

## 2026-03-21 — Phase 3: Assets, Account Filtering & Multi-Select Filters

### Backend — Asset CRUD
- Created `Asset` SQLAlchemy model (`models/asset.py`) with `AssetType` enum: primary_residence, rental, investment_property, vacation, land, car, motorcycle, boat, other
- Fields: UUID PK, user FK, name, asset_type, estimated_value (Numeric 14,2), address (nullable), notes (nullable)
- Created asset schemas (`schemas/asset.py`): `AssetOut`, `AssetCreateRequest`, `AssetUpdateRequest`, `AssetListResponse`
- Created asset service (`services/assets.py`): full CRUD with `get_assets`, `get_asset`, `create_asset`, `update_asset`, `delete_asset`
- Created asset router (`routers/assets.py`): `GET /v1/assets`, `GET /v1/assets/{id}`, `POST /v1/assets` (201), `PUT /v1/assets/{id}`, `DELETE /v1/assets/{id}` (204)
- Alembic migration creates `assets` table with `assettype` PostgreSQL enum
- Registered Asset model in `models/__init__.py`, added `assets` relationship to User model

### Backend — Net Worth Integration
- Dashboard endpoint (`get_dashboard`) sums asset estimated values into net worth and returns `assets` list
- Net worth history endpoint (`get_net_worth_history`) includes asset values in current net worth calculation
- Added `AssetSummary` schema to `schemas/dashboard.py`, added `assets` field to `DashboardResponse`

### Backend — Transaction Filtering Enhancements
- Added `account_id` query parameter to `GET /v1/transactions` — filters by specific bank account
- Changed `category_id` to support comma-separated values for multi-category filtering (uses `in_()`)
- Added `joinedload(Transaction.account)` for eager-loading account data
- Added `account_name` field to `TransactionOut` schema

### Mobile — Asset Screens
- Created `app/add-asset.tsx` — form with asset type chip picker, name, estimated value, conditional address field (property types only), notes
- Created `app/asset/[id].tsx` — asset detail/edit screen with editable fields, "Save Changes" button (appears on change), "Delete Asset" with confirmation alert
- Registered both screens in `app/_layout.tsx`

### Mobile — Dashboard Assets
- Added Assets card to dashboard showing asset rows with type label, name, and estimated value
- Asset rows are tappable, navigating to detail/edit screen
- Added "+ Add Property or Vehicle" button below "Connect Bank Account"
- Net worth chart now renders when user has assets but no bank accounts (`hasAccounts` checks both)
- Created `assets` Zustand store (`stores/assets.ts`) with load, create, update, remove methods
- Dashboard store updated with `AssetSummary` type and `assets` array

### Mobile — Account-Filtered Transactions
- Dashboard account rows are tappable — navigates to transactions tab filtered by that account
- Transaction screen reads `account_id` and `account_name` from route params and applies filter on mount
- Account name displayed in each transaction row

### Mobile — Multi-Select Filters
- Transaction type filter changed from single-toggle to multi-select (both expense + income can be selected)
- Category filter changed from single-select to multi-select (multiple categories simultaneously)
- Filter summary updates to show count when multiple selections active
- Clearing filters also clears route params (account filter)

---

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
