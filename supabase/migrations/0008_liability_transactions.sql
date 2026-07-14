-- ============================================================
-- Liability payment ledger
-- Run this ONCE in: Supabase Dashboard → SQL Editor
--
-- Adds a `status` column to `liabilities` and a `liability_transactions`
-- table (Charge/Payment ledger), following the exact parent (holding) +
-- child (ledger) shape as investments/investment_transactions (0004):
--
--   liabilities             — one row per debt. `balance` (added in 0007)
--                              now means the OPENING balance when the debt
--                              was first added, not a manually-maintained
--                              running total. Existing rows are unaffected
--                              by this reinterpretation since they have no
--                              transactions yet, so their current value
--                              still equals today's true outstanding amount.
--   liability_transactions  — Charge (new debt incurred) / Payment (cash
--                              paid toward it) ledger. A Payment's `amount`
--                              may include an interest portion
--                              ("interestAmount") that reduces cash but
--                              NOT the outstanding balance — only
--                              (amount - interestAmount) is principal.
--
-- Outstanding balance, principal paid, and interest paid are all derived
-- client-side from this ledger (see computeLiabilityStats in
-- src/utils/index.ts) — nothing here stores a redundant running total,
-- same philosophy as investments.
--
-- Purely additive: `status` defaults to 'active' for existing rows, and
-- the new table doesn't touch any existing row.
-- ============================================================

alter table liabilities add column if not exists "status" text not null default 'active';

create table liability_transactions (
  id                 text primary key,
  user_id            uuid not null references auth.users(id) on delete cascade,
  liability_id       text not null references liabilities(id) on delete cascade,
  type               text not null,
  date               text not null,
  amount             numeric not null,
  "interestAmount"   numeric,
  currency           text not null,
  notes              text default '',
  "createdAt"        text not null,
  "amountAed"        numeric,
  "amountInr"        numeric,
  "exchangeRateUsed" numeric
);

create index liability_transactions_liability_id_idx on liability_transactions(liability_id);

alter table liability_transactions enable row level security;

create policy "own liability_transactions" on liability_transactions for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
