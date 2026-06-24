-- Slackers Brewing — Supabase schema (roadmap Step 3)
--
-- Model: ONE shared brewery. Every approved member reads/writes the same
-- inventory, recipes, and settings. Data is stored PER ROW (not one JSON blob
-- per key) so two brewers editing different ingredients never clobber each
-- other. Access is invite-only: a row in `members` is what grants entry, and
-- row-level security enforces it at the database — not just in the UI.
--
-- Run this once in the Supabase SQL Editor on a fresh project.
-- UI-only state (which tab is open, recipe-editor selection, the in-progress
-- order-calculator picks) intentionally stays in localStorage — it's
-- per-device, not shared brewery data.

-- ---------------------------------------------------------------------------
-- Membership allowlist + helper
-- ---------------------------------------------------------------------------

create table if not exists members (
  email    text primary key,
  added_at timestamptz not null default now()
);

-- True when the signed-in user's email is on the allowlist (case-insensitive).
-- SECURITY DEFINER so policies can read `members` without granting members a
-- direct read that could leak the full roster.
create or replace function is_member() returns boolean
  language sql stable security definer
  set search_path = public
as $$
  select exists (
    select 1 from members
    where lower(email) = lower(auth.jwt() ->> 'email')
  );
$$;

-- ---------------------------------------------------------------------------
-- Inventory — one row per ingredient. `unit` is meaningful for adjuncts
-- (lbs/oz/ml/each); malts/hops/yeast carry their implicit unit in the UI.
-- ---------------------------------------------------------------------------

create table if not exists inventory (
  id         uuid primary key default gen_random_uuid(),
  category   text not null check (category in ('malt','hop','yeast','adj')),
  name       text not null,
  qty        numeric not null default 0,
  unit       text,
  ord        int not null default 0,   -- preserves the curated catalog display order
  updated_at timestamptz not null default now(),
  unique (category, name)
);

-- ---------------------------------------------------------------------------
-- Recipes — header + per-ingredient rows (mirrors {n,s,m[],h[],y[],a[]}).
-- ---------------------------------------------------------------------------

create table if not exists recipes (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  style      text,
  og         numeric,                  -- target original gravity (brew sheet)
  fg         numeric,                  -- target final gravity
  abv        numeric,                  -- target ABV %
  mash_temp  numeric,                  -- single-infusion mash temp (°F)
  ferm_temp  numeric,                  -- primary fermentation temp (°F, cellar sheet)
  process    jsonb,                    -- editable brew-sheet process values (strike temp, volumes, timings, pH targets)
  ord        int not null default 0,   -- preserves recipe list order
  created_at timestamptz not null default now()
);

-- Additions carry a stage + time so the brew-day / cellar sheets can place
-- them; the same hop may appear several times at different stages. `salt`
-- rows are water-chemistry additions (stage = mash/sparge/boil).
create table if not exists recipe_ingredients (
  id        uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  category  text not null check (category in ('malt','hop','yeast','adj','salt')),
  name      text not null,
  qty       numeric not null default 0,
  unit      text,
  stage     text,                     -- boil/whirlpool/mash/firstwort/dryhop/...
  time_min  numeric,                  -- minutes (boil/whirlpool); null for grain
  ord       int not null default 0    -- preserves ingredient order within a recipe
);

create index if not exists recipe_ingredients_recipe_id_idx
  on recipe_ingredients (recipe_id);

-- Cellar schedule — one row per scheduled step (day offset from brew day +
-- action). The Cellar Summary sheet turns these into calendar dates from an
-- entered brew date. `action` is free text from a curated picker (cellarActions).
create table if not exists recipe_schedule (
  id        uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  day       int not null default 0,    -- days after brew day
  action    text not null,
  ord       int not null default 0     -- preserves edit order within a recipe
);

create index if not exists recipe_schedule_recipe_id_idx
  on recipe_schedule (recipe_id);

-- ---------------------------------------------------------------------------
-- Settings — single shared row (brewery identity).
-- ---------------------------------------------------------------------------

create table if not exists settings (
  id      int primary key default 1 check (id = 1),
  name    text,
  tagline text,
  emoji   text,
  logo    text
);

-- ---------------------------------------------------------------------------
-- Row-level security: only members may touch brewery data.
-- ---------------------------------------------------------------------------

alter table members            enable row level security;
alter table inventory          enable row level security;
alter table recipes            enable row level security;
alter table recipe_ingredients enable row level security;
alter table recipe_schedule    enable row level security;
alter table settings           enable row level security;

-- Members can see the roster; no insert/update/delete policy means changing it
-- is done from the SQL Editor / service role (i.e. by you), keeping invites
-- in your hands.
create policy members_read on members
  for select using (is_member());

-- Full read/write on brewery data for any approved member.
create policy inventory_rw on inventory
  for all using (is_member()) with check (is_member());

create policy recipes_rw on recipes
  for all using (is_member()) with check (is_member());

create policy recipe_ingredients_rw on recipe_ingredients
  for all using (is_member()) with check (is_member());

create policy recipe_schedule_rw on recipe_schedule
  for all using (is_member()) with check (is_member());

create policy settings_rw on settings
  for all using (is_member()) with check (is_member());

-- ---------------------------------------------------------------------------
-- Seed: add yourself so you can log in. Replace the email, then add the rest
-- of the brewers the same way (or via the Table Editor).
-- ---------------------------------------------------------------------------

-- insert into members (email) values ('derek.law@kasasa.com');
