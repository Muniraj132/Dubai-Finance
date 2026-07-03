-- ============================================================
-- Historical AED/INR snapshot migration
-- Run this ONCE in: Supabase Dashboard → SQL Editor
--
-- Non-destructive: only ADDs columns and backfills NULLs.
-- Safe to re-run — every backfill UPDATE is guarded by
-- "... is null", so already-populated rows are never touched.
--
-- Why: settings."aedToInrRate" is a single mutable value with no
-- history. Every past expense/income/goal/budget/gold purchase
-- was displayed by re-converting its amount with *today's* rate,
-- so editing the rate silently re-priced historical records.
-- These columns freeze the AED/INR value (and the rate used) at
-- the moment each record was created or last had its amount
-- edited, so historical figures stop moving once written.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Add columns (idempotent)
-- ------------------------------------------------------------

alter table expenses       add column if not exists "amountAed" numeric;
alter table expenses       add column if not exists "amountInr" numeric;
alter table expenses       add column if not exists "exchangeRateUsed" numeric;

alter table incomes        add column if not exists "amountAed" numeric;
alter table incomes        add column if not exists "amountInr" numeric;
alter table incomes        add column if not exists "exchangeRateUsed" numeric;

alter table budgets        add column if not exists "amountAed" numeric;
alter table budgets        add column if not exists "amountInr" numeric;
alter table budgets        add column if not exists "exchangeRateUsed" numeric;

alter table gold_purchases add column if not exists "totalValueAed" numeric;
alter table gold_purchases add column if not exists "totalValueInr" numeric;
alter table gold_purchases add column if not exists "exchangeRateUsed" numeric;

alter table goals          add column if not exists "targetAmountAed" numeric;
alter table goals          add column if not exists "targetAmountInr" numeric;
alter table goals          add column if not exists "currentAmountAed" numeric;
alter table goals          add column if not exists "currentAmountInr" numeric;
alter table goals          add column if not exists "exchangeRateUsed" numeric;

-- ------------------------------------------------------------
-- 2. Backfill existing NULL rows using each owner's current
--    settings."aedToInrRate" (falls back to the app default of
--    23 if a user somehow has no settings row). This is an
--    approximation for pre-existing data — the true historical
--    rate at the time of each old transaction is not recoverable.
-- ------------------------------------------------------------

update expenses e
set
  "exchangeRateUsed" = coalesce(s."aedToInrRate", 23),
  "amountAed" = case when e.currency = 'AED' then e.amount else e.amount / coalesce(s."aedToInrRate", 23) end,
  "amountInr" = case when e.currency = 'INR' then e.amount else e.amount * coalesce(s."aedToInrRate", 23) end
from settings s
where s.user_id = e.user_id and e."amountInr" is null;

update expenses
set
  "exchangeRateUsed" = 23,
  "amountAed" = case when currency = 'AED' then amount else amount / 23 end,
  "amountInr" = case when currency = 'INR' then amount else amount * 23 end
where "amountInr" is null;

update incomes i
set
  "exchangeRateUsed" = coalesce(s."aedToInrRate", 23),
  "amountAed" = case when i.currency = 'AED' then i.amount else i.amount / coalesce(s."aedToInrRate", 23) end,
  "amountInr" = case when i.currency = 'INR' then i.amount else i.amount * coalesce(s."aedToInrRate", 23) end
from settings s
where s.user_id = i.user_id and i."amountInr" is null;

update incomes
set
  "exchangeRateUsed" = 23,
  "amountAed" = case when currency = 'AED' then amount else amount / 23 end,
  "amountInr" = case when currency = 'INR' then amount else amount * 23 end
where "amountInr" is null;

update budgets b
set
  "exchangeRateUsed" = coalesce(s."aedToInrRate", 23),
  "amountAed" = case when b.currency = 'AED' then b.amount else b.amount / coalesce(s."aedToInrRate", 23) end,
  "amountInr" = case when b.currency = 'INR' then b.amount else b.amount * coalesce(s."aedToInrRate", 23) end
from settings s
where s.user_id = b.user_id and b."amountInr" is null;

update budgets
set
  "exchangeRateUsed" = 23,
  "amountAed" = case when currency = 'AED' then amount else amount / 23 end,
  "amountInr" = case when currency = 'INR' then amount else amount * 23 end
where "amountInr" is null;

update gold_purchases g
set
  "exchangeRateUsed" = coalesce(s."aedToInrRate", 23),
  "totalValueAed" = case when g.currency = 'AED'
    then g."weightGrams" * g."pricePerGram"
    else (g."weightGrams" * g."pricePerGram") / coalesce(s."aedToInrRate", 23) end,
  "totalValueInr" = case when g.currency = 'INR'
    then g."weightGrams" * g."pricePerGram"
    else (g."weightGrams" * g."pricePerGram") * coalesce(s."aedToInrRate", 23) end
from settings s
where s.user_id = g.user_id and g."totalValueInr" is null;

update gold_purchases
set
  "exchangeRateUsed" = 23,
  "totalValueAed" = case when currency = 'AED' then "weightGrams" * "pricePerGram" else ("weightGrams" * "pricePerGram") / 23 end,
  "totalValueInr" = case when currency = 'INR' then "weightGrams" * "pricePerGram" else ("weightGrams" * "pricePerGram") * 23 end
where "totalValueInr" is null;

update goals g
set
  "exchangeRateUsed" = coalesce(s."aedToInrRate", 23),
  "targetAmountAed" = case when g.currency = 'AED' then g."targetAmount" else g."targetAmount" / coalesce(s."aedToInrRate", 23) end,
  "targetAmountInr" = case when g.currency = 'INR' then g."targetAmount" else g."targetAmount" * coalesce(s."aedToInrRate", 23) end,
  "currentAmountAed" = case when g.currency = 'AED' then g."currentAmount" else g."currentAmount" / coalesce(s."aedToInrRate", 23) end,
  "currentAmountInr" = case when g.currency = 'INR' then g."currentAmount" else g."currentAmount" * coalesce(s."aedToInrRate", 23) end
from settings s
where s.user_id = g.user_id and g."targetAmountInr" is null;

update goals
set
  "exchangeRateUsed" = 23,
  "targetAmountAed" = case when currency = 'AED' then "targetAmount" else "targetAmount" / 23 end,
  "targetAmountInr" = case when currency = 'INR' then "targetAmount" else "targetAmount" * 23 end,
  "currentAmountAed" = case when currency = 'AED' then "currentAmount" else "currentAmount" / 23 end,
  "currentAmountInr" = case when currency = 'INR' then "currentAmount" else "currentAmount" * 23 end
where "targetAmountInr" is null;
