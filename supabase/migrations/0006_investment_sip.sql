-- ============================================================
-- SIP (recurring monthly investment) automation
-- Run this ONCE in: Supabase Dashboard → SQL Editor
--
-- This app has no server of its own (see docs/ARCHITECTURE.md §2) — the
-- only way to run something on a schedule independent of whether the
-- app is open is inside Postgres itself, via the pg_cron extension.
-- That's what this migration sets up: one daily cron job, shared across
-- every user, that scans for investments with sipEnabled = true whose
-- sipDay matches today and inserts a SIP transaction for each.
--
-- PREREQUISITE — please check before assuming this works:
-- pg_cron must be enabled for your Supabase project (Dashboard →
-- Database → Extensions → search "pg_cron" → Enable). Availability can
-- depend on your project's plan/region; if `create extension pg_cron`
-- below fails, enable it from the Extensions page first and re-run just
-- that one line.
--
-- HOW TO TEST after applying this: set some investment's "sipDay" to
-- today's day-of-month, then run `select run_sip_investments();`
-- directly in the SQL Editor — it should insert one SIP transaction
-- immediately, and "sipLastRunDate" should update. That confirms the
-- function works without waiting a full day for the cron schedule.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Columns (idempotent)
-- ------------------------------------------------------------

alter table investments add column if not exists "sipEnabled" boolean not null default false;
alter table investments add column if not exists "sipAmount" numeric;
alter table investments add column if not exists "sipDay" integer;
alter table investments add column if not exists "sipLastRunDate" text;

-- ------------------------------------------------------------
-- 2. The scheduled function
--
-- Deliberately does NOT record units/pricePerUnit (they're left null,
-- same shape as a Fixed Deposit/PPF/NPS transaction — see §7.10) even
-- for Mutual Funds linked to a live NAV scheme. Fetching today's NAV
-- from mfapi.in would mean an HTTP call from inside Postgres (via the
-- pg_net extension), which is a two-phase async dance in plain SQL —
-- meaningfully more fragile for a personal finance app than just
-- recording the cash amount and letting unit-level tracking be a
-- manual/client-side concern. If you want units on a specific
-- auto-generated SIP row, edit that transaction afterward in the app.
--
-- security definer + running as the table owner is what lets this
-- function see and write every user's rows in one pass — every other
-- policy in this schema is RLS-scoped to auth.uid(), but a scheduled
-- background job has no "current user" to scope to, so it necessarily
-- operates across all users. This is the one deliberate exception to
-- the per-user RLS model described in §1/§6 of the architecture doc.
-- ------------------------------------------------------------

create or replace function run_sip_investments() returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inv record;
  rate numeric;
  amt_aed numeric;
  amt_inr numeric;
  new_id text;
begin
  for inv in
    select i.*, coalesce(s."aedToInrRate", 23) as rate
    from investments i
    left join settings s on s.user_id = i.user_id
    where i."sipEnabled" = true
      and i.status = 'active'
      and i."sipDay" = extract(day from current_date)::int
      and (i."sipLastRunDate" is null or i."sipLastRunDate" < to_char(current_date, 'YYYY-MM-DD'))
  loop
    rate := inv.rate;
    if inv.currency = 'AED' then
      amt_aed := inv."sipAmount";
      amt_inr := inv."sipAmount" * rate;
    else
      amt_aed := inv."sipAmount" / rate;
      amt_inr := inv."sipAmount";
    end if;

    -- Deterministic id (investment + date) doubles as an idempotency key:
    -- on conflict do nothing means a second run on the same day is a no-op
    -- even if sipLastRunDate somehow didn't get updated on a prior attempt.
    new_id := 'sip-' || inv.id || '-' || to_char(current_date, 'YYYYMMDD');

    -- ISO 8601 with a literal "T"/"Z", matching new Date().toISOString() —
    -- the format every client-created "createdAt" already uses. Plain
    -- now()::text would produce Postgres's own "YYYY-MM-DD HH:MI:SS+00"
    -- shape instead, which is a needless inconsistency for a row that
    -- looks identical to a manually-added one everywhere else.
    insert into investment_transactions
      (id, user_id, investment_id, type, date, units, "pricePerUnit", amount, currency, notes, "createdAt", "amountAed", "amountInr", "exchangeRateUsed")
    values
      (new_id, inv.user_id, inv.id, 'SIP', current_date::text, null, null, inv."sipAmount", inv.currency,
       'Auto-generated monthly SIP',
       to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
       amt_aed, amt_inr, rate)
    on conflict (id) do nothing;

    update investments set "sipLastRunDate" = to_char(current_date, 'YYYY-MM-DD') where id = inv.id;
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- 3. The schedule — runs daily at 00:10 UTC
-- ------------------------------------------------------------

create extension if not exists pg_cron;

select cron.unschedule('run-sip-investments-daily')
where exists (select 1 from cron.job where jobname = 'run-sip-investments-daily');

select cron.schedule('run-sip-investments-daily', '10 0 * * *', 'select run_sip_investments();');
