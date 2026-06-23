-- Migration 0001: brew-day schema fields (roadmap PR1)
-- Adds recipe targets + mash temp, addition stage/time, and the `salt`
-- ingredient category. Idempotent — safe to run once on the live DB.
-- Apply in the Supabase SQL editor, then run 0002_brew_day_data.sql.

alter table recipes
  add column if not exists og        numeric,
  add column if not exists fg        numeric,
  add column if not exists abv       numeric,
  add column if not exists mash_temp numeric;

alter table recipe_ingredients
  add column if not exists stage    text,
  add column if not exists time_min numeric;

-- Allow the new 'salt' category (water-chemistry additions).
alter table recipe_ingredients drop constraint if exists recipe_ingredients_category_check;
alter table recipe_ingredients add constraint recipe_ingredients_category_check
  check (category in ('malt','hop','yeast','adj','salt'));
