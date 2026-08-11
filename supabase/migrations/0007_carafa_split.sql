-- Migration 0007: split the misspelled "Carafe III" into the two real malts.
--
-- The catalog carried a single entry, "Carafe III". Weyermann actually makes
-- two different malts: Carafa III (husked) and Carafa Special III (dehusked —
-- "Special" means the husk is removed, so it contributes color without the
-- husk astringency). This is therefore a data fix, not just a spelling fix:
-- the stocked malt is the DEHUSKED one, so the existing rows become
-- "Carafa Special III" and the husked variant is added as a new empty entry.
--
-- Write-once and idempotent: re-running is a no-op (the renames match nothing
-- once applied, the insert conflicts away). Nothing here overwrites a
-- user-editable value — quantities, ords and recipe amounts are preserved.

-- Inventory: rename in place so the on-hand qty and catalog position survive.
-- The guard keeps the unique (category, name) index from erroring if a
-- "Carafa Special III" row already exists (hand-added, or a re-run).
update public.inventory
   set name = 'Carafa Special III',
       updated_at = now()
 where category = 'malt'
   and name = 'Carafe III'
   and not exists (
     select 1 from public.inventory i2
     where i2.category = 'malt' and i2.name = 'Carafa Special III'
   );

-- Add the husked variant at qty 0, next to its sibling in the catalog order.
-- It shares an `ord` with the renamed row (inventory.ord is not unique); the
-- two sort adjacent either way, and the next in-app inventory save renumbers
-- the whole malt list from the array order in defaults.js.
insert into public.inventory (category, name, qty, ord)
select 'malt', 'Carafa III', 0, coalesce(
  (select ord from public.inventory
    where category = 'malt' and name = 'Carafa Special III'),
  (select coalesce(max(ord), -1) + 1 from public.inventory where category = 'malt')
)
on conflict (category, name) do nothing;

-- Recipes: every recipe that called for the old name meant the dehusked malt
-- (only Night Jörts ships with it, but this covers anything added since).
update public.recipe_ingredients
   set name = 'Carafa Special III'
 where category = 'malt'
   and name = 'Carafe III';
