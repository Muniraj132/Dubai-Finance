# Dubai Finance Tracker — Architecture & Developer Guide

This document explains how the application is built, how data flows through
it, and the business rules behind each feature, in enough depth that a new
developer shouldn't need to ask "why does this work this way?" — the answer
should be here.

> Note: `README.md` at the repo root predates the Supabase migration and
> still describes a localStorage-only version. This document reflects the
> current codebase, which is backed by Supabase for auth and data storage.

## 1. What this app is

A personal finance tracker originally built for someone living/working in
Dubai (AED) while their financial life partly stays in India (INR), and now
also usable by India-based users who only need INR (see §7.12 for the
`accountType` distinction). It tracks expenses, income, savings goals, gold
purchases, monthly budgets, investments (mutual funds, stocks, ETFs, fixed
deposits, PPF, NPS, and other holdings — see §7.10), and "chit funds" (a
rotating-savings-and-credit scheme common in India — see §7.6), and, for
Dubai users, presents everything in both currencies.
Single-user-per-account: every table is scoped to `auth.uid()` via Postgres
Row Level Security, so it's effectively "your own private ledger," not a
shared household budget.

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
    ├── exchangeRate.ts       # Periodic AED→INR rate refresh (see §8)
    └── mfNav.ts              # Live Mutual Fund NAV lookup via mfapi.in (see §7.10)
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
| `/investments` | `Investments.tsx` | Investment holdings (list + detail, like Chit Funds) and their Buy/SIP/Sell/Dividend transaction ledger |
| `/liabilities` | `Liabilities.tsx` | Loans, credit cards, and other debts — list + detail (like Investments) with a Charge/Payment ledger, subtracted from Net Worth |
| `/analytics` | `Analytics.tsx` | Deeper charts: today's summary, best/worst months, all-time category breakdown, portfolio allocation |
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
`goldPurchases`, `chitFunds`, `chitInstallments`, `investments`,
`investmentTransactions`, `liabilities`, `settings`) plus `isLoading`,
`rateJustUpdated`, and `lastError`.

