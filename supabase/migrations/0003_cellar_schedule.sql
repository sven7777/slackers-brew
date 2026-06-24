-- Migration 0003: cellar schedule (roadmap PR4)
-- Adds the recipe_schedule table (per-day cellar steps) that drives the Cellar
-- Summary sheet's auto-dated boxes, plus its RLS policy, and seeds the one
-- schedule we have (All Y'alls). Idempotent — safe to run once on the live DB.
-- Apply in the Supabase SQL editor. Deploy the new frontend bundle alongside.

create table if not exists recipe_schedule (
  id        uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  day       int not null default 0,
  action    text not null,
  ord       int not null default 0
);

create index if not exists recipe_schedule_recipe_id_idx
  on recipe_schedule (recipe_id);

alter table recipe_schedule enable row level security;

drop policy if exists recipe_schedule_rw on recipe_schedule;
create policy recipe_schedule_rw on recipe_schedule
  for all using (is_member()) with check (is_member());

-- Seed All Y'alls' schedule (the one provided). Guarded so re-running is a no-op
-- and so it never clobbers a schedule already edited in-app.
insert into recipe_schedule (recipe_id, day, action, ord)
select r.id, v.day, v.action, v.ord
from recipes r, (values
    (0,  'Brew Date',        0),
    (11, 'Step Crash 55',    1),
    (11, 'Bung | Pressure',  2),
    (12, 'Blow Off',         3),
    (12, 'Dry Hop',          4),
    (13, 'Mini Blow Off',    5),
    (13, 'Rouse',            6),
    (13, 'Step Crash 40',    7),
    (14, 'Blow Off',         8),
    (14, 'Step Crash 33',    9),
    (19, 'Blow Off',        10),
    (19, 'Transfer',        11),
    (20, 'Blow Off',        12),
    (20, 'Keg',             13)
) as v(day, action, ord)
where r.name = 'All Y''alls'
  and not exists (select 1 from recipe_schedule s where s.recipe_id = r.id);
