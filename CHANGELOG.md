# Changelog

## 2026-03-31 — CSV Transaction Import + AI Enhancements

### CSV Transaction Import (Full Stack)

Complete CSV import pipeline allowing users to upload bank transaction exports.

#### Backend — CSV Import Service (`services/csv_import.py`)
- `parse_csv()` — auto-detects delimiter (comma/semicolon/tab) via `csv.Sniffer`, decodes UTF-8/latin-1, strips BOM
- Column auto-detection via case-insensitive header matching:
  - Date: `date`, `transaction date`, `posting date`, `posted date`, `settlement date`
  - Name: `description`, `name`, `memo`, `payee`, `narrative`, `details`
  - Amount: `amount`, `transaction amount`, `value`
  - Debit/Credit split: `debit`/`credit`, `withdrawals`/`deposits`, `money out`/`money in`
  - Category: `category`, `type`, `transaction type`
- Flexible date parsing (5 formats: ISO, US, short-year US, UK, ISO-slash)
- Amount parsing handles `$`, commas, and parentheses-as-negative `(50.00)`
- Debit/credit column merging: debit = positive, credit = negative (Plaid convention)
- `import_transactions()` — bulk insert with duplicate detection (user_id + account_id + date + name + amount), category resolution via case-insensitive name match
- Security: name truncation to 255 chars, error message sanitization (50 char limit), 5MB file cap, 5,000 row cap

#### Backend — CSV Import Router (`routers/csv_import.py`)
- `POST /v1/transactions/import-csv` — multipart form-data (file + account_id)
- File validation: `.csv` extension required, 5MB max, non-empty
- Account ownership validation before import
- Returns `CSVImportResponse(imported, skipped, failed, errors[])`

#### Backend — CSV Import Schemas (`schemas/csv_import.py`)
- `CSVImportResponse(imported: int, skipped: int, failed: int, errors: list[CSVImportError])`
- `CSVImportError(row: int, reason: str)`

#### Backend — Test Suite (`tests/test_csv_import.py`)
- 29 tests across 3 layers:
  - Unit: `_detect_columns` (4 tests), `_parse_date` (4 tests), `_parse_amount` (5 tests)
  - Unit: `parse_csv` (9 tests) — standard CSV, debit/credit, empty file, missing columns, BOM, semicolons, blank rows
  - Integration: API endpoint (7 tests) — successful import, non-CSV rejection, empty file, invalid account, duplicates, bad rows, auth
- Test fixtures: `fixtures/sample_transactions.csv` (15 rows, standard format), `fixtures/sample_debit_credit.csv` (5 rows, bank export format)

#### Mobile — Import Screen (`app/import-csv.tsx`)
- Account picker: horizontal chip list from `useAccountsStore`
- File picker: `expo-document-picker` with CSV type filter
- Selected file display with clear button
- Import button with `ActivityIndicator` loading state
- Results view: imported/skipped/failed counts, expandable error list with row numbers
- Done button refreshes transactions + dashboard stores, then navigates back

#### Mobile — API Client (`src/api/client.ts`)
- New `apiUpload<T>(path, formData)` function for multipart form uploads
- No explicit `Content-Type` header (lets fetch set multipart boundary)
- Auth token injection + 401 refresh handling (same pattern as `apiRequest`)

#### Mobile — Dashboard Integration
- "Import Transactions" option added to plus-button dropdown (`app/(tabs)/index.tsx`)
- Icon: `file-upload-outline`, navigates to `/import-csv`
- `import-csv` screen registered in `_layout.tsx` with header

#### Mobile — Dependencies
- Added `expo-document-picker` (SDK 55 compatible)

### AI Enhancements

#### Financial Profile (`ai/profile.py`)
- Compact financial snapshot injected into every AI chat system prompt
- Includes: net worth, monthly spending/income, top 5 categories, budget status, trends, top 6 accounts, top 4 assets
- Cached in Redis with 300s TTL (key: `financial_profile:{user_id}`)

