-- ============================================================
-- Liabilities module
-- Run this ONCE in: Supabase Dashboard → SQL Editor
--
-- Adds a `liabilities` table (loans, credit card balances, other debts).
-- Net Worth was previously assets-only (see docs/ARCHITECTURE.md §11) —
-- this lets it subtract what you owe, as a real net worth should.
--
-- Purely additive: a new table, no changes to any existing table/row.
-- Follows the same historical AED/INR snapshot pattern as every other
-- amount-bearing table (§7.1 of docs/ARCHITECTURE.md): "balance" is frozen
-- into balanceAed/balanceInr/exchangeRateUsed at create/update time, so a
-- later exchange-rate change never re-prices a past balance snapshot.
-- ============================================================

create table liabilities (
  id                 text primary key,
  user_id            uuid not null references auth.users(id) on delete cascade,
  type               text not null,
  name               text not null,
  currency           text not null,
  balance            numeric not null default 0,
  notes              text default '',
  "createdAt"        text not null,
  "balanceAed"       numeric,
  "balanceInr"       numeric,
  "exchangeRateUsed" numeric
);

alter table liabilities enable row level security;

create policy "own liabilities" on liabilities for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
