# Demo Mode — Design Spec

**Date:** 2026-07-01
**Status:** Approved, pre-implementation

## Goal

Provide a shareable, clickable web link that lets anyone explore the Pebble app
without a backend or an account. The app is auth-gated and normally requires a
live API; a "demo mode" makes the entire UI explorable against canned data.

## Decisions (locked)

| Decision | Choice |
| --- | --- |
| Entry point | URL param `?demo=1` (persisted for the session) |
| Write behavior | Read-only — mutations are no-ops that return plausible success |
| AI chat | Disabled — input disabled with a short note |
| Data coverage | Everything — a coherent persona behind every read endpoint |
| Host | Vercel (static export) |
| Platform | Web only; native builds are unaffected |

## Approach

All API traffic already funnels through three chokepoints:

- `apiRequest` (`src/api/client.ts`)
- `apiUpload` (`src/api/client.ts`)
- the AI streaming client (`src/api/streaming.ts`)

Demo mode intercepts at these three points and routes requests to a
self-contained `src/api/demo/` module. This requires **no changes to the ~25
screens or the Zustand stores**, keeps the feature in one folder, and makes it
trivial to remove later.

Rejected alternatives:
- **Monkeypatching `window.fetch`** — global, hacky, and misses the AI chat
  (which uses XHR, not fetch).
- **Mock Service Worker (MSW)** — adds a dependency and service-worker setup for
  a read-only static demo. Overkill.

## Architecture

### New module: `src/api/demo/`

**`mode.ts`**
- `isDemoMode(): boolean`
  - Native (`Platform.OS !== "web"`) → always `false`.
  - Web → `true` if the URL contains `?demo=1` **or**
    `sessionStorage["pebble_demo"]` is set.
  - When the URL param is present, it also writes the `sessionStorage` flag, so
    demo mode survives client-side navigation (expo-router drops the query param
    on subsequent route changes).

**`data.ts`**
- One coherent fake persona (e.g. "Alex Rivera"), authored once and internally
  consistent:
  - User profile (`onboarding_completed: true`).
  - Accounts: checking, savings, credit card (with balances).
  - ~6 months of dated transactions across realistic categories.
  - Categories, budgets, budget-plans, assets.
  - Baseline values needed for health score.

**`router.ts`**
- `handleDemoRequest(path, method, body): Promise<T>`
  - Pattern-matches `path` (with path params like `/v1/transactions/:id`).
  - Filters `data.ts` by query params: `month`/`year`, `date_from`/`date_to`,
    `type`, `category_id`, `account_id`, `limit`, and pagination.
  - Computes dashboard, spending, net-worth-history, and health-score aggregates
    **from the transaction array** so all numbers reconcile.
  - Writes (`POST`/`PUT`/`PATCH`/`DELETE`) return a plausible success echo
    **without mutating state**.
  - On-load/secondary endpoints return benign/empty data so no screen errors:
    `/v1/ai/models`, `/v1/ai/conversations`, `/v1/api-keys`, `/v1/plaid/*`.

### Endpoints to handle

Reads (return canned data): `/v1/auth/me`, `/v1/accounts`, `/v1/accounts/:id`,
`/v1/dashboard`, `/v1/dashboard/net-worth-history`, `/v1/transactions` (+
filters), `/v1/transactions/:id`, `/v1/budgets`, `/v1/budgets/:id`,
`/v1/budget-plans`, `/v1/budget-plans/:id`, `/v1/assets`, `/v1/assets/:id`,
`/v1/categories`, `/v1/categories/:id`, `/v1/health-score`,
`/v1/health-score/history`, `/v1/ai/models`, `/v1/ai/conversations`,
`/v1/api-keys`.

Writes (no-op success): all `POST`/`PUT`/`PATCH`/`DELETE`, including
`/v1/plaid/*`, profile updates, budget/transaction/asset mutations.

## Integration points (minimal edits)

- `src/api/client.ts` — first line of `apiRequest` and `apiUpload`:
  `if (isDemoMode()) return handleDemoRequest(path, method, body)`.
- `src/api/streaming.ts` — first line of the AI chat call: if demo, no-op.
- `src/components/ChatSheet.tsx` — if demo, disable the input and show a
  "AI chat is disabled in the demo" note.

**Auth bypass:** no routing changes. `/v1/auth/me` returns the demo user with
`onboarding_completed: true`, so the existing `AuthGate` in `app/_layout.tsx`
routes straight to `/(tabs)`.

## Deployment

1. `expo export -p web` → static `dist/`.
2. Add `vercel.json` with an SPA rewrite (`/(.*) → /index.html`), since
   expo-router runs client-side routing and the export is a single `index.html`.
3. Deploy `dist/` to Vercel.
4. Demo link: `https://<project>.vercel.app/?demo=1`.

## Testing

- **Unit tests**
  - `router.ts`: path matching, month/date/type filtering, aggregate
    reconciliation (transactions sum to dashboard/spending/net-worth), and
    writes-are-no-ops.
  - `mode.ts`: activation via `?demo=1`, `sessionStorage` persistence, native
    returns `false`.
- **Manual browser pass** (local `serve` + Playwright): visit every tab and
  detail screen with `?demo=1`, confirm populated data and **zero console
  errors**. Confirm AI chat input is disabled.

## Out of scope

- Persisting/mutating demo data (writes stay no-ops).
- Working AI chat in demo.
- Any change to native app behavior.