#### RAG Financial Tips (`ai/rag.py`)
- Semantic search over curated financial education tips using pgvector
- Embedding model: `all-MiniLM-L6-v2` (384-dim vectors), lazy-loaded
- Cosine distance search, returns top 3 most relevant tips
- Seeding script (`ai/rag_seed.py`) + curated tips (`ai/tips_data.json`)
- `FinancialTip` model with `Vector(384)` column

#### Tool & Prompt Updates
- 9th tool added: `search_financial_tips` — pgvector semantic search for advisory questions
- System prompt: `{financial_profile}` placeholder, instruction to use tips tool for general advice
- `data_access.py`: `search_financial_tips()` handler with disclaimer about general advice

#### Mock Streaming (`api/streaming.ts`)
- `USE_MOCK` toggle for frontend development without backend
- Mock responses for spending breakdown, budget tracking, top merchants, period comparisons, income summary
- Keyword-based mock response picker, simulated tool calls and streamed text chunks

### Infrastructure

#### Docker
- PostgreSQL image changed from `postgres:16-alpine` to `pgvector/pgvector:pg16` for vector extension support

#### Database Migrations
- `d1e2f3a4b5c6` — `financial_tips` table with pgvector extension + `Vector(384)` embedding column
- `cb597e98746b` — merge migration (budget_plans + financial_tips branches)

#### Request Logging (`main.py`)
- `LoggingMiddleware` — logs all HTTP requests with method, path, status code, duration (ms precision)
- DEBUG level: sanitized headers (authorization redacted), query params, response size
- Configurable log level via `LOG_LEVEL` env var

#### .gitignore
- Added: `llm-pricing-comparison.xlsx`, `pebble-cost-estimate.xlsx`, `system-design.mermaid`, `.~lock.*`

---

## 2026-03-28 — Phase 5: AI Financial Assistant (Full Stack)

### Backend — AI Module

Built the complete AI backend with Claude tool-use (function-calling) architecture.

#### AI Data Access Layer (`ai/data_access.py`)
- 8 async tool handler functions, all scoped by `user_id` with parameterized queries:
  - `get_spending_by_category` — category breakdown with percentages for a date range
  - `get_spending_over_time` — monthly spending totals (default 6 months, max 12)
  - `get_top_merchants` — merchants ranked by total spend + transaction count
  - `get_account_balances` — account names, types, balances + net worth (includes assets)
  - `get_budget_status` — budget vs actual per category with percentage used
  - `get_recent_transactions` — filtered transaction list (capped at 25 rows for token efficiency)
  - `get_income_summary` — income total + breakdown by category
  - `compare_spending` — side-by-side category spending between two periods with difference + percentage change
- All return plain dicts with string-formatted dollar amounts, no UUIDs, pre-computed percentages

#### AI Tool Definitions (`ai/tools.py`)
- `TOOL_DEFINITIONS` — 8 tools in Anthropic tool-use JSON schema format with typed parameters and descriptions
- `TOOL_HANDLERS` — dict mapping tool name → async handler function in data_access.py

#### AI System Prompt (`ai/prompts.py`)
- `SYSTEM_PROMPT` with `{current_date}` placeholder for temporal awareness
- Persona: concise financial assistant, uses dollar formatting, never fabricates numbers, no investment advice

#### AI Service Orchestrator (`ai/service.py`)
- `AIChatService` class with `AsyncAnthropic` client
- `stream_chat(user_id, conversation_id, message, db)` → `AsyncGenerator[str, None]`
- Tool execution loop (max 3 rounds): `client.messages.create()` with tools → execute handlers → feed tool_result back → repeat until text response
- Final response streamed via `client.messages.stream()` with chunked text deltas (20 chars)
- SSE event format: `data: {"type":"delta|tool_call|done|error",...}\n\n`
- Conversation persistence: creates/loads `ChatConversation`, saves user + assistant messages to `chat_messages`
- Auto-generates conversation title after first exchange (separate small Claude call)
- Usage tracking: increments `ApiUsage.request_count` and `token_count` per billing period
- 20-message sliding window for context management
- Error handling: tool failures returned as `tool_result` so Claude responds gracefully; API errors → SSE error event

