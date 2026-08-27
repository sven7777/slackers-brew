-- Migration 0013: merge the three Carafa rows back into one.
--
-- Prod carries THREE malt rows that are all the same sack on Slackers' floor:
-- "Carafe III" (the original misspelling), "Carafa III", and
-- "Carafa Special III". Derek confirmed 2026-08-26 that the brewery only ever
-- buys the dehusked malt, so all three are Carafa Special III.
--
-- How the split happened: migration 0007 read the misspelled "Carafe III" as
-- the husked malt's name and split it in two — rename the old row to
-- "Carafa Special III", add "Carafa III" alongside. Its rename carried a guard
-- (`not exists 'Carafa Special III'`) to protect the unique (category, name)
-- index, and prod already HAD that row, so the rename silently did nothing:
-- the misspelled row was orphaned rather than renamed, and the husked malt was
-- added on top. A guard that skips where it should merge leaves the mess it
-- was written to prevent.
--
-- Weyermann really does make both malts (Special is dehusked, contributing
-- color without husk astringency). That is why 0007 exists and is not being
-- reverted as an error — the catalog was right in general and wrong about this
-- brewery. Slackers stocks one of them.
--
-- Write-once and idempotent: every statement is a no-op once the merged-away
-- rows are gone.

-- 1. Make sure the survivor exists before anything is folded into it. Only
--    when there is actually something to merge — this migration must never
--    invent a malt row in a database that has none of the three.
insert into public.inventory (category, name, qty, ord)
select 'malt', 'Carafa Special III', 0, coalesce(
  (select min(ord) from public.inventory
    where category = 'malt' and name in ('Carafa III', 'Carafe III')),
  (select coalesce(max(ord), -1) + 1 from public.inventory where category = 'malt'))
where exists (select 1 from public.inventory
               where category = 'malt' and name in ('Carafa III', 'Carafe III'))
on conflict (category, name) do nothing;

-- 2. Fold the on-hand quantity in. Prod's three rows are all at 0 today, but
--    this runs unattended days later — stock counted onto the wrong row must
--    move, not vanish.
update public.inventory s
   set qty = s.qty + coalesce((select sum(d.qty) from public.inventory d
                                where d.category = 'malt'
                                  and d.name in ('Carafa III', 'Carafe III')), 0),
       updated_at = now()
 where s.category = 'malt' and s.name = 'Carafa Special III'
   and exists (select 1 from public.inventory d
                where d.category = 'malt' and d.name in ('Carafa III', 'Carafe III'));

-- 3. Keep a price rather than lose one — but only if the survivor hasn't got
--    one. The dehusked malt's own price (MWEY1067) is the right price for it;
--    the husked row's is a fallback for a database where the survivor is the
--    row that was never priced.
update public.inventory s
   set cost_per_unit  = d.cost_per_unit,
       product_sku    = d.product_sku,
       vendor         = d.vendor,
       price_effective = d.price_effective,
       updated_at     = now()
  from (select cost_per_unit, product_sku, vendor, price_effective
          from public.inventory
         where category = 'malt' and name in ('Carafa III', 'Carafe III')
           and cost_per_unit is not null
         order by price_effective desc nulls last
         limit 1) d
 where s.category = 'malt' and s.name = 'Carafa Special III'
   and s.cost_per_unit is null;

-- 4. Recipes: anything calling for either name meant the dehusked malt.
--    (No prod recipe does today — this covers what gets added between writing
--    this and running it.)
update public.recipe_ingredients
   set name = 'Carafa Special III'
 where category = 'malt' and name in ('Carafa III', 'Carafe III');

-- 5. A recipe that named two of them now has two identical grain lines. Fold
--    them into the first and drop the rest, so the grain bill reads as one
--    weight of one malt.
with ranked as (
  select id, qty,
         row_number() over (partition by recipe_id order by ord, id) as rn,
         sum(qty)     over (partition by recipe_id)                  as total
    from public.recipe_ingredients
   where category = 'malt' and name = 'Carafa Special III'
)
update public.recipe_ingredients ri
   set qty = r.total
  from ranked r
 where ri.id = r.id and r.rn = 1 and ri.qty <> r.total;

delete from public.recipe_ingredients ri
 using (select id, row_number() over (partition by recipe_id order by ord, id) as rn
          from public.recipe_ingredients
         where category = 'malt' and name = 'Carafa Special III') r
 where ri.id = r.id and r.rn > 1;

-- 6. Drop the merged-away inventory rows. Everything they carried is now on
--    the survivor.
delete from public.inventory
 where category = 'malt' and name in ('Carafa III', 'Carafe III');
