-- ============================================================
-- Investments module
-- Run this ONCE in: Supabase Dashboard → SQL Editor
--
-- Adds two tables, following the same parent (holding) + child
-- (ledger) shape as chit_funds/chit_installments:
--
--   investments             — one row per holding (a mutual fund,
--                              a stock, an FD, a PPF account, ...).
--                              "currentValue" is a manually-updated
--                              mark-to-market figure — there is no
--                              live price feed anywhere in this app,
--                              so this is the same manual-entry
--                              philosophy as gold_purchases' price.
--   investment_transactions — the Buy/SIP/Sell/Dividend ledger for
--                              a holding. Invested amount, total
--                              units, dividends received, and gain/
--                              loss are all derived client-side from
--                              this ledger (see computeInvestmentStats
--                              in src/utils/index.ts) — nothing here
--                              stores a redundant running total.
--
-- Both tables carry the same historical AED/INR snapshot columns as
-- every other amount-bearing table (see §7.1 of docs/ARCHITECTURE.md):
-- frozen at create/amount-edit time so a later exchange-rate change
-- never re-prices past records.
-- ============================================================

create table investments (
  id                 text primary key,
  user_id            uuid not null references auth.users(id) on delete cascade,
  type               text not null,
  name               text not null,
  currency           text not null,
  "currentValue"     numeric not null default 0,
  "maturityDate"     text,
  "interestRate"     numeric,
  status             text not null default 'active',
  notes              text default '',
  "createdAt"        text not null,
  -- Historical AED/INR snapshot of "currentValue", frozen at create/update time.
  "currentValueAed"  numeric,
  "currentValueInr"  numeric,
  "exchangeRateUsed" numeric
);

create table investment_transactions (
  id                 text primary key,
  user_id            uuid not null references auth.users(id) on delete cascade,
  investment_id      text not null references investments(id) on delete cascade,
  type               text not null,
  date               text not null,
  units              numeric,
  "pricePerUnit"     numeric,
  amount             numeric not null,
  currency           text not null,
  notes              text default '',
  "createdAt"        text not null,
  "amountAed"        numeric,
  "amountInr"        numeric,
  "exchangeRateUsed" numeric
);

create index investment_transactions_investment_id_idx on investment_transactions(investment_id);

alter table investments             enable row level security;
alter table investment_transactions enable row level security;

create policy "own investments"             on investments             for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own investment_transactions" on investment_transactions for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