#### AI Schemas (`schemas/ai_chat.py`)
- `ChatRequest(message: str, conversation_id: str | None)`
- `ConversationOut(id, title, created_at, last_message_preview)`
- `ConversationListResponse(conversations: list[ConversationOut])`
- `MessageOut(id, role, content, created_at)`
- `ConversationDetailResponse(id, title, messages: list[MessageOut])`

#### AI Router (`routers/ai_chat.py`)
- `POST /v1/ai/chat` — accepts `ChatRequest`, returns `StreamingResponse` (text/event-stream) with `Cache-Control: no-cache` and `X-Accel-Buffering: no`
- `GET /v1/ai/conversations` — list conversations (most recent first)
- `GET /v1/ai/conversations/{id}` — get conversation with messages
- `DELETE /v1/ai/conversations/{id}` — deletes messages + conversation
- All endpoints use `Depends(get_current_user)` for JWT auth

#### Configuration
- Added `anthropic_api_key` and `anthropic_model` to `config.py` (currently `claude-haiku-4-5-20251001` for cost-effective development)
- Added `anthropic>=0.40.0` to `pyproject.toml` dependencies
- Registered `ai_chat` router in `main.py`

### Mobile — SSE Streaming Client (`api/streaming.ts`)
- Uses `XMLHttpRequest` with `onprogress` for chunk reading — React Native's `fetch` doesn't support `ReadableStream` (`response.body` is null)
- Parses SSE `data: {...}\n\n` events, dispatches to typed callbacks: `onDelta`, `onToolCall`, `onDone`, `onError`
- Returns `{ abort: () => void }` handle for cancellation
- Reuses auth token logic from `client.ts` (SecureStore on native, sessionStorage on web)
- 2-minute timeout for tool execution + streaming

### Mobile — Zustand AI Chat Store (`stores/aiChat.ts`)
- State: `conversations`, `currentConversationId`, `messages`, `isStreaming`, `activeToolCall`, `error`, `abortHandle`
- `sendMessage(text)` — optimistic append of user + empty assistant message → `streamChat()` → update assistant content on each delta → finalize on done
- `loadConversations()` — fetches conversation list (silent fail, non-critical)
- `loadConversation(id)` — loads full conversation with messages
- `startNewConversation()` — aborts any active stream, resets state
- `deleteConversation(id)` — deletes via API, removes from local state
- `stopStreaming()` — aborts XHR, marks streaming messages as complete

### Mobile — Chat UI (`ai-chat.tsx`)
Full chat screen with streaming markdown rendering, conversation management, and React best practices.

#### Components (all top-level `memo`)
- **`MessageBubble`** — user messages as plain `<Text>` (right-aligned, primary background), assistant messages as `<Markdown>` from `react-native-marked` (left-aligned, surface background)
- **`ToolCallPill`** — pulse animation (Animated.loop) showing contextual labels per tool (e.g., "Checking budget status...", "Looking up transactions...")
- **`ConversationItem`** — history list item with title, preview, and delete button

#### Main Screen
- Inverted-style `FlatList` for messages with auto-scroll on new content
- `KeyboardAvoidingView` with iOS padding offset
- Empty state with robot icon, "Pebble AI" title, and 4 suggested prompt chips
- Text input with send button (disabled while streaming), 500 char max
- Header buttons: History (left, opens modal), New Chat (right)
- Conversation history bottom sheet modal with `FlatList`, close button

#### Markdown Rendering
- `react-native-marked` (pure JS, no Node stdlib dependencies — replaced `react-native-markdown-display` which required `punycode`)
- Custom `mdTheme` styles: text, strong, em, h1-h3, li, code, codespan, paragraph, link — all using app's font families and colors
- `flatListProps` override with `backgroundColor: "transparent"` to prevent white box (library hardcodes `#ffffff` on its internal FlatList)
- `theme.colors` override for text, code, link, border colors matching primary palette

