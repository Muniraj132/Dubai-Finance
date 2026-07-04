-- ============================================================
-- Add investments."schemeCode"
-- Run this ONCE in: Supabase Dashboard → SQL Editor
--
-- Why: live NAV refresh for Mutual Fund holdings (see
-- src/utils/mfNav.ts) looks up the fund by its AMFI scheme code via
-- mfapi.in, a free, CORS-open wrapper around the official AMFI daily
-- NAV data. Only Mutual Fund investments the user has explicitly
-- linked to a scheme have this set — everything else (Stock, ETF,
-- Fixed Deposit, PPF, NPS, Other) has no live price source and stays null.
-- ============================================================

alter table investments add column if not exists "schemeCode" integer;
