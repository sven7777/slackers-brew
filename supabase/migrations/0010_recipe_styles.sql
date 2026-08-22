-- Migration 0010: put every recipe's style on the BJCP catalog.
--
-- Two write-once fixes, both driven by the same source of truth — Derek's own
-- BeerSmith exports:
--
--   1. NORMALIZE the three shorthand styles the seeded recipes carried. The app
--      now picks styles from a 148-entry BJCP catalog (src/lib/beerStyles.js,
--      exported from BeerSmith), and these three were the only preset values
--      not in it. Each replacement is corroborated by the brewery's own .bsmx:
--      All Y'alls is "New England IPA" there, Beachcomber "Belgian Blond Ale",
--      James "American Brown Ale". defaults.js and seed_recipes.sql change in
--      the same commit, so a reset recipe or a fresh database agrees with prod.
--
--   2. BACKFILL styles that are blank. Until the .bsmx parser was fixed, every
--      import landed styleless: <F_R_STYLE> is a nested record, not text, so
--      the parser read "" every time. Those recipes are in prod with no style
--      and no way to have got one. The name->style pairs below come straight
--      from the export files.
--
-- Safety properties, in order of how much they matter:
--   * The backfill ONLY fills blanks (style is null or ''). It can never
--     overwrite a style a human chose — including one chosen between this
--     migration being written and it running.
--   * The normalize step matches the three exact old strings and nothing else.
--   * Idempotent: re-running matches nothing the second time. (Migration 0002
--     once got re-run and reset seeded recipes to an April snapshot; nothing
--     here rewrites a recipe's ingredients, amounts, or process at all — only
--     the style column.)
--   * Names not listed keep their blank style; the brewer picks one from the
--     dropdown. Guessing beyond the export files is not this migration's job.

-- 1. Shorthand -> catalog name.
update public.recipes set style = 'New England IPA'    where style = 'NEIPA';
update public.recipes set style = 'Belgian Blond Ale'  where style = 'Belgian Blond';
update public.recipes set style = 'American Brown Ale' where style = 'American Brown';

-- 2. Backfill blanks from the BeerSmith exports, by recipe name.
update public.recipes r
   set style = m.style
  from (values
  ('All Y''alls', 'New England IPA'),
  ('Beachbomber', 'Belgian Dark Strong Ale'),
  ('Beachcomber', 'Belgian Blond Ale'),
  ('Beachcomber 2.0', 'Blonde Ale'),
  ('Beachcomber v2', 'Belgian Blond Ale'),
  ('Belgian Pale Ale', 'Belgian Pale Ale'),
  ('Black Eye Bock', 'Dark Mild'),
  ('Blonde Ale', 'Blonde Ale'),
  ('Coffee Snout', 'Baltic Porter'),
  ('Ghost Pepper Porter V2', 'American Porter'),
  ('Hazy Dark IPA', 'Brown IPA'),
  ('Hefelump', 'Weissbier'),
  ('Helles', 'Munich Helles'),
  ('Humblebee', 'Braggot'),
  ('Humblebee (2.0)', 'Braggot'),
  ('James', 'American Brown Ale'),
  ('Kölsch', 'Kölsch'),
  ('Latte Porter', 'American Porter'),
  ('Leder Jörtsen', 'Festbier'),
  ('Mango Unchained', 'Double IPA'),
  ('Milkshake DIPA', 'Double IPA'),
  ('Milkshake DIPA v2', 'Double IPA'),
  ('Night Jörts', 'Czech Dark Lager'),
  ('Pale Ale Lagerish', 'American Lager'),
  ('Piloncillo Pyramids', 'Belgian Dark Strong Ale'),
  ('Pinkety Drinkety', 'Cream Ale'),
  ('Red Panda', 'Belgian Tripel'),
  ('Scarlett', 'Specialty IPA'),
  ('Schwarzbier', 'Schwarzbier'),
  ('Schwarzbier (Scaled)', 'Schwarzbier'),
  ('Sheriff Bart IPA', 'Black IPA'),
  ('Shortea Jörts', 'Kölsch'),
  ('Sisterhood of the Hops', 'American Pale Ale'),
  ('Situation IPA', 'American IPA'),
  ('Spruced Up', 'American Pale Ale'),
  ('Stretchy Jörts', 'Kölsch'),
  ('Sweet Stout', 'Imperial Stout'),
  ('VietCajun Kölsch', 'Kölsch'),
  ('West Coast IPA', 'American IPA'),
  ('Wicked Tickle', 'American Porter'),
  ('Wit''s End', 'Witbier')
  ) as m(name, style)
 where r.name = m.name
   and (r.style is null or btrim(r.style) = '');