#### React Best Practices Applied
- **Hoisted non-primitive props** (`rerender-memo-with-default-value`): `mdFlatListProps`, `mdColorTheme` extracted to module-level constants — prevents `memo` defeat on `MessageBubble`
- **Ref-based transient values** (`rerender-use-ref-transient-values`): `inputTextRef` for `handleSend` — avoids recreating callback on every keystroke
- **Removed unused state subscription** (`rerender-defer-reads`): `currentConversationId` removed from destructuring
- **Explicit ternaries** (`rendering-conditional-render`): replaced `&&` with `? ... : null` for conditional rendering
- **Stable FlatList callbacks**: `conversationKeyExtractor` and `renderConversation` extracted as `useCallback` refs (was inline in history modal)

### Dependencies
- Added `anthropic>=0.40.0` (backend)
- Added `react-native-marked` (mobile) — replaced `react-native-markdown-display` due to Node stdlib incompatibility

### Bug Fixes
- **Fixed "streaming not supported" error** — React Native's `fetch` doesn't support `ReadableStream`. Rewrote `streaming.ts` from `fetch` + `getReader()` to `XMLHttpRequest` with `onprogress` events. Updated store from `AbortController` to `{ abort: () => void }` return type.
- **Fixed `react-native-markdown-display` bundling failure** — package depends on `markdown-it` which requires Node's `punycode` stdlib module (unavailable in RN runtime). Replaced with `react-native-marked` (pure JS).
- **Fixed Docker container not picking up new npm package** — anonymous volume for `node_modules` in docker-compose.yml prevented host-installed packages from appearing. Fixed with `docker compose up --build -V mobile -d`.
- **Fixed white box around markdown** — `react-native-marked` hardcodes `backgroundColor: "#ffffff"` on its internal `FlatList` (line 43-44 of Markdown.tsx). Fixed by passing `flatListProps={{ style: { backgroundColor: "transparent" } }}` which spreads after the default style.
- **Fixed markdown text not following theme colors** — `react-native-marked` has a separate `theme` prop with `colors` object for base text/link/code colors; the `styles` prop alone doesn't override them.

---

## 2026-03-26 — Phase 4 (cont.): React Best Practices Refactor, Animation Fixes & UX Cleanup

### Mobile — Full React Best Practices Refactor (12 files)

Applied Vercel React best practices across all frontend code — extracted inline components, added memoization, hoisted constants, and stabilized callbacks.

#### Batch 1: Extract Inline FlatList renderItems (HIGH IMPACT)
- **`CategoryAllocation.tsx`**: Extracted `CategoryRow` as top-level `memo` component (was inline `renderItem`). Hoisted `Separator` to module level. Wrapped `updateAmount` and `getAllocAmount` in `useCallback`. Wrapped entire `CategoryAllocation` export in `React.memo`.
- **`transaction/[id].tsx`**: Extracted `CategoryChip` as top-level `memo` component with `item`, `isSelected`, `onPress` props (was inline `renderItem` creating new component type every render).
- **`budget/plan/[id].tsx`**: Extracted `CategoryPickerRow` as top-level `memo` component for category picker modal (was inline `renderItem`). Wrapped `addCategory` in `useCallback` with stable `setEditAllocations` functional updater.

#### Batch 2: Hoist Constants & Memoize Computations (HIGH IMPACT)
- **`NetWorthChart.tsx`**: Hoisted `MONTH_ABBR` array from render body to module level. Wrapped x-axis label computation in `useMemo([points, period])` — previously recomputed every render. Wrapped export in `React.memo`.
- **`PieChart.tsx`**: Extracted `wedgePath()` to module-level pure function (was closure capturing `cx`, `cy`, `innerR`, `outerR` — now takes them as parameters). Consolidated all segment geometry (dash lengths, rotations, boundaries, wedge paths) into a single `useMemo` — previously computed with mutable `cumulativeOffset` variable and IIFE during render. Wrapped export in `React.memo`.
- **`MonthPicker.tsx`**: Wrapped export in `React.memo` (already had hoisted constants and module-level helpers).

