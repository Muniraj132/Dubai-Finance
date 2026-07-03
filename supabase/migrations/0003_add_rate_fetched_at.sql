-- ============================================================
-- Add settings."rateFetchedAt"
-- Run this ONCE in: Supabase Dashboard → SQL Editor
--
-- Why: the AED→INR exchange rate was only ever refreshed once per
-- browser session, from the login form (see src/pages/Auth.tsx).
-- A long-lived signed-in session (Supabase persists auth tokens)
-- would never get a fresh rate again. This column lets the app
-- track when the rate was last fetched so it can refresh itself
-- on any app load once that gets stale (see
-- src/utils/exchangeRate.ts), independent of login events.
-- ============================================================

alter table settings add column if not exists "rateFetchedAt" text;