**Boot sequence**: `initialize()` (called once in `App.tsx` when `user`
becomes truthy) fires all 11 Supabase `select` queries in parallel via
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
- `0004_investments.sql` — adds `investments` + `investment_transactions` (§7.10).
- `0005_investment_scheme_code.sql` — adds `investments."schemeCode"` for live Mutual Fund NAV refresh (§7.10).
- `0006_investment_sip.sql` — adds SIP columns + a `pg_cron` job that auto-generates monthly SIP transactions (§7.10).
- `0007_liabilities.sql` — adds `liabilities` (loans, credit cards, other debts), so Net Worth can subtract what you owe (§7.11).
- `0008_liability_transactions.sql` — adds `liabilities."status"` and `liability_transactions` (a Charge/Payment ledger), so outstanding balance/principal paid/interest paid are derived instead of one manually-edited number (§7.11).
- `0009_account_type.sql` — adds `settings."accountType"` (`'dubai' | 'india'`), chosen once at registration (§7.12).

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
| `settings` | **one row per user**, `user_id` is the primary key | `aedToInrRate` (default 23), `dubaiArrivalDate`, `theme`, `currency`, `rateFetchedAt`, `accountType` (`'dubai'` default \| `'india'`, §7.12) |
| `chit_funds` | `name, total_amount, duration_months, organizer, start_date, end_date, status, received_amount, received_month_no, notes` | No `currency` column — always implicitly INR (see §7.6) |
| `chit_installments` | `chit_id (FK), month_no, due_date, amount, paid_amount, paid_date, payment_mode, status, remark` | Indexed on `chit_id`; deleting a chit fund cascades to its installments (`on delete cascade`, also mirrored in the optimistic client-side delete) |
| `investments` | `type, name, currency, currentValue, maturityDate, interestRate, schemeCode, sipEnabled, sipAmount, sipDay, sipLastRunDate, status, notes` + `currentValueAed/Inr, exchangeRateUsed` | `currentValue` is normally a manually-updated mark-to-market figure, *except* for Mutual Funds linked to an AMFI `schemeCode`, which can refresh it live (see §7.10); `maturityDate`/`interestRate` are only meaningful for Fixed Deposit/PPF/NPS; `sip*` columns drive the recurring-SIP cron job (see §7.10) — `sipLastRunDate` is server-maintained, never written by the client except as `null` on create |
| `investment_transactions` | `investment_id (FK), type, date, units, pricePerUnit, amount, currency, notes` + `amountAed/Inr, exchangeRateUsed` | Indexed on `investment_id`; deleting an investment cascades to its transactions, same pattern as chit installments. `units`/`pricePerUnit` are null for Dividend and for Fixed Deposit/PPF/NPS transactions |
| `liabilities` | `type, name, currency, balance, status, notes, createdAt` + `balanceAed/Inr, exchangeRateUsed` | `balance` is the *opening* balance when the debt was first added, not a running total — current outstanding amount is derived from `balance` + its `liability_transactions` ledger (§7.11), same parent+child shape as `investments`/`investment_transactions` |
| `liability_transactions` | `liability_id (FK), type, date, amount, interestAmount, currency, notes` + `amountAed/Inr, exchangeRateUsed` | Indexed on `liability_id`; deleting a liability cascades to its transactions. `type` is `Charge` (new debt, increases outstanding) or `Payment` (cash paid; `interestAmount` is the portion that's a cost, not principal — only `amount - interestAmount` reduces outstanding) |

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

`Reports.tsx` exports expenses/income/goals/investments/investment
transactions to CSV via `exportToCSV` in `utils/index.ts` (builds a CSV
string client-side, triggers a `Blob` download — no server round-trip).
Each export includes both the raw `amount`/`currency` as entered *and* the
resolved `AmountAED`/`AmountINR` columns, so exported data carries the same
historical accuracy as the UI.

### 7.9 Converter & Settings

`Converter.tsx` is a pure calculator (bidirectional AED⇄INR conversion,
quick-amount buttons, a salary reference table) — it reads/writes
`settings.aedToInrRate` but has no concept of "transactions." `Settings.tsx`
is the manual-override surface for the same rate, plus the Dubai arrival
date and theme. Both call `updateSettings` directly; neither goes through
`exchangeRate.ts` (that's only for the automatic periodic refresh, §8).

### 7.10 Investments

`Investments.tsx` follows the exact same list/detail shape as Chit Funds
(§7.6): a list view of holdings (`investments`) with portfolio-wide stat
cards, and a detail view per holding showing its transaction ledger
(`investment_transactions`), toggled by local `selectedId` state rather than
a separate route.

**Why two tables instead of one flat list like `gold_purchases`**: a gold
purchase is a fully self-contained fact (weight × price = value). An
investment isn't — a mutual fund position accumulates over many Buy/SIP
transactions, and its value moves independently of those transactions (NAV
changes even when you don't trade). So `investments` holds the "what do I
own, what's it worth today" state, and `investment_transactions` holds the
ledger of events that built it — the same parent (holding) / child (ledger)
split as `chit_funds`/`chit_installments`.

**`currentValue` is manually updated by default, not derived.** The "Update
Value" quick action on the detail page (mirroring Chit Fund's "Pay" quick
action) is the general-purpose way `currentValue` changes outside of
creating the investment — this is the only mechanism for Stocks, ETFs,
Fixed Deposits, PPF, and NPS, since there's no free live price source for
any of those that's callable directly from a browser (see below). Every
other figure — invested amount, units held, dividends received, gain/loss —
is derived client-side from the transaction ledger by
`computeInvestmentStats` / `computePortfolioStats` in `utils/index.ts`,
never stored as a redundant running total.

**Mutual Funds are the one exception: live NAV refresh via mfapi.in.**
[mfapi.in](https://www.mfapi.in) wraps the official AMFI daily NAV data as
free, CORS-open JSON — no API key, and (unlike e.g. Yahoo Finance's
unofficial endpoints, which return no CORS headers and get silently blocked
by the browser) it's directly `fetch()`-able from client code, the same way
`exchangeRate.ts` calls the AED/INR rate API (§8). `src/utils/mfNav.ts`
exposes two functions:
- `searchMfSchemes(query)` — hits `/mf/search?q=...`, used by a debounced
  autocomplete in the investment form so the user can find and link their
  fund's AMFI scheme code (stored as `investments.schemeCode`). Only shown
  when `type === 'Mutual Fund'`; a fund doesn't have to be linked — it's an
  opt-in that unlocks the refresh action, not a requirement to add one.
- `fetchLatestNav(schemeCode)` — hits `/mf/{schemeCode}`, returns the most
  recent NAV entry.

The "Refresh NAV" action (per-holding on the detail page, or "Refresh NAVs"
in bulk from the list page, looping over every linked Mutual Fund) computes
`currentValue = totalUnits × latestNav`, where `totalUnits` comes from
`computeInvestmentStats` (the Buy/SIP/Sell ledger) and `latestNav` is always
in INR (AMFI only prices Indian funds) — converted to AED via
`convertToAED` first if the holding's `currency` is AED — then calls
`updateInvestment` exactly like a manual edit would, so the usual
`currentValueAed`/`currentValueInr`/`exchangeRateUsed` snapshot logic
applies unchanged. If a fund has zero units held (no Buy/SIP recorded yet),
refresh is a silent no-op rather than zeroing out whatever value was there.

**The four transaction types cover both market and fixed-income
instruments** by design: for Mutual Funds/Stocks/ETFs, `units`/`pricePerUnit`
are set and Buy/SIP add to the unit count while Sell reduces it. For Fixed
Deposits/PPF/NPS (no units), `units`/`pricePerUnit` are null and the same
four types map onto real-world behavior instead: Buy = initial deposit, SIP
= a recurring contribution (this is literally how PPF/NPS contributions
work), Sell = withdrawal/premature closure, Dividend = interest credited.
`Investment.maturityDate`/`interestRate` are informational-only fields shown
for these fixed-income types, not used in any calculation.

**Historical snapshot pattern (§7.1)** applies to both tables: every
transaction's `amount` gets `amountAed`/`amountInr`/`exchangeRateUsed`
frozen at create/amount-edit time, and `investments.currentValue` gets its
own `currentValueAed`/`currentValueInr`/`exchangeRateUsed` snapshot,
recomputed only when `currentValue` or `currency` changes — the same rule
Goals apply to `currentAmount`.

**Feeds Net Worth and other aggregates.** `Dashboard.tsx` computes Net Worth
via `computeNetWorth` (`utils/index.ts`) — see §7.11 for the full model,
including why it's *not* simply "savings + gold + investments." `DubaiLife.tsx`'s
lifetime-aggregate section and `Analytics.tsx`'s portfolio allocation
chart both read through `computePortfolioStats` the same way.

**SIP card and filter tabs.** The list view has a "SIP Total" stat card
(`computeSipStats`: the sum of the frozen INR values of SIP holdings' `SIP` transactions,
plus a "N active · ₹X/mo" sub-line for active auto-SIPs, converted at
today's rate since it's a forward-looking commitment, not a record). The list
view's All / SIP / Other Investments tabs filter holdings: a holding counts as
SIP (`isSipHolding`) only when `sipEnabled` is on, which matches the
"SIP · Day N" badge. A SIP transaction logged by hand on a PPF or lumpsum
fund keeps that holding under Other Investments. The detail ledger's
All / SIP / Buy·Sell·Dividend tabs filter by transaction type. The other
stat cards always show the whole portfolio, whichever tab is selected.

**SIP automation is the one place this app runs code outside the browser.**
Every other periodic thing in this app (the exchange rate, live NAV) is
"check staleness and act, but only when someone has the app open." A real
SIP needs to fire on its date *even if the app is never opened that month*,
which client code fundamentally cannot do. Since this app has no server of
its own and no Edge Function deploy pipeline (§2, §8), the only piece of
infrastructure available for genuine background execution is Postgres
itself — so `0006_investment_sip.sql` enables the `pg_cron` extension and
schedules one daily job (`run_sip_investments()`, 00:10 UTC) that scans
every user's `investments` for `sipEnabled = true` rows whose `sipDay`
matches today and inserts a SIP transaction for each:

- **One job for all users, not one per investment.** The function loops
  over every matching row in a single run rather than scheduling/cancelling
  a `pg_cron` job per investment — turning `sipEnabled` off just removes
  that row from next run's `where` clause. No separate "cancel the
  schedule" step exists or is needed.
- **`sipLastRunDate` is an idempotency guard, not just a timestamp.** It
  blocks the same investment from firing twice if the job somehow runs
  twice in a day. The transaction `id` (`'sip-' || investment_id || '-' ||
  yyyymmdd`) is a second, independent idempotency key via `on conflict do
  nothing` — belt and suspenders, since this is the one code path in the
  app where a duplicate write can't be caught by the human clicking Save
  twice (§ Button double-submit guard, `components/ui/index.tsx`).
- **Auto-generated SIP transactions never set `units`/`pricePerUnit`, even
  for a scheme-linked Mutual Fund.** Fetching today's NAV from inside the
  cron job would mean an HTTP call from Postgres (via the `pg_net`
  extension), which is an inherently two-phase async pattern in plain SQL.
  That's meaningfully more fragile than just recording the cash amount —
  same shape as an FD/PPF/NPS transaction — and letting unit-level
  precision stay a manual/client-side concern (edit the generated
  transaction afterward if you want units recorded on it).
- **Bypasses RLS by necessity.** The function is `security definer` and
  reads/writes across every user's rows in one pass — a scheduled job has
  no "current user" to scope `auth.uid()` to. This is the one deliberate
  exception to the per-user RLS model in §1/§6; every other query in this
  app is scoped to the signed-in user.
- **Depends on `pg_cron` being enabled on the Supabase project**, which can
  vary by plan/region — this could not be verified without access to the
  live project. The migration file's header comments explain how to check
  and how to test the function directly (`select run_sip_investments();`)
  without waiting for the schedule to fire.

### 7.11 The financial model: Income, Living Expenses, Investments, Chit Funds, Liabilities

**The core rule: investing is converting cash into a different asset, not
spending it.** Money that leaves the bank account to buy stocks, mutual
funds, gold, an FD, etc. must never be counted as an expense, and must never
just "disappear" from savings either — it's still yours, in a different
form.

This app already stores investments (`investments`/`investment_transactions`)
and gold (`gold_purchases`) in their own tables, separate from `expenses` —
so `expenses` has only ever contained real living-expense categories
(`EXPENSE_CATEGORIES`, §7.2). The bug this section fixes wasn't "investments
counted as expenses" (they weren't), it was that **Net Worth never
subtracted the cash that left the bank to fund those purchases**, so it
double-counted: once as cash still sitting there, and again as the asset it
became. That inflated Net Worth by the full cost basis of everything ever
invested (masked whenever gains happened to roughly offset it).

**Paying down debt is the same idea as investing — converting cash into a
reduced liability, not spending it.** Only the *interest* portion of a debt
payment is a genuine cost. This matters because "just lower the liability's
balance when you pay it off" silently inflates Net Worth: the liability
shrinks but nothing records that the cash actually left the bank, so the
same money would appear to still be sitting there *and* to have paid off the
debt. `liability_transactions` (a Charge/Payment ledger, added in
`0008_liability_transactions.sql`) exists specifically to close this gap —
see below.

Functions in `utils/index.ts` are the single source of truth for this model
— every page that shows Income/Expenses/Investments/Liabilities/Savings/Net
Worth should compute through them rather than re-deriving totals inline:

- **`computeFinancialSummary({ income, incomeInr, livingExpenses,
  livingExpensesInr, investments, investmentsInr, chitContributions?,
  chitContributionsInr?, debtPrincipalPaid?, debtPrincipalPaidInr?,
  debtInterest?, debtInterestInr? })`** — for a given period (a month, or
  all-time), returns `{ livingExpenses, investments, chitContributions,
  debtPrincipalPaid, debtInterest, cashRemaining, totalSaved, savingsRate }`
  where:
  - `cashRemaining = income - livingExpenses - investments -
    chitContributions - debtInterest - debtPrincipalPaid`
  - `totalSaved = investments + chitContributions + debtPrincipalPaid +
    cashRemaining` (this always equals `income - livingExpenses -
    debtInterest`, algebraically — it's computed via its components anyway
    so the breakdown stays visible)
  - `savingsRate = totalSaved / income × 100`
  - `investments` for a period comes from `computeInvestmentCashFlow`
    (Buy/SIP pull cash out, Sell/Dividend put cash back in) plus
    `computeGoldCashFlow` (gold has no live price feed, so its cost basis
    doubles as its current value) — never from the `expenses` table.
  - `chitContributions` for a period comes from `computeChitCashFlow` over
    that period's `chit_installments` (summed by `paid_date`) — a chit
    contribution is a pooled forced-savings payment, not spending, so it's
    excluded from `livingExpenses` the same way an investment is.
  - `debtPrincipalPaid`/`debtInterest` for a period come from
    `computeDebtCashFlow` over that period's `liability_transactions` —
    `Charge` rows are excluded (no cash moves on a charge; it just increases
    what you owe, see below), `Payment` rows split into principal
    (`amount - interestAmount`, "saved") and interest (a real cost).
- **`computeNetWorth({ allTimeIncome, allTimeLivingExpenses, investedCash,
  investmentsValue, debtPrincipalPaid, debtInterestPaid,
  liabilitiesOutstanding, ... })`** — `cash = allTimeIncome -
  allTimeLivingExpenses - investedCash - debtPrincipalPaid -
  debtInterestPaid` (cash on hand net of every dirham/rupee ever pulled out
  for investments/gold/chit contributions *or* to pay down a debt, principal
  and interest both), then `netWorth = cash + investmentsValue -
  liabilitiesOutstanding`. `investmentsValue` is current mark-to-market
  (investments' `currentValue` + gold's cost basis); `investedCash` is the
  all-time cost basis pulled out of cash for both; `liabilitiesOutstanding`
  comes from `computePortfolioLiabilityStats` (below). Chit funds fold into
  this same `investedCash`/`investmentsValue` pair rather than getting their
  own parameters — see below for why that's exactly right, not a shortcut.

`Dashboard.tsx` is the primary consumer: its stat grid shows Income, Living
Expenses, Investments, Cash Remaining, Chit Contributions, Debt Paid Down,
Total Saved, Savings Rate, and Net Worth, all period-scoped (except Net
Worth, always all-time) via the month selector. `DubaiLife.tsx`'s "Total
Saved" stat uses the same underlying math (pre-existing — its
`totalEarnings - totalExpenses` was already numerically equal to
`totalSaved`, just mislabeled "Total Savings"; it doesn't yet account for
debt or chit funds, since that page predates both).

**Chit funds** (§7.6) are a pooled forced-savings scheme from the user's
perspective — money paid in isn't spent, it's converted into a claim on a
future (or already-received) lump-sum payout. `computeChitCashFlow`
(period-scoped, sums `chit_installments.paid_amount` by `paid_date`) feeds
the period breakdown exactly like an investment contribution. For Net
Worth, `computeChitNetValue` computes one all-time figure per chit — total
paid in, minus any `received_amount` already paid out — and that single
number does double duty: it's *both* the cash that left the bank (folded
into `investedCash`) *and* the current value of what you're owed (folded
into `investmentsValue`), the same way gold's cost basis doubles as its
value, since chit funds have no separate market value in this app either.
This can go negative once a payout is received early (you've been paid more
than you've contributed so far) — correctly acting like debt for the
installments still owed, without needing a separate liability entry.
Because these two foldings are identical in magnitude, chit funds
mathematically have **zero net effect on the Net Worth total** as long as
no gain/loss is ever modeled for them (it isn't) — the value only shows up
in the period breakdown (Chit Contributions, Cash Remaining, Total Saved),
not in whether the all-time Net Worth number moves. A known gap: a payout's
exact receipt date isn't tracked (`chit_funds.received_month_no` is an
installment index, not a calendar date), so `computeChitNetValue` is
all-time only — a payout received mid-year won't show up as a cash windfall
in that month's Cash Remaining.

**Liabilities** (`liabilities` + `liability_transactions` tables,
`/liabilities` page) follow the exact same parent (holding) + child (ledger)
shape as Investments (§7.10): `liabilities.balance` is the *opening* balance
when a debt was first added — an anchor point, not a running total — and
everything else (outstanding balance, principal paid, interest paid, total
charged) is derived client-side from the ledger by `computeLiabilityStats`
/ `computePortfolioLiabilityStats`, exactly the way `computeInvestmentStats`
derives invested-amount from `investment_transactions`.

- **`Charge`** — new debt incurred (a credit card purchase, drawing down a
  loan further). Increases outstanding balance; no cash moves yet, so it
  doesn't appear in any cash-flow figure — Net Worth drops immediately
  though, since `liabilitiesOutstanding` rises while nothing on the asset
  side changes (correctly modeling "you consumed something worth this much
  without paying for it yet").
- **`Payment`** — cash paid toward a debt. `amount` is the total paid;
  `interestAmount` (optional) is the portion that's interest — only
  `amount - interestAmount` (the principal) reduces the outstanding
  balance. Both portions reduce cash on hand (via `computeDebtCashFlow`),
  which is what keeps Net Worth from inflating when you pay off debt.
- A liability's `status` (`active`/`closed`) is manual, set via "Mark as
  Paid Off" on the detail page — same manual-status philosophy as
  `investments.status`, not auto-derived from outstanding balance reaching
  zero.

**Deliberately out of scope**: a multi-account/wallet model and Transfer
transactions (Bank↔Wallet, AED↔INR account). This app has no concept of
"which account" a transaction belongs to today (only a `currency`), and
Transfers only matter once multiple accounts exist — a materially bigger
feature than this fix required.

### 7.12 Account type: Dubai vs. India users

This app was originally built for one persona (Indian expat in Dubai,
AED+INR everywhere). Some users are India-based and only need INR, with none
of the Dubai/AED machinery — `settings.accountType` (`'dubai' | 'india'`,
`0009_account_type.sql`) captures which, chosen once via a radio button at
registration (`src/pages/Auth.tsx`) and never editable afterward (switching
would mean relabeling existing AED records, which is out of scope).

**How the choice reaches the database without a Postgres trigger.** This
project has no server code of its own (§2), so instead of an
`on_auth_user_created` trigger, `useAuthStore.signUp` passes the chosen
`accountType` as Supabase Auth signup metadata
(`options.data.accountType`) — set immediately, even before email
confirmation. `useAppStore.initialize()` reads it back on the very first
load: if no `settings` row exists yet for this user, one is created
immediately with the right `accountType` (rather than waiting for whatever
else happens to call `updateSettings` first, e.g. the exchange-rate
refresh in §8). Every *pre-existing* settings row (including accounts that
existed before this feature shipped) gets `accountType = 'dubai'` for free,
from the migration's column default — no seeding logic needed for those.

**Nothing about currency math changed.** Every calculation function in
`src/utils/index.ts` (§7.1, §7.11) already branches on each record's own
`currency` field and uses the raw amount whenever `currency === 'INR'` — an
India user's records are always `currency: 'INR'`, so those functions
produce correct figures with zero modification. This feature is UI-gating
only: a shared hook, `useIsDubai()` (`src/hooks/index.ts`), is `false` for
`accountType === 'india'`, and every page reads it to:

- Hide the AED/INR currency `<Select>` in every form (Expenses, Income,
  Goals, Gold Tracker, Budget Planner, Investments, Liabilities) and default
  new records to `currency: 'INR'` instead of `'AED'`.
- Suppress the "≈ AED X" secondary figure shown next to INR totals
  everywhere (Dashboard, Analytics, Investments, Liabilities, Gold Tracker,
  Budget Planner, Income) and drop the `AmountAED`-style columns from CSV
  exports (`Reports.tsx`).
- Hide `/converter` and `/dubai-life` from the sidebar entirely (both pages
  also self-guard with a redirect to `/`, in case of direct URL navigation)
  and skip the exchange-rate auto-refresh network call (§8) — there's
  nothing for an India user to convert.
- Hide the Exchange Rate / Dubai Journey cards in Settings.

**`Budget Planner` is the one place internal math (not just display)
changes.** It used to normalize every figure to AED via `resolveAed` purely
to compare budget vs. spend — for an India user that would show a
rate-divided, meaningless AED-denominated number. It now normalizes to
whichever currency matches the account type (`resolveAed` for Dubai,
`resolveInr` for India) via a small local `nativeValue`/`formatNative`
helper in `BudgetPlanner.tsx`.

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
`EmptyState`, `PageHeader`, `ConfirmDialog`, `FilterTabs` (a segmented
tab control with optional per-tab counts). There's no component library
dependency (no shadcn/Radix/MUI) — everything is hand-rolled Tailwind
markup. New UI patterns should be added here rather than inlined
per-page, to keep the visual language consistent.

`Button` auto-guards against double-submit: it detects when its `onClick`
returns a Promise and disables itself for the duration. Nearly every
Save/Add/Update handler in this app is `async` and `await`s a Supabase
write before closing its modal (the `writeThrough` pattern, §5.2) — on a
slow connection that's a multi-second window where, without this guard, a
fast double-click would fire the handler twice and create two records.
Fixing it once in `Button` covers every page automatically; no per-page
loading-state boilerplate is needed or should be added.

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
  rows for all 9 domain tables with no pagination. Fine today; revisit if
  a user's history grows into the thousands of rows.
- **No recurring transactions, except Mutual Fund SIPs (§7.10).** Rent,
  salary, subscriptions, and any other investment type still have to be
  re-entered every month by hand — SIP is the one exception, and only
  because it's backed by a `pg_cron` job in Postgres, not client code.
- **Goals have no contribution ledger** — see §7.3.
- **Only Mutual Funds have a live price feed.** Stocks, ETFs, Fixed
  Deposits, PPF, and NPS all rely on the manually-updated `currentValue`
  (§7.10) — there's no free market-data source for those that's callable
  directly from a browser (Yahoo Finance's unofficial endpoints, the usual
  free option, don't send CORS headers, so the browser blocks the request).
  Adding live Stock/ETF prices would need a small serverless proxy (a
  Vercel function or Supabase Edge Function) in front of a provider like
  that — deliberately deferred for the same reason the exchange-rate cron
  was (§8): no server-side deploy pipeline exists in this repo yet.
- **SIP automation depends on `pg_cron` being enabled on the Supabase
  project**, and hasn't been verified against a live project (§7.10) — test
  it via `select run_sip_investments();` in the SQL Editor after applying
  `0006_investment_sip.sql`. Auto-generated SIP transactions also never
  carry `units`/`pricePerUnit`, even for a scheme-linked fund, so they
  don't contribute to the "Units Held" stat — a deliberate simplicity
  tradeoff, not a bug (see §7.10 for why).
- **Liability payments don't auto-split into principal/interest.** A
  `Payment` transaction's `interestAmount` is entered by hand (from your
  statement) — there's no amortization schedule computed for you the way a
  bank would. Fine for "what do I currently owe and what has interest cost
  me," not a full loan calculator.
- **No multi-account/wallet model or Transfers.** Every transaction has a
  `currency` but not an "account" — so moving cash between a bank account and
  a wallet, or between an AED and INR account, isn't representable. This is
  a deliberate scope boundary (§7.11), not an oversight.
- **The exchange-rate refresh is client-triggered only** — see §8.
- **`README.md` is stale** (describes a pre-Supabase, localStorage-only
  version). Prefer this document for anything architectural; the README
  should be treated as due for a rewrite (or already has been, if you're
  reading this after that cleanup — check its Data Storage / Tech Stack
  sections).