#### Batch 3: Add `React.memo` to Reusable Display Components (MEDIUM IMPACT)
- **`TransactionRow.tsx`**: Wrapped `TransactionRow` in `memo` — rendered in `.map()` loops across 5+ screens.
- **`TransactionListCard.tsx`**: Wrapped in `memo` — used on spending, income, budget-transactions, and account-transactions screens.
- **`LineChart.tsx`**: Wrapped in `memo` — expensive SVG path computation, rendered inside `NetWorthChart`.
- **`ColorPickerModal.tsx`**: Wrapped in `memo` — re-renders with parent even when not visible.

#### Batch 4: Verified useEffect Dependencies
- **`transaction/create.tsx`**: `[loadAccounts]` dep is stable (Zustand selector); `[accounts, selectedAccount]` auto-select effect has correct deps. No changes needed.
- **`NetWorthChart.tsx`**: `fetchData` wrapped in `useCallback([])` with `[period, fetchData, refreshKey]` effect — correct, no unnecessary refetches. No changes needed.

### Mobile — Budgets Tab Deep Refactor (React Performance)
- Extracted `PlansSection` as self-contained `memo` component managing its own `expandedPlanIds` state — eliminates parent re-renders from propagating into plan cards
- Module-level `persistedExpandedIds` (`Set<string>`) preserves expanded budget state across tab navigations and component remounts
- `PlanCard` derives animation state during render via `useRef` comparison (`shouldAnimate = isExpanded && !prevExpanded.current`) — cascade animation only plays when a budget is expanded, never on tab focus
- Extracted `BudgetCategoryRow` from inline FlatList `renderItem` into top-level `memo` component
- Replaced `indexOf`-based sort with O(1) `Map` lookup for category ordering
- Stabilized `renderItem`, `keyExtractor`, and `refreshControl` as `useCallback`/`useMemo` to prevent FlatList re-renders

### Mobile — Dashboard UX Fixes
- Fixed "View details" link positioning on income/spending summary cards — anchored to bottom-left with `marginTop: "auto"` and `alignItems: "stretch"` on carousel content
- Fixed over-budget amount having extra left margin — split `errorText` style (which had `textAlign: "center"` and `paddingHorizontal: 24`) into separate `overText` style (just `color: colors.error`) for budget amounts

### Bug Fixes
- **Fixed cascade animation playing on tab focus**: Root cause was `renderHeader` `useCallback` recreating when `expandedPlanIds` changed (tab focus → `plans` prop changes → callback recreates → PlanCard remounts → animation replays). Solution: isolated expanding state in `PlansSection` memo component with `useRef`-based derived animation state.
- **Fixed expanded budget state lost on tab navigation**: Module-level `persistedExpandedIds` Set survives component unmount/remount cycles, initialized into `PlansSection` via `useState(() => new Set(persistedExpandedIds))`.

---

## 2026-03-26 — Phase 4 (cont.): Budget Plan Editing, UX Cleanup & Race Condition Fixes

### Backend — Budget Plan Allocation Updates
- `update_budget_plan` now regenerates `Budget` rows for the current month when allocations change — deletes old budgets linked to the plan, also cleans up unlinked legacy budgets matching the same categories, then creates new budget rows from updated allocations
- Added `category_id` to `SpendingByCategory` and `IncomeByCategory` schemas (`schemas/dashboard.py`)
- Updated dashboard spending/income queries to select `Category.id`, group by `Category.id`, and include `category_id` in results — enables frontend category filtering and navigation

### Mobile — Budget Plan Detail: Edit Mode (Add/Remove Allocations)
- Added edit mode to `budget/plan/[id].tsx` with "Edit" / "Cancel" toggle next to "Allocations" title
- Edit mode renders editable `TextInput` amount fields, red remove (X) buttons per allocation, and "+ Add Category" button
- Category picker modal shows unallocated categories (fetched from `/v1/categories`), filtered to exclude already-allocated ones
- "Save Allocations" button sends `PUT /v1/budget-plans/{id}` with full `allocations` array replacement (entries with amount 0 filtered out)
- Allocated and unallocated totals remain visible in edit mode

