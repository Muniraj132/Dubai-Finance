# Database migrations

This project has no Supabase CLI project linked — schema changes are applied
by hand in the Supabase Dashboard's SQL Editor. This folder replaces the old
single mutable `supabase-schema.sql` with a sequence of numbered files, so
there's a record of what changed and when.

## Convention

- Files are named `NNNN_description.sql`, numbered in the order they must be
  applied (`0001_...`, `0002_...`, ...).
- **Never edit an already-applied migration.** If you need to change the
  schema, add a new file with the next number.
- Setting up a brand-new project: run every file in this folder in order.
- Upgrading an existing project: run only the files with a number higher than
  the last one you've already applied.
- Migrations here are written to be safe to re-run (`add column if not
  exists`, backfills guarded by `where ... is null`), but that's a safety
  net, not a substitute for tracking what you've already run.

## Current migrations

| File | Purpose |
|---|---|
| `0001_initial_schema.sql` | Base schema: `expenses`, `incomes`, `goals`, `budgets`, `gold_purchases`, `settings`, `chit_funds`, `chit_installments`, RLS policies. Includes the historical AED/INR snapshot columns already merged in for fresh installs. |
| `0002_historical_currency_snapshot.sql` | Adds the AED/INR/exchange-rate snapshot columns to an *existing* database (non-destructive `alter table` + one-time backfill) and is only needed if your database predates `0001` including them. |
| `0003_add_rate_fetched_at.sql` | Adds `settings."rateFetchedAt"`, used to refresh the exchange rate periodically instead of only once per login (see `src/utils/exchangeRate.ts`). |
| `0004_investments.sql` | Adds `investments` (one row per holding — mutual fund, stock, ETF, fixed deposit, PPF, NPS, other) and `investment_transactions` (its Buy/SIP/Sell/Dividend ledger), following the same parent+child shape as `chit_funds`/`chit_installments`, plus the historical AED/INR snapshot columns from `0002`. |
| `0005_investment_scheme_code.sql` | Adds `investments."schemeCode"`, the AMFI scheme code used to refresh a Mutual Fund holding's NAV live from mfapi.in (see `src/utils/mfNav.ts`). Null for everything that isn't a scheme-linked Mutual Fund. |
| `0006_investment_sip.sql` | Adds SIP columns (`sipEnabled`, `sipAmount`, `sipDay`, `sipLastRunDate`) plus a `pg_cron`-scheduled Postgres function that auto-inserts a SIP transaction monthly. **Requires the `pg_cron` extension enabled on your project** (Dashboard → Database → Extensions) — see the comments at the top of the file for how to verify it worked without waiting a full day. |
| `0007_liabilities.sql` | Adds `liabilities` (loans, credit card balances, other debts), following the same historical AED/INR snapshot pattern as every other amount table. Lets Net Worth subtract what you owe instead of being assets-only. Purely additive — no existing table is touched. |
| `0008_liability_transactions.sql` | Adds `liabilities."status"` and `liability_transactions` (a Charge/Payment ledger, same parent+child shape as investments/investment_transactions). Outstanding balance, principal paid, and interest paid are now derived from this ledger instead of a single manually-edited number. Additive — existing `liabilities` rows keep working unchanged (their `balance` is read as the opening balance, which equals today's true outstanding amount for any row with no transactions logged yet). |

## Upgrading to the real Supabase CLI later

If you want proper migration tracking/diffing against the live database
instead of manual copy-paste:

```
supabase init            # point it at this existing supabase/ folder
supabase link            # link to your project
supabase migration list  # reconcile against what's already applied here
```

From then on, use `supabase migration new <name>` to create new files in this
same folder, and `supabase db push` to apply them.
