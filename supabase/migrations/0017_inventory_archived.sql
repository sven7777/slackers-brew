-- Migration 0017: let an ingredient be archived instead of deleted.
--
-- Slackers stopped buying Idaho 7, Lemondrop and Pink Boots 2025 (Derek,
-- 2026-08-24), and the only way to say so was to delete the row — which throws
-- away its price, the one thing on an inventory row that is expensive to get
-- back. So the rows stayed and the shelf listed three things nobody stocks.
--
-- Archived is a display state, not a deletion. The row, its quantity and its
-- price all survive; the Inventory tab hides it and says how many it hid.
-- computeOrder() deliberately ignores the flag: if a recipe calls for an
-- archived ingredient the brewery still needs to buy it, and hiding a row from
-- the shelf must never quietly change what gets ordered.
--
-- Purely additive: one nullable-by-default column, defaulting to the state
-- every existing row is already in. No existing row is rewritten.

alter table public.inventory
  add column if not exists archived boolean not null default false;

-- Deliberately NOT archiving Idaho 7 / Lemondrop / Pink Boots here, even though
-- Derek named them. Which ingredients the brewery stocks is his call to make in
-- the app, on a screen that shows him what he is doing — not a decision to bake
-- into a migration that runs unattended. The button is the point of this change.
