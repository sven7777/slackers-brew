-- Backfill inventory rows for ingredients that recipes already call for.
--
-- `seed_recipes.sql` inserted rows into `recipe_ingredients` (Whirlfloc, in
-- three recipes) without a matching row in `inventory`, and `loadInventory`
-- falls back to defaults.js only when the whole table is empty — so prod has
-- kept a set of ingredients that recipes reference but inventory doesn't know
-- about. Same class as the Carafa rename in 0007: a recipe needing an
-- ingredient no inventory row matches.
--
-- The visible symptoms were an ingredient stuck at "unpriced" on the Cost view
-- with a price field that silently refused input (nothing to write the price
-- onto), and a phantom line in the order calculator.
--
-- Generic on purpose — it repairs whatever is missing rather than naming
-- Whirlfloc, so the same gap can't reopen quietly for the next ingredient.
--
-- Additive and idempotent: inserts only what's absent, at qty 0, and never
-- touches an existing row (so hand-entered quantities and prices survive a
-- re-run). Salts are excluded — they live per-recipe, not in inventory.

insert into public.inventory (category, name, qty, unit, ord)
select
  ri.category,
  ri.name,
  0 as qty,
  -- Adjuncts carry a per-item unit; the other categories imply theirs in the UI.
  case when ri.category = 'adj' then max(ri.unit) else null end as unit,
  -- Append after whatever that category already holds, keeping the curated
  -- order of the existing rows intact.
  coalesce(
    (select max(i2.ord) from public.inventory i2 where i2.category = ri.category),
    -1
  ) + row_number() over (partition by ri.category order by ri.name) as ord
from public.recipe_ingredients ri
where ri.category <> 'salt'
  and not exists (
    select 1 from public.inventory i
    where i.category = ri.category
      and lower(i.name) = lower(ri.name)
  )
group by ri.category, ri.name
on conflict (category, name) do nothing;
