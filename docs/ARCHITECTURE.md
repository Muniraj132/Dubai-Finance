# Dubai Finance Tracker — Architecture & Developer Guide

This document explains how the application is built, how data flows through
it, and the business rules behind each feature, in enough depth that a new
developer shouldn't need to ask "why does this work this way?" — the answer
should be here.

> Note: `README.md` at the repo root predates the Supabase migration and
> still describes a localStorage-only version. This document reflects the
> current codebase, which is backed by Supabase for auth and data storage.

## 1. What this app is

A personal finance tracker for someone living/working in Dubai (AED) while
their financial life partly stays in India (INR). It tracks expenses,
income, savings goals, gold purchases, monthly budgets, and "chit funds" (a
rotating-savings-and-credit scheme common in India — see §7.6), and
presents everything in both currencies. Single-user-per-account: every table
is scoped to `auth.uid()` via Postgres Row Level Security, so it's
effectively "your own private ledger," not a shared household budget.

## 2. Tech stack

| Layer | Choice |
|---|---|
| UI framework | React 19 + TypeScript, built with Vite 6 |
| Routing | `react-router-dom` v6 (`BrowserRouter`) |
| State | Zustand (two stores: auth, app data) — no Redux/Context |
| Styling | Tailwind CSS v3 + a small set of CSS custom properties for theming (`src/index.css`) |
| Charts | Recharts |
| Backend | Supabase (Postgres + Auth + RLS) via `@supabase/supabase-js` — **no ORM**, no server code of our own. The client talks to Supabase directly. |
| Deployment | Vercel (`vercel.json` — SPA rewrite to `index.html`), plus Vercel Analytics/Speed Insights wired into `App.tsx` |
| Tests | **None.** No test runner is installed. See §11. |

There is no backend server in this repo — "the backend" is entirely
Supabase's hosted Postgres + its auto-generated REST API (PostgREST), called
through the JS client. Business logic that would normally live in an API
layer instead lives in the Zustand store (`src/stores/useAppStore.ts`).

## 3. Project structure

```
src/
├── main.tsx                 # ReactDOM root, wraps <App/> in <StrictMode>
├── App.tsx                  # Router, auth gate, lazy-loaded routes
├── index.css                # Tailwind entry + CSS variable theme tokens
├── components/
│   ├── layout/Layout.tsx    # Sidebar + top-level banners (rate updated / error), wraps <Outlet/>
│   └── ui/index.tsx         # All shared UI primitives (Button, Modal, Input, StatCard, ...)
├── pages/                   # One file per route (see §4 for the route table)
├── stores/
│   ├── useAuthStore.ts      # Supabase auth session state
│   └── useAppStore.ts       # All domain data + CRUD actions (the "backend logic")
├── types/index.ts           # Every TypeScript interface/type in the app
└── utils/
    ├── index.ts             # Currency conversion, formatting, CSV export, misc helpers
    ├── supabase.ts           # Supabase client singleton
    └── exchangeRate.ts       # Periodic AED→INR rate refresh (see §8)
supabase/
├── README.md                 # Migration convention docs
└── migrations/                # Numbered SQL files — the source of truth for the schema (see §6)
```

## 4. Routing & pages

`App.tsx` renders one of two trees based on auth state (`useAuthStore`):

- **Not signed in** → `<Auth />` (login/register form, no sidebar).
- **Signed in** → `<Layout />` (sidebar + banners) wrapping the router `<Outlet />`.

All page components are lazy-loaded (`React.lazy` + `<Suspense>`) so route
bundles are fetched on demand instead of one large bundle. `Layout` and
`Auth` stay eagerly loaded since they're needed immediately.