### Mobile — Budget Transactions Screen Refactor
- Dynamic screen title via `navigation.setOptions({ title: \`${categoryName} Transactions\` })`
- Added category icon with colored circle (`withOpacity` background) at top of summary card
- Icon is tappable — opens `ColorPickerModal` for category color changes
- Color changes propagate via `refreshBudgets()`, `refreshPlans()`, `refreshDashboard()`
- Progress bar fill uses category color instead of hardcoded primary

### Mobile — Shared Category Icon Utility
- Extracted `getCategoryIcon()` and `CATEGORY_ICONS` mapping from 3 files into `src/utils/categoryIcons.ts`
- Maps 30+ category names to MaterialCommunityIcons (Food & Drink → silverware-fork-knife, Transportation → car, etc.)
- Removed duplicate icon maps from `budgets.tsx`, `CategoryAllocation.tsx`

### Mobile — Category Navigation from Spending & Income Screens
- Spending summary (`spending.tsx`): category rows wrapped in `TouchableOpacity`, tapping navigates to budget-transactions screen with `category_id`, `category_name`, `category_color`, `spent`, `month`, `year` params
- Income summary (`income.tsx`): same category navigation pattern

### Mobile — Dashboard Budget Deduplication & Plan Totals
- Overall budget totals on dashboard and budgets tab now use plan totals (`plans.reduce(sum + total_amount)`) instead of per-category sums when plans exist
- Dashboard: created `mergedBudgetSummaries` memo that deduplicates categories by `category_id` and uses plan allocation amounts
- Budgets tab: `aggregatedBudgets` memo merges multiple plans' allocations per category (amounts summed, spent kept from first entry)

### Mobile — Cascade Dropdown Animation Fix
- Extracted `PlanCard` as `React.memo` component to isolate re-renders — previously all plan cards re-animated when any plan was expanded because `renderHeader` useCallback recreated on `expandedPlanIds` change, remounting all `CascadeRow` components

### Mobile — Budgets Tab UX Cleanup
- Removed long-press quick-edit modal (name + total amount editing)
- Removed inline allocation amount editing in cascade dropdown — allocations are now read-only display
- Allocation rows in cascade dropdown sorted descending by amount
- Removed unused state: `editingAllocationId`, `editingAmount`, `savingAllocation`, `quickEditPlan`, `quickEditName`, `quickEditAmount`, `savingQuickEdit`
- Removed unused functions: `updateAllocationAmount`, `openQuickEdit`, `saveQuickEdit`, `handleStartEdit`
- Removed unused imports: `Modal`, `KeyboardAvoidingView`, `Platform`, `Pressable`, `TextInput`, `contrastForeground`
- Removed unused styles: `allocationEditRow`, `allocationAmountEditing`, `modalOverlay`, `quickEdit*` styles

### Mobile — Color Propagation Fix
- Budget-transactions screen now refreshes `budgetPlans`, `budgets`, and `dashboard` stores after color PATCH
- Budget plan detail screen refreshes `dashboard` store on all save/delete operations

### Bug Fixes
- **Fixed allocation save race condition** — save flow in `budget/plan/[id].tsx` was calling `setPlan(updated)` from PUT response then refreshing stores asynchronously, causing values to bounce between old and new. Fixed by awaiting all store refreshes + a fresh GET for the plan in parallel before updating local state
- **Fixed budget categories not updating after allocation changes** — backend now regenerates `Budget` rows on plan update; frontend uses explicit `loadBudgets(currentMonth, currentYear)` instead of store's `refresh()` which relied on potentially unset module-level state
- **Fixed transaction filtering showing all transactions** — backend `SpendingByCategory`/`IncomeByCategory` needed `category_id`; spending/income screens needed to pass `category_id` in navigation URLs

---

## 2026-03-25 — Phase 4: Budget Plans, Multi-Colored Progress Bars & UX Refinements

