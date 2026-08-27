-- Migration 0014: a version counter per persisted key, so a stale tab can't
-- overwrite newer data.
--
-- Why this exists (2026-08-27): Derek had the app open in a tab from before he
-- imported two recipes. The recipe dropdown was missing them — the app loads
-- each key once on mount and never refetches, so a long-open tab shows the data
-- as of the moment it opened. A hard refresh fixed the display.
--
-- The display was the harmless half. Every save is a whole-list
-- delete-then-insert, so had he EDITED anything in that tab, the save would have
-- written the old 18-recipe array over the database and deleted both imported
-- recipes. Two brewers are on the allowlist sharing one database; this does not
-- need a day-old tab, just two windows open at once.
--
-- So each shared key gets a version. A writer claims its slot with a
-- compare-and-swap — `update ... where key = $1 and version = $expected` — and
-- only touches data rows if that update matched. A tab whose expected version is
-- behind matches nothing, writes nothing, and reports the refusal. The CAS runs
-- BEFORE the delete, so a losing writer never gets as far as removing a row.
--
-- This is not a lock: a crash between the CAS and the insert leaves the version
-- bumped with the data half-written, which is exactly what a crash mid-save does
-- today. It closes the stale-overwrite window, which is the failure that was
-- one click away.

create table if not exists public.data_versions (
  key        text primary key,
  version    bigint not null default 0,
  updated_at timestamptz not null default now()
);

-- One row per shared key. The client creates a missing row rather than failing,
-- so this seeding is a convenience, not a contract — but it means the very
-- first save of each key is already protected.
insert into public.data_versions (key)
values ('malts'), ('hops'), ('yeast'), ('adj'), ('recipes'), ('settings')
on conflict (key) do nothing;

alter table public.data_versions enable row level security;

-- Same rule as every other brewery table: members read and write, nobody else
-- sees it. Dropped first so re-running this migration is a no-op rather than a
-- "policy already exists" error.
drop policy if exists data_versions_rw on public.data_versions;
create policy data_versions_rw on public.data_versions
  for all using (is_member()) with check (is_member());