| Route | Page component | Purpose |
|---|---|---|
| `/` | `Dashboard.tsx` | Current-month overview: income/expenses/savings stat cards, 6-month chart, category pie, recent expenses |
| `/expenses` | `Expenses.tsx` | CRUD + search/filter/month-filter list of expenses |
| `/income` | `Income.tsx` | CRUD list of income entries |
| `/goals` | `Goals.tsx` | Savings goals with progress bars and a "contribute funds" flow |
| `/gold` | `GoldTracker.tsx` | Gold purchases (grams + price/gram), progress toward a target weight |
| `/analytics` | `Analytics.tsx` | Deeper charts: today's summary, best/worst months, all-time category breakdown |
| `/budget` | `BudgetPlanner.tsx` | Per-category monthly budgets vs. actual spend, with over/near/on-track status |
| `/converter` | `Converter.tsx` | Standalone AED⇄INR calculator + salary reference table (not tied to stored records) |
| `/dubai-life` | `DubaiLife.tsx` | "Journey" dashboard: days in Dubai, lifetime totals, milestones, financial health score |
| `/chit-funds` | `ChitFund.tsx` | Chit fund tracking (list + per-chit installment detail view) |
| `/reports` | `Reports.tsx` | CSV export for expenses/income/goals |
| `/settings` | `Settings.tsx` | Manually edit exchange rate, Dubai arrival date, theme |

## 5. State management

Two Zustand stores, both plain `create<T>()((set, get) => ({...}))` — no
middleware, no persistence plugin (persistence is Supabase, not
localStorage, despite what the old README says).

### 5.1 `useAuthStore` (`src/stores/useAuthStore.ts`)

