-- 2026-07-14 incident cleanup: two overlapping full-list saves interleaved
-- their delete/insert phases and doubled the recipe catalog (36 rows — every
-- ord 0-17 twice, the two insert batches 17 ms apart, identical content).
-- Keep the earliest-created row per ord and drop the rest; recipe_ingredients
-- and recipe_schedule rows cascade away with their parents.
-- Idempotent: with one row per ord this deletes nothing.
delete from public.recipes
where id not in (
  select distinct on (ord) id
  from public.recipes
  order by ord, created_at, id
);

-- Guard: the app always writes ord 0..n-1 in a single insert, so a future
-- save race now fails its second insert loudly instead of silently
-- duplicating the catalog.
create unique index if not exists recipes_ord_unique on public.recipes (ord);