### Backend — Budget Plans System
- Created `budget_plans` and `budget_plan_allocations` tables (Alembic migration `e6f7a8b9c0d1`)
- Added nullable `budget_plan_id` FK to `budgets` table (SET NULL on delete)
- Created `BudgetPlan` and `BudgetPlanAllocation` SQLAlchemy models with cascade relationships
- Created budget plan schemas: `BudgetPlanCreateRequest`, `BudgetPlanUpdateRequest`, `BudgetPlanOut`, `AllocationIn/Out`, `MonthYear`
- Created budget plan service (`services/budget_plans.py`): full CRUD, allocation replacement on update, idempotent recurring budget generation
- Created budget plan router (`routers/budget_plans.py`): `GET/POST /v1/budget-plans`, `GET/PUT/DELETE /v1/budget-plans/{plan_id}`, `POST /v1/budget-plans/generate-recurring`
- `DELETE` accepts `delete_budgets` query param to optionally remove generated budgets or just unlink them

### Mobile — Multi-Step Budget Creation Wizard
- Created `app/budget/create.tsx` — 4-step wizard: Set Total → Allocate by Category → Select Duration → Review
- Step indicators with completed/active states and navigation
- Review summary shows plan name, total, allocations breakdown, and duration
- POSTs to `/v1/budget-plans` then refreshes both stores

### Mobile — Budget Plan Components
- Created `MonthPicker` component (`src/components/MonthPicker.tsx`) — grid of 12 upcoming months with multi-select and "Until I turn off" recurring toggle
- Created `CategoryAllocation` component (`src/components/CategoryAllocation.tsx`) — category list with inline amount TextInputs, running total with progress bar
- Created Zustand `budgetPlans` store (`src/stores/budgetPlans.ts`) with load/refresh/removePlan

### Mobile — Budget Plan Detail Screen
- Created `app/budget/plan/[id].tsx` — plan detail with inline editing:
  - Tap plan name → inline TextInput edit with save button
  - Tap total amount → inline decimal-pad edit with save button
  - Tap allocation amount → inline edit with save button
  - All edits save via `PUT /v1/budget-plans/{id}` and refresh stores
- Recurrence toggle (Switch) to enable/disable recurring budget generation
- Delete button with 3-option alert: Cancel / Keep Budgets / Delete Everything

### Mobile — Budgets Tab Overhaul
- Budget categories aggregated by `category_id` — multiple plans' allocations merge into one row (amounts summed, spent kept from first to avoid double-counting)
- Stable sort order: categories sort by amount on focus/refresh only, preserved during inline edits
- Expandable plan cards: chevron toggles expand/collapse with `LayoutAnimation`
  - Tap plan card → navigates to plan detail screen
  - Long-press plan card → quick-edit modal for name and total amount
  - Chevron button → expand/collapse allocations dropdown
- Expanded allocation rows with category icon, name, and tappable inline amount editing
- Row separators between allocation rows
- Swipe-to-delete on plan cards using `PanResponder` + `Animated` — reveals delete button with trash icon
- Delete action triggers 3-option alert matching plan detail screen
- Category cards navigate to budget-transactions on tap
- Hamburger (list) icon on category rows for budget-transactions navigation

### Mobile — Multi-Colored Overall Budget Progress Bar
- **Budgets tab**: overall budget progress bar now shows colored segments per spending category, proportional to each category's spent amount relative to total budget
- **Dashboard**: same multi-colored progress bar applied to the overall budget pill
- Track uses `overflow: "hidden"` with pill border-radius so segments clip naturally
- Over-budget state: all segments turn error red

### Mobile — Quick-Edit Plan Modal
- Modal overlay with name and total amount TextInputs
- Tap outside to dismiss, Save/Cancel buttons
- Saves via `PUT /v1/budget-plans/{id}` and refreshes all stores

### Bug Fixes
- Fixed duplicate React key errors across `index.tsx` (budget summaries use `${category_id}-${idx}`), `spending.tsx`, and `income.tsx` (use `${category_name}-${index}`)
- Fixed double-counted spending after budget aggregation — `spent` is per-category, kept from first entry only
- Fixed modal double-shadow — replaced nested `TouchableOpacity` overlay with `Pressable` + `StyleSheet.absoluteFill`

---

## 2026-03-24 — Category Colors, React Performance & UX Improvements

