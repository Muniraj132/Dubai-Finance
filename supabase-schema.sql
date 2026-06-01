-- ============================================================
-- Dubai Finance Tracker — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor
--
-- If you already ran the old schema, run the DROP statements
-- first to start fresh, then run CREATE + RLS sections.
-- ============================================================

-- Drop old tables (safe to skip if this is a fresh install)
drop table if exists settings;
drop table if exists gold_purchases;
drop table if exists budgets;
drop table if exists goals;
drop table if exists incomes;
drop table if exists expenses;

-- ============================================================
-- Tables
-- ============================================================

create table expenses (
  id          text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        text not null,
  amount      numeric not null,
  currency    text not null,
  category    text not null,
  notes       text default '',
  "createdAt" text not null
);

create table incomes (
  id          text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        text not null,
  amount      numeric not null,
  currency    text not null,
  source      text not null,
  notes       text default '',
  "createdAt" text not null
);

create table goals (
  id              text primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  "targetAmount"  numeric not null,
  "currentAmount" numeric not null default 0,
  "targetDate"    text not null,
  currency        text not null,
  color           text not null,
  "createdAt"     text not null
);

create table budgets (
  id       text primary key,
  user_id  uuid not null references auth.users(id) on delete cascade,
  month    text not null,
  category text not null,
  amount   numeric not null,
  currency text not null
);

create table gold_purchases (
  id             text primary key,
  user_id        uuid not null references auth.users(id) on delete cascade,
  date           text not null,
  "weightGrams"  numeric not null,
  "pricePerGram" numeric not null,
  currency       text not null,
  notes          text default '',
  "createdAt"    text not null
);

-- One settings row per user (user_id is the primary key)
create table settings (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  "aedToInrRate"   numeric not null default 23,
  "dubaiArrivalDate" text not null default '',
  theme            text not null default 'dark',
  currency         text not null default 'AED'
);

-- ============================================================
-- Row Level Security — each user sees only their own data
-- ============================================================

alter table expenses      enable row level security;
alter table incomes       enable row level security;
alter table goals         enable row level security;
alter table budgets       enable row level security;
alter table gold_purchases enable row level security;
alter table settings      enable row level security;

create policy "own expenses"       on expenses       for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own incomes"        on incomes        for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own goals"          on goals          for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own budgets"        on budgets        for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own gold_purchases" on gold_purchases for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own settings"       on settings       for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
