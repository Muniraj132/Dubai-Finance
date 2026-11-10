alter table goals
  add column "lastUpdatedAt" timestamptz not null default now();

-- optional: give existing goals a sensible value instead of "today"
update goals set "lastUpdatedAt" = "createdAt"::timestamptz;