### Backend — Category Color Picker
- Added `PATCH /v1/categories/{category_id}` endpoint to update a category's color
- Added `CategoryUpdateRequest` schema with hex color validation (`^#[0-9A-Fa-f]{6}$`)
- Added `update_category_color()` service function in `services/categories.py`
- Added `category_color` field to `BudgetOut` schema (`schemas/budget.py`)
- Added `category_color` field to `SpendingByCategory`, `IncomeByCategory`, and `BudgetSummary` schemas (`schemas/dashboard.py`)
- Updated `_budget_to_dict()` in `services/budgets.py` to include `category_color` from the category relationship
- Updated dashboard service `spending_by_category` and `income_by_category` queries to SELECT and GROUP BY `Category.color`, returning `category_color` in response
- Updated dashboard `budget_summaries` to include `category_color`

### Mobile — Category Color Picker Feature
- Created `ColorPickerModal` component (`src/components/ColorPickerModal.tsx`) — bottom sheet modal with 16 color swatches in a grid, checkmark on current selection
- Created color utility (`src/utils/color.ts`) with `withOpacity(hex, opacity)` and `contrastForeground(hex)` (luminance-based contrast for icon foreground)
- Added `colorPickerPalette` (16 colors) to `theme.ts`
- Updated `Budget` type in `stores/budgets.ts` and `BudgetSummary`, `SpendingByCategory`, `IncomeByCategory` types in `stores/dashboard.ts` with `category_color: string | null`

### Mobile — Color Propagation Across All Screens
- **Budgets tab** (`budgets.tsx`): Icon circles are now tappable `TouchableOpacity` that open the color picker; on select, calls `PATCH /v1/categories/{id}` then refreshes budgets + dashboard stores; budget cards use `item.category_color` for progress bar fill and icon background (with `withOpacity`), fallback to palette colors when null
- **Dashboard** (`index.tsx`): Spending and income pie chart slices use `cat.category_color || PIE_COLORS[i]`; budget pill expanded category rows use `b.category_color` for progress bar fill
- **Spending screen** (`spending.tsx`): Stacked bar segments, category dots, and individual progress bars use `cat.category_color || CATEGORY_COLORS[i]`
- **Income screen** (`income.tsx`): Same color propagation as spending screen

### Mobile — React Performance Optimizations
- **Dashboard** (`index.tsx`): Wrapped budget calculations in `useMemo` (single-pass reduce); memoized `onCarouselScroll` with `useCallback`; hoisted inline `hitSlop` to module-level `HIT_SLOP_8` constant; moved inline style object to `styles.accountsWidgetLeft`; dashboard no longer blocks on Plaid balance refresh before loading data
- **Budgets tab** (`budgets.tsx`): Wrapped budget totals in `useMemo`; memoized `renderHeader` with `useCallback`
- **Budget edit** (`budget/[id].tsx`): Parallelized categories + budget fetch with `Promise.all()`
- **PieChart** (`PieChart.tsx`): Wrapped boundary angle computation in `useMemo`
- **Asset detail** (`asset/[id].tsx`): Wrapped `hasChanges` in `useMemo`
- **Transactions tab** (`transactions.tsx`): Moved inline loader style to `styles.loader`

### Mobile — Tappable Monthly Trend Bars
- **Spending screen** (`spending.tsx`): Tapping a bar in the 6-month trend chart fetches that month's category breakdown and transactions via parallel `Promise.all` API calls; selected month highlighted; tapping current month or re-tapping resets to default view; dynamic titles show selected month name
- **Income screen** (`income.tsx`): Same tappable bar behavior as spending screen
- **TransactionListCard** (`TransactionListCard.tsx`): Added optional `title` prop to customize card header (e.g. "Transactions — January 2026")

### Mobile — Carousel Snap Fix
- Fixed carousel cards getting stuck when swiping past the last card — replaced `snapToInterval` with `snapToOffsets` + `snapToEnd={true}`; removed `paddingRight` from carousel content and added `carouselCardLast` style with `marginRight: 0` to prevent rubber-banding on the last card

---

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
