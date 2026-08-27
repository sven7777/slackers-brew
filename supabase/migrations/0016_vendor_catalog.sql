-- Migration 0016: make `products` able to hold the whole vendor range.
--
-- The table has existed since 0008 but has never had a row in it: prices live
-- on `inventory.cost_per_unit`, and the ~30 products Slackers buys are
-- described in code by src/lib/products.js. It was built to describe a curated
-- shortlist. It now has to hold an ingested price list — 563 product rows on
-- the August 2026 Houston file — which needs three things it doesn't have.
--
-- Purely additive and idempotent: one new nullable column, two loosened
-- constraints, one seed row. No existing row is rewritten (there are none).

-- 1. Which kind of ingredient this is, when we can tell. Nullable because
--    "we can't tell" is a real and common answer: classify() in
--    src/lib/catalog.js only claims a category the list demonstrates outright
--    (the M range is malt; SafAle is yeast) and leaves the rest for a human,
--    because category decides which recipe table an ingredient may join and a
--    wrong guess files a malt under hops.
alter table public.products add column if not exists category text;

-- 2. An unreadable pack size must be storable AS unreadable.
--
--    `pack_qty numeric not null default 1` was right for a curated catalog
--    where every row's pack was known and malts really are quoted per 1 lb.
--    Ingested rows are different: 47 of the 563 write no pack size at all
--    ("Keystone Bung - Plastic", '1 lb Nylon Bag 11" x 8"'). Defaulting those
--    to 1 lb would state a denominator the vendor never gave, and a price
--    divided by a made-up pack is exactly the confidently-wrong number
--    costPerUnit() returns null to avoid. Null says "not known"; 1 says "one
--    pound", and only one of those is true.
alter table public.products alter column pack_qty  drop not null;
alter table public.products alter column pack_unit drop not null;

-- 3. The catalog is a shared key like any other, so it gets a version counter
--    and the compare-and-swap that stops a stale tab overwriting a newer
--    import. Same reasoning as 0014; the client creates a missing row itself,
--    so this is belt and braces.
insert into public.data_versions (key)
values ('catalog')
on conflict (key) do nothing;

-- Ingested rows are looked up by SKU on every re-import (that is the identity
-- a rename or a repack is detected against), and a full list is a few hundred
-- rows, so give that lookup an index. `sku` is already unique from 0008, which
-- provides one — this is here only to state the access pattern for the next
-- reader, and is a no-op where the unique index already serves.
create index if not exists products_category_idx on public.products (category);