Thin wrapper around `supabase.auth`: `user`, `session`, `loading`, `error`.
`initialize()` reads the current session once and subscribes to
`onAuthStateChange` so `user` stays in sync across tabs/token refresh.
`signOut()` also calls `useAppStore.getState().reset()` to clear all domain
data from memory (important — otherwise a second user signing in on the
same browser would briefly see the previous user's cached state).

### 5.2 `useAppStore` (`src/stores/useAppStore.ts`)

Holds every domain collection (`expenses`, `incomes`, `goals`, `budgets`,
`goldPurchases`, `chitFunds`, `chitInstallments`, `settings`) plus
`isLoading`, `rateJustUpdated`, and `lastError`.

**Boot sequence**: `initialize()` (called once in `App.tsx` when `user`
becomes truthy) fires all 8 Supabase `select` queries in parallel via
`Promise.all` and populates the store. There is no pagination/streaming —
the entire dataset for the signed-in user is loaded into memory up front.
This is fine at personal-finance-tracker scale but wouldn't scale to a
multi-year, hundreds-of-transactions-per-month dataset without revisiting.

**Every mutation follows the same optimistic-write pattern**, implemented
once as the `writeThrough` helper (a closure inside `create()`, capturing
`set`/`get`):

```ts
const writeThrough = async <K extends keyof AppState>(
  key: K,
  optimisticValue: AppState[K],
  call: () => PromiseLike<{ error: any }>
) => {
  const prev = get()[key];
  set({ [key]: optimisticValue } as Partial<AppState>);   // apply immediately
  const { error } = await call();                          // fire the Supabase write
  if (error) {
    set({ [key]: prev, lastError: '...' } as Partial<AppState>); // roll back + surface error
  }
};
```

Every `add*`/`update*`/`delete*` action:
1. Computes the new value for its collection (id generation via
   `generateId()` — a `Date.now()` + random-suffix string, **not** a UUID;
   see §11 for why this matters),
2. Computes currency snapshot fields if relevant (§7.1),
3. Calls `writeThrough(key, newValue, () => supabase.from(table)...)`.

If the Supabase call fails, the optimistic change is undone and
`lastError` is set, which `Layout.tsx` renders as a dismissible red banner
(auto-clears after 6s, or on manual close). This means the UI never lies
about whether something was actually saved.

`updateSettings` follows a variant of the same pattern (it needs the
authenticated user's id fetched async before building the upsert payload).

## 6. Database schema & migrations

**There is no ORM.** Every table is queried via `supabase.from('table_name')`
with plain object literals — the shape of what you pass to `.insert()` /
`.update()` must exactly match the DB column names (see the mixed-casing
note below).

Schema source of truth: `supabase/migrations/*.sql`, applied in order,
documented in `supabase/README.md`. There's no Supabase CLI project linked
— you paste these into the Supabase Dashboard's SQL Editor by hand. Current
files:

- `0001_initial_schema.sql` — full schema for a fresh install (all tables + RLS policies).
- `0002_historical_currency_snapshot.sql` — retrofits the AED/INR snapshot columns onto a pre-existing database.
- `0003_add_rate_fetched_at.sql` — adds the column that drives periodic rate refresh (§8).

### Tables

All tables have `user_id uuid references auth.users(id) on delete cascade`
and an RLS policy `using (auth.uid() = user_id) with check (auth.uid() = user_id)`
for `all` operations — i.e., a user can only ever see/modify their own rows.

| Table | Key columns | Notes |
|---|---|---|
| `expenses` | `date, amount, currency, category, notes, createdAt` + `amountAed, amountInr, exchangeRateUsed` | `category` is a free-text enum-like field, values from `EXPENSE_CATEGORIES` in `utils/index.ts` |
| `incomes` | same shape as `expenses`, with `source` instead of `category` | `source` ∈ `Salary \| Bonus \| Freelance \| Others` |
| `goals` | `name, targetAmount, currentAmount, targetDate, currency, color` + `targetAmountAed/Inr, currentAmountAed/Inr, exchangeRateUsed` | `currentAmount` is a running balance updated by "contribute funds," not a ledger of individual contributions |
| `budgets` | `month (YYYY-MM), category, amount, currency` + `amountAed, amountInr, exchangeRateUsed` | One row per (month, category) — `setBudget` upserts by that composite key in application code, there's no DB unique constraint enforcing it |
| `gold_purchases` | `date, weightGrams, pricePerGram, currency, notes` + `totalValueAed, totalValueInr, exchangeRateUsed` | "amount" is derived (`weightGrams * pricePerGram`); the snapshot columns store that derived total, not a raw input field |
| `settings` | **one row per user**, `user_id` is the primary key | `aedToInrRate` (default 23), `dubaiArrivalDate`, `theme`, `currency`, `rateFetchedAt` |
| `chit_funds` | `name, total_amount, duration_months, organizer, start_date, end_date, status, received_amount, received_month_no, notes` | No `currency` column — always implicitly INR (see §7.6) |
| `chit_installments` | `chit_id (FK), month_no, due_date, amount, paid_amount, paid_date, payment_mode, status, remark` | Indexed on `chit_id`; deleting a chit fund cascades to its installments (`on delete cascade`, also mirrored in the optimistic client-side delete) |

**Column-naming quirk to know about**: columns are a mix of plain lowercase
(`amount`, `currency`, `date`) and double-quoted camelCase (`"createdAt"`,
`"targetAmount"`, `"amountAed"`). Postgres folds unquoted identifiers to
lowercase, so any column that needs to stay camelCase in JS **must** be
double-quoted in the SQL. This isn't a deliberate convention so much as
organic growth — new columns should match whatever the corresponding
TypeScript field is named, quoted if it's not all-lowercase.

## 7. Business logic by feature

### 7.1 Currency: the historical-snapshot pattern

This is the single most important piece of domain logic in the app, so
it's worth understanding in full.

**The problem it solves**: `settings.aedToInrRate` is one mutable number
per user (edited manually in Settings/Converter, or auto-refreshed — §8).
If every page computed "what is this AED expense worth in INR?" live, at
render time, then editing the rate today would silently change the
displayed INR value of every past transaction — including ones from months
ago when the real-world rate was different. That's wrong for a finance
tracker: historical records should reflect the rate at the time of the
transaction, permanently.

**The fix**: every amount-bearing record stores its own value in *both*
currencies, computed once at write time, frozen forever after (until the
user explicitly edits the amount/currency again):

- `src/utils/index.ts`: `convertToAED(amount, currency, rate)` /
  `convertToINR(amount, currency, rate)` — pure math, still used at write
  time to compute the snapshot.
- `src/stores/useAppStore.ts`: `snapshotRates(amount, currency, rate)` —
  returns `{ amountAed, amountInr, exchangeRateUsed }` for the common case
  (used by expenses/incomes/budgets). Goals and gold purchases inline the
  same math because they have two amount fields (target/current) or a
  derived amount (weight × price/gram) respectively.
- On **create**, every `add*` action computes the snapshot using
  `get().settings.aedToInrRate` at that instant.
- On **update**, the snapshot is only recomputed if the patch actually
  touches an amount/currency-bearing field (`patch.amount !== undefined ||
  patch.currency !== undefined`, etc.). Editing just the `notes` or `date`
  of an expense leaves its historical snapshot untouched — this is the
  detail that makes the whole scheme correct; without it, any edit at all
  would silently re-price the record using today's rate.
- **Reading**: `src/utils/index.ts` exports `resolveAed(amount, currency,
  storedValue, rate)` / `resolveInr(...)`, which return the stored snapshot
  if present, falling back to a live `convertTo*` only for legacy rows that
  predate this feature (`stored ?? convertTo*(...)`). Every page reads
  through these resolvers instead of doing `currency === 'AED' ? amount :
  amount / rate` inline — that inline pattern used to be everywhere and has
  been fully replaced.
- `computeMonthlyStats` (used by Dashboard/Analytics for the 6/12-month
  charts) aggregates *both* the AED and INR resolved values per month
  (`income`, `expenses`, `savings` in AED; `incomeInr`, `expensesInr`,
  `savingsInr` in INR), so even monthly rollups and chart tooltips reflect
  frozen historical values, not "AED total × today's rate."

**What's still intentionally live** (not a bug): the in-modal "≈ ₹X"
preview shown while typing a new amount before saving (it's not a record
yet), and two explicitly-labeled "current rate" surfaces — the sidebar rate
display and Dashboard's "Live Rate" banner, plus the whole `/converter`
page, which is a standalone calculator, not tied to stored transactions.

**Backward compatibility**: existing rows created before this feature has
`amountAed`/`amountInr`/etc. as `NULL` until the `0002` migration backfills
them (one-time, using each user's *current* rate — an acknowledged
approximation for data that predates the feature, not a true historical
rate). All type definitions mark these fields `number | null | undefined`
and every read site uses `resolveAed`/`resolveInr` so nothing crashes or
misbehaves on a row that's still `NULL` for any reason.

### 7.2 Expenses & Income

Straightforward CRUD lists (`Expenses.tsx`, `Income.tsx`) with month/
category/search filtering done client-side over the full in-memory array
(no server-side filtering — everything's already loaded). `Expenses.tsx`
also computes a same-month spending-vs-income ratio to show "over budget" /
"high spending" warning banners — the same warning logic is duplicated (not
shared) across `Expenses.tsx`, `Dashboard.tsx`, and `Analytics.tsx`; if you
change the thresholds (currently ≥100% = over, ≥80% = high), update all
three.

### 7.3 Goals

A goal has a `targetAmount` (set once at creation, editable) and a
`currentAmount` (a running balance). "Add Funds" (`Goals.tsx:
handleContribute`) doesn't create a separate contribution record — it just
does `updateGoal(id, { currentAmount: goal.currentAmount + contributeAmount
})`. This means:
- There's no audit trail of individual contributions, only the current
  total.
- Per §7.1, only `currentAmount`'s snapshot fields get recomputed on a
  contribution — `targetAmount`'s snapshot is untouched, which is correct
  since the target didn't change.

If you ever need per-contribution history (e.g., "show me a timeline of
deposits into this goal"), that requires a new `goal_contributions` table —
today's schema can't reconstruct it after the fact.

### 7.4 Budget Planner

`budgets` is conceptually keyed by `(month, category)`, but that's enforced
in application code only (`setBudget` does a `find` + update-or-insert),
**not** by a DB unique constraint. Two concurrent writes for the same
month+category (e.g. two browser tabs) could theoretically both insert
instead of one updating — low risk for a single-user app, but worth knowing
if this ever becomes multi-device-concurrent.

Status thresholds (`BudgetPlanner.tsx`): on-track < 80% spent, near-limit
80–99%, over-budget ≥ 100%.

### 7.5 Gold Tracker

Purchases are stored as `weightGrams` + `pricePerGram` (in whichever
currency was selected at purchase time) rather than a single `amount` — the
"total value" is always derived (`weightGrams * pricePerGram`), and that
derived value is what gets snapshotted into `totalValueAed`/`totalValueInr`
(§7.1). The page tracks progress toward a **hardcoded** target
(`GOLD_TARGET_GRAMS = 2` in `GoldTracker.tsx`) — there's no UI to change
this target; it's a constant in code.

### 7.6 Chit Funds

A **chit fund** is a rotating savings-and-credit association common in
India: a group of people each contribute a fixed amount monthly into a
pool, and each month one member (by lottery, bid, or rotation) receives the
entire pot. This app only tracks *your own* participation in a chit, not
the whole group — from your side, it looks like: pay a fixed monthly
installment for N months, and at some point receive one lump-sum payout
(`received_amount`, `received_month_no` on `chit_funds`).

- `ChitFund.tsx` has a list view (all your chits, aggregate stats) and a
  detail view (one chit's installment schedule), toggled by
  `selectedChitId` local state — not a separate route.
- Installment `status` (`pending | paid | partial | missed`) is set
  explicitly, either via the general edit modal or the "Pay" quick-action
  (`handlePay`), which auto-derives status from the paid amount vs. amount
  due (`paid >= amount → 'paid'`, `paid > 0 → 'partial'`, else `'pending'`
  — note it can never auto-set `'missed'`; that has to be set manually,
  presumably after a due date passes with nothing paid).
- **No currency conversion here** — `chit_funds`/`chit_installments` have
  no `currency` column and are not part of the historical-snapshot system
  in §7.1. Every amount is treated as INR (`formatCurrency(n, 'INR')`
  throughout the page). This is a deliberate scope boundary, not an
  oversight — chit funds are an India-side financial instrument, not an
  AED/INR conversion case.

### 7.7 Dubai Life

A read-only aggregate dashboard: lifetime totals across incomes/expenses/
gold (all resolved through §7.1's historical values), "days in Dubai"
(computed from `settings.dubaiArrivalDate`), fixed milestone thresholds (30/
90/180/365/730 days), and a "financial health score" that's really just the
savings rate re-labeled with emoji tiers (≥30% excellent, ≥20% good, ≥10%
fair, else needs work).

### 7.8 Reports (CSV export)

`Reports.tsx` exports expenses/income/goals to CSV via `exportToCSV` in
`utils/index.ts` (builds a CSV string client-side, triggers a `Blob`
download — no server round-trip). Each export includes both the raw
`amount`/`currency` as entered *and* the resolved `AmountAED`/`AmountINR`
columns, so exported data carries the same historical accuracy as the UI.

### 7.9 Converter & Settings

`Converter.tsx` is a pure calculator (bidirectional AED⇄INR conversion,
quick-amount buttons, a salary reference table) — it reads/writes
`settings.aedToInrRate` but has no concept of "transactions." `Settings.tsx`
is the manual-override surface for the same rate, plus the Dubai arrival
date and theme. Both call `updateSettings` directly; neither goes through
`exchangeRate.ts` (that's only for the automatic periodic refresh, §8).

## 8. Exchange rate refresh (`src/utils/exchangeRate.ts`)

`maybeRefreshExchangeRate()` is called once, in `App.tsx`, right after
`initApp()` resolves for a signed-in user (i.e., on every app load, not
just login). It checks `settings.rateFetchedAt`; if it's missing or more
than 24 hours old, it fetches `https://api.exchangerate-api.com/v4/latest/AED`
and, on success, calls `updateSettings({ aedToInrRate, rateFetchedAt: now })`
followed by `setRateJustUpdated(true)` (which drives the green "Exchange
rate updated" banner in `Layout.tsx`, auto-hiding after 4s).

This replaced an older design where the fetch only happened once per
browser session, gated by `sessionStorage`, and only fired from the login
form's submit handler — which meant a long-lived signed-in session (Supabase
persists auth tokens, so users rarely see the login form again) would never
get a fresh rate. The new design is keyed off a DB-persisted timestamp
instead of a browser-local flag, so it works the same regardless of how
long you've been signed in or which device you're on.

There is no server-side cron for this — it only runs when someone has the
app open. If you need the rate to update even when nobody's using the app
(e.g., for a nightly batch job), that would require a Supabase Edge
Function + Supabase Cron, which was considered and deliberately deferred
(no deploy pipeline for Edge Functions exists in this repo yet).

## 9. UI component library (`src/components/ui/index.tsx`)

One flat file exporting every shared primitive: `Card`, `StatCard`,
`Modal`, `FormField`, `Input`, `Select`, `Textarea`, `Button` (variants:
`primary | secondary | danger | ghost`), `Badge`, `ProgressBar`,
`EmptyState`, `PageHeader`, `ConfirmDialog`. There's no component library
dependency (no shadcn/Radix/MUI) — everything is hand-rolled Tailwind
markup. New UI patterns should be added here rather than inlined
per-page, to keep the visual language consistent.

Theming is CSS-variable-based (`src/index.css`): `.dark` and
`:root:not(.dark)` blocks define `--color-bg`, `--color-card`,
`--color-primary`, `--color-muted`, etc., and Tailwind utility classes like
`.bg-main`/`.text-primary`/`.card` are defined in `@layer components` to
read those variables. Theme toggling (`Layout.tsx`) just adds/removes the
`.dark` class on `document.documentElement` — there's no separate
Tailwind dark-mode config beyond `darkMode: 'class'` in
`tailwind.config.js`. The `safelist` in that config exists because
category/status colors (`CATEGORY_COLORS`, `STATUS_BADGE`, etc.) are
built from dynamic template strings, which Tailwind's content scanner can't
statically detect — if you add a new dynamic color, add its pattern to the
safelist or it'll be purged from the production build.

## 10. Error handling philosophy

Two independent error surfaces, both banner-style in `Layout.tsx`, both
auto-dismissing:
- **Auth errors** (`useAuthStore.error`) — shown inline on the `Auth` page
  itself (wrong password, etc.), not as a banner, since that page has no
  `Layout` wrapper.
- **Data write errors** (`useAppStore.lastError`) — the `writeThrough`
  pattern from §5.2. Every optimistic mutation reverts on failure and
  surfaces this banner. There is no retry mechanism — the user has to
  redo the action.

## 11. Known limitations (read before extending)

- **No automated tests.** No Vitest/Jest config, no `*.test.*` files. Any
  new business logic (especially currency math) should ideally get unit
  tests, but the tooling isn't set up yet.
- **IDs are not UUIDs.** `generateId()` (`utils/index.ts`) is
  `` `${Date.now()}-${Math.random().toString(36).substr(2, 9)}` `` — good
  enough for a single-user app with client-generated IDs, but don't assume
  global uniqueness across users/devices in future multi-tenant work.
- **Everything loads into memory at once.** `initialize()` fetches all
  rows for all 7 domain tables with no pagination. Fine today; revisit if
  a user's history grows into the thousands of rows.
- **No recurring transactions.** Rent/salary/subscriptions must be
  re-entered every month by hand.
- **Goals have no contribution ledger** — see §7.3.
- **The exchange-rate refresh is client-triggered only** — see §8.
- **`README.md` is stale** (describes a pre-Supabase, localStorage-only
  version). Prefer this document for anything architectural; the README
  should be treated as due for a rewrite (or already has been, if you're
  reading this after that cleanup — check its Data Storage / Tech Stack
  sections).
