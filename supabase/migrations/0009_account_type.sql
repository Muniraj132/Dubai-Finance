-- ============================================================
-- Add settings."accountType"
-- Run this ONCE in: Supabase Dashboard → SQL Editor
--
-- Why: this app originally assumed every user is a Dubai expat who needs
-- AED<->INR conversion everywhere. Some users are India-based and only
-- need INR, with no AED/Dubai-specific functionality shown. The choice is
-- captured once at registration (see src/pages/Auth.tsx) and stored here.
--
-- Additive + defaulted: every existing settings row (including accounts
-- that existed before this feature) becomes 'accountType' = 'dubai'
-- automatically, so current behavior for anyone who already has a row is
-- completely unchanged. No RLS change needed — the existing "own settings"
-- policy already covers every column on this table.
-- ============================================================

alter table settings add column if not exists "accountType" text not null default 'dubai';
