-- Ingredient pricing: a branded product catalog plus a per-ingredient link to
-- the product we actually buy, so the app can cost a batch.
--
-- Purely additive: creates one table and adds three nullable columns to
-- `inventory`. It does not rewrite a single existing inventory or recipe row.
-- (The one recipe data fix this feature needs — Pinkety Drinkety's yeast pitch
-- of 10 packs, which should be 1 — is deliberately NOT done here. It's a single
-- field, and editing it in the Recipes tab is safer than shipping a migration
-- that rewrites production recipe rows.)
--
-- Runs unattended against production on merge to main, so every statement is
-- idempotent and safe to re-run.

-- ---------------------------------------------------------------------------
-- Product catalog — one row per purchasable thing.
--
-- `pack_qty` + `pack_unit` describe the quantity a `price` buys. Malts and hops
-- are quoted per pound, so their pack is 1 lb even though they ship as 55 lb
-- sacks and 11 lb boxes; `order_pack` records that real purchasable unit for the
-- order-to-vendor view. `unit_mass` is set only for products counted by the
-- each (Whirlfloc tablets are 2.5 g), which is what makes a 5 lb tub divisible
-- into a tablet count.
--
-- No quantity-break tiers: Slackers never orders more than 20 of anything, so
-- the vendor's 40+/200+/480+ prices never apply.
-- ---------------------------------------------------------------------------

create table if not exists products (
  id             uuid primary key default gen_random_uuid(),
  sku            text unique,              -- null for hand-priced items with no vendor SKU
  vendor         text,
  name           text not null,
  price          numeric,                  -- null = no price yet; must never be read as 0
  pack_qty       numeric not null default 1,
  pack_unit      text not null default 'lb',
  order_pack     text,                     -- how it actually ships, e.g. '55 lb', '11 lb'
  unit_mass_qty  numeric,                  -- mass of one "each", when countable
  unit_mass_unit text,
  crop_year      int,                      -- hops only; same variety is priced per crop year
  source         text,                     -- which price list / who supplied it
  effective      date,                     -- so a stale COGS is visible in the UI
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Inventory → product link. `cost_per_unit` is the price already expressed in
-- the unit the recipe uses (malt $/lb, hops $/oz, yeast $/pack, adjuncts per
-- their own unit). Storing the converted value — rather than converting at read
-- time — keeps a bad conversion visible and editable in a column instead of
-- buried in a formula, and lets a brewer override a price by hand.
-- ---------------------------------------------------------------------------

alter table inventory add column if not exists product_sku     text;
alter table inventory add column if not exists vendor          text;
alter table inventory add column if not exists cost_per_unit   numeric;
-- When the price was quoted, so the Cost view can show "prices as of ..." and a
-- year-old COGS is visibly stale rather than quietly wrong.
alter table inventory add column if not exists price_effective date;

-- ---------------------------------------------------------------------------
-- Row-level security: same rule as every other brewery table.
-- ---------------------------------------------------------------------------

alter table products enable row level security;

drop policy if exists products_rw on products;
create policy products_rw on products
  for all using (is_member()) with check (is_member());
