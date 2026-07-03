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
