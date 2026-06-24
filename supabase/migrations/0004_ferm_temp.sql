-- Migration 0004: fermentation temp on recipes
-- Adds the primary fermentation temp (°F) shown on the Cellar Sheet's Yeast box.
-- Populated on BeerSmith import (F_A_PRIM_TEMP) or by hand in the Recipes Edit
-- view. Idempotent — safe to run once on the live DB in the Supabase SQL editor.

alter table recipes
  add column if not exists ferm_temp numeric;
