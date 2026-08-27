-- Migration 0015: Slackers' Pils is Rahr North Star, not Rahr Premium Pilsner.
--
-- Rahr discontinued MRAH1105 "Rahr Premium Pilsner". It is on the June 2025
-- Houston price list and absent from the August 2026 one, which now carries
-- MRAH1190 "Rahr North Star Pils™" instead. Derek confirmed 2026-08-27 that the
-- brewery switched.
--
-- Why this matters beyond a label: a discontinued SKU fails SILENTLY on a price
-- import. priceChanges() looks the mapped SKU up in the parsed file, doesn't
-- find it, and reports `skipped: "absent"` — the same outcome as a hop list not
-- carrying malts. So the Pils cost_per_unit has been frozen at its June 2025
-- quote ever since, with nothing on screen saying so.
--
-- This migration ONLY repoints the product link. It deliberately does not touch
-- cost_per_unit or price_effective:
--   * vendor prices must never be committed to this repo (it is public), so the
--     new number cannot be written here — see the note in src/lib/products.js;
--   * the existing price is a real quote, honestly dated. Clearing it would make
--     the row read "unpriced" and drop it out of every COGS total, which is a
--     bigger lie than a price that is ~5% stale.
-- The next price-list import in Settings fills in the current number, because
-- MRAH1190 is on the list that MRAH1105 fell off.
--
-- Write-once and idempotent: the guard makes it a no-op once applied.

update public.inventory
   set product_sku = 'MRAH1190',
       vendor      = 'Rahr',
       updated_at  = now()
 where category    = 'malt'
   and name        = 'Pils'
   and product_sku = 'MRAH1105';

-- The catalog row itself, so a fresh database and prod agree. `products` is
-- keyed by sku; the old row is left in place rather than deleted, since it is
-- what a historical price_effective still refers to.
insert into public.products (sku, vendor, name, pack_qty, pack_unit, order_pack, source)
values ('MRAH1190', 'Rahr', 'Rahr North Star Pils™', 1, 'lb', '55 lb', 'BSG Craft Price List - Houston')
on conflict (sku) do nothing;
