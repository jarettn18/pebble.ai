# Changelog

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
