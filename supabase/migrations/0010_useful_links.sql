-- ============================================================
-- Useful Links module
-- Run this ONCE in: Supabase Dashboard → SQL Editor
--
-- Adds a `useful_links` table: a personal bookmark list (bill payments,
-- bank logins, visa/insurance portals, etc.) so useful pages are kept
-- alongside the rest of the app's data instead of scattered across browser
-- bookmarks.
--
-- Purely additive: a new table, no changes to any existing table/row.
-- No amount columns, so none of the AED/INR snapshot columns other tables
-- carry. `url` is `text` (unbounded) so long query strings/tokens fit.
-- ============================================================

create table useful_links (
  id          text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  url         text not null,
  description text default '',
  "createdAt" text not null
);

alter table useful_links enable row level security;

create policy "own useful_links" on useful_links for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
