-- Slackers Brewing — seed recipes into Supabase (staged brew-day model)
-- Run once in the Supabase SQL Editor while the recipes tables are EMPTY.
-- Source: ~/Downloads/Slackers20260402.bsmx via src/lib/beersmith.js.
-- (For an already-seeded DB, use migrations/0001 + 0002 instead.)

begin;

-- 1. All Y'alls
with r as (
  insert into recipes (name, style, og, fg, abv, mash_temp, ord)
  values ('All Y''alls', 'NEIPA', null, null, null, 155, 0) returning id
)
insert into recipe_ingredients (recipe_id, category, name, qty, unit, stage, time_min, ord)
select r.id, v.category, v.name, v.qty::numeric, v.unit::text, v.stage::text, v.time_min::numeric, v.ord
from r, (values
    ('malt', '2-Row', 185, null, null, null, 0),
    ('malt', 'White Wheat', 55, null, null, null, 1),
    ('malt', 'Flaked Wheat', 35, null, null, null, 2),
    ('malt', 'Flaked Oat', 15, null, null, null, 3),
    ('hop', 'Cascade', 12, null, 'boil', 10, 0),
    ('hop', 'Amarillo', 16, null, 'boil', 7.5, 1),
    ('hop', 'Cascade', 12, null, 'boil', 5, 2),
    ('hop', 'Amarillo', 12, null, 'whirlpool', 20, 3),
    ('hop', 'Cascade', 12, null, 'whirlpool', 20, 4),
    ('hop', 'Chinook', 8, null, 'whirlpool', 20, 5),
    ('hop', 'Cascade', 48, null, 'dryhop', 0, 6),
    ('hop', 'Mosaic', 48, null, 'dryhop', 0, 7),
    ('hop', 'Simcoe', 16, null, 'dryhop', 0, 8),
    ('yeast', 'K97', 1, null, null, null, 0),
    ('salt', 'CaCl2', 100, null, 'mash', null, 0),
    ('salt', 'CaSo4', 40, null, 'mash', null, 1),
    ('salt', 'CaCl2', 80, null, 'sparge', null, 2),
    ('salt', 'CaSo4', 32, null, 'sparge', null, 3)
) as v(category, name, qty, unit, stage, time_min, ord);

-- 2. Beachcomber
with r as (
  insert into recipes (name, style, og, fg, abv, mash_temp, ord)
  values ('Beachcomber', 'Belgian Blond', null, null, null, 152, 1) returning id
)
insert into recipe_ingredients (recipe_id, category, name, qty, unit, stage, time_min, ord)
select r.id, v.category, v.name, v.qty::numeric, v.unit::text, v.stage::text, v.time_min::numeric, v.ord
from r, (values
    ('malt', 'Pils', 110, null, null, null, 0),
    ('malt', 'White Wheat', 55, null, null, null, 1),
    ('malt', 'Vienna', 15, null, null, null, 2),
    ('malt', 'Flaked Wheat', 15, null, null, null, 3),
    ('malt', 'Carafoam', 10, null, null, null, 4),
    ('hop', 'Amarillo', 15, null, 'boil', 60, 0),
    ('hop', 'Crystal', 8, null, 'boil', 5, 1),
    ('yeast', 'BE-134', 1, null, null, null, 0),
    ('adj', 'Candi Syrup', 5, 'lbs', 'boil', 15, 0)
) as v(category, name, qty, unit, stage, time_min, ord);

-- 3. Coffee Snout
with r as (
  insert into recipes (name, style, og, fg, abv, mash_temp, ord)
  values ('Coffee Snout', 'Baltic Porter', null, null, null, 154, 2) returning id
)
insert into recipe_ingredients (recipe_id, category, name, qty, unit, stage, time_min, ord)
select r.id, v.category, v.name, v.qty::numeric, v.unit::text, v.stage::text, v.time_min::numeric, v.ord
from r, (values
    ('malt', 'Maris Otter', 165, null, null, null, 0),
    ('malt', '2-Row', 110, null, null, null, 1),
    ('malt', 'Munich', 40, null, null, null, 2),
    ('malt', 'Caramunich I', 15, null, null, null, 3),
    ('malt', 'Chocolate', 12, null, null, null, 4),
    ('malt', 'Roasted Barley', 8, null, null, null, 5),
    ('malt', 'Carafoam', 5, null, null, null, 6),
    ('hop', 'CTZ', 12, null, 'boil', 60, 0),
    ('hop', 'Willamette', 12, null, 'boil', 5, 1),
    ('yeast', 'S-04', 1, null, null, null, 0),
    ('adj', 'Coffee', 5, 'lbs', 'secondary', 0, 0),
    ('salt', 'CaSo4', 60, null, 'mash', null, 0),
    ('salt', 'Baking Soda', 50, null, 'mash', null, 1),
    ('salt', 'Salt', 7, null, 'mash', null, 2),
    ('salt', 'CaSo4', 32, null, 'sparge', null, 3),
    ('salt', 'Baking Soda', 30, null, 'sparge', null, 4),
    ('salt', 'Salt', 4, null, 'sparge', null, 5)
) as v(category, name, qty, unit, stage, time_min, ord);

-- 4. Hefelump
with r as (
  insert into recipes (name, style, og, fg, abv, mash_temp, ord)
  values ('Hefelump', 'Weissbier', null, null, null, 152, 3) returning id
)
insert into recipe_ingredients (recipe_id, category, name, qty, unit, stage, time_min, ord)
select r.id, v.category, v.name, v.qty::numeric, v.unit::text, v.stage::text, v.time_min::numeric, v.ord
from r, (values
    ('malt', 'Pils', 110, null, null, null, 0),
    ('malt', 'White Wheat', 110, null, null, null, 1),
    ('malt', 'Caramunich I', 15, null, null, null, 2),
    ('malt', 'Carafoam', 10, null, null, null, 3),
    ('malt', 'Vienna', 10, null, null, null, 4),
    ('hop', 'Saaz', 14, null, 'boil', 60, 0),
    ('hop', 'Saaz', 6, null, 'boil', 5, 1),
    ('yeast', 'WB-06', 1, null, null, null, 0),
    ('adj', 'Orange Peel', 3, 'oz', 'boil', 15, 0),
    ('salt', 'Chalk', 11, null, 'mash', null, 0),
    ('salt', 'Baking Soda', 5, null, 'mash', null, 1),
    ('salt', 'Chalk', 95, null, 'boil', null, 2),
    ('salt', 'Baking Soda', 40, null, 'boil', null, 3)
) as v(category, name, qty, unit, stage, time_min, ord);

-- 5. James
with r as (
  insert into recipes (name, style, og, fg, abv, mash_temp, ord)
  values ('James', 'American Brown', null, null, null, 154, 4) returning id
)
insert into recipe_ingredients (recipe_id, category, name, qty, unit, stage, time_min, ord)
select r.id, v.category, v.name, v.qty::numeric, v.unit::text, v.stage::text, v.time_min::numeric, v.ord
from r, (values
    ('malt', '2-Row', 110, null, null, null, 0),
    ('malt', 'Maris Otter', 110, null, null, null, 1),
    ('malt', 'Caramunich I', 35, null, null, null, 2),
    ('malt', 'Chocolate', 15, null, null, null, 3),
    ('malt', 'Carafoam', 10, null, null, null, 4),
    ('hop', 'CTZ', 10, null, 'boil', 60, 0),
    ('hop', 'Willamette', 4, null, 'boil', 15, 1),
    ('yeast', 'S-04', 1, null, null, null, 0),
    ('adj', 'Clarity Ferm', 125, 'ml', 'fermentation', 0, 0),
    ('salt', 'Lactic Acid', 50, null, 'mash', null, 0),
    ('salt', 'CaSo4', 48, null, 'mash', null, 1),
    ('salt', 'Baking Soda', 42, null, 'mash', null, 2),
    ('salt', 'Chalk', 10, null, 'mash', null, 3),
    ('salt', 'Salt', 6, null, 'mash', null, 4),
    ('salt', 'CaSo4', 42, null, 'boil', null, 5),
    ('salt', 'Baking Soda', 35, null, 'boil', null, 6),
    ('salt', 'Chalk', 6, null, 'boil', null, 7),
    ('salt', 'Salt', 5, null, 'boil', null, 8)
) as v(category, name, qty, unit, stage, time_min, ord);

-- 6. Leder Jörtsen
with r as (
  insert into recipes (name, style, og, fg, abv, mash_temp, ord)
  values ('Leder Jörtsen', 'Festbier', null, null, null, 152, 5) returning id
)
insert into recipe_ingredients (recipe_id, category, name, qty, unit, stage, time_min, ord)
select r.id, v.category, v.name, v.qty::numeric, v.unit::text, v.stage::text, v.time_min::numeric, v.ord
from r, (values
    ('malt', 'Munich', 110, null, null, null, 0),
    ('malt', 'Pils', 110, null, null, null, 1),
    ('malt', 'Vienna', 15, null, null, null, 2),
    ('malt', 'Carafoam', 10, null, null, null, 3),
    ('malt', 'Caramunich I', 10, null, null, null, 4),
    ('hop', 'Amarillo', 18, null, 'boil', 60, 0),
    ('hop', 'Saaz', 8, null, 'boil', 20, 1),
    ('hop', 'Saaz', 10, null, 'boil', 5, 2),
    ('yeast', 'K97', 1, null, null, null, 0),
    ('adj', 'Clarity Ferm', 125, 'ml', 'fermentation', 0, 0),
    ('salt', 'Chalk', 58, null, 'mash', null, 0),
    ('salt', 'Baking Soda', 24, null, 'mash', null, 1),
    ('salt', 'Chalk', 73, null, 'boil', null, 2),
    ('salt', 'Baking Soda', 30, null, 'boil', null, 3)
) as v(category, name, qty, unit, stage, time_min, ord);

-- 7. Mango Unchained
with r as (
  insert into recipes (name, style, og, fg, abv, mash_temp, ord)
  values ('Mango Unchained', 'Double IPA', null, null, null, 152, 6) returning id
)
insert into recipe_ingredients (recipe_id, category, name, qty, unit, stage, time_min, ord)
select r.id, v.category, v.name, v.qty::numeric, v.unit::text, v.stage::text, v.time_min::numeric, v.ord
from r, (values
    ('malt', '2-Row', 330, null, null, null, 0),
    ('malt', 'Flaked Wheat', 20, null, null, null, 1),
    ('malt', 'Carafoam', 20, null, null, null, 2),
    ('malt', 'Caramunich I', 20, null, null, null, 3),
    ('hop', 'CTZ', 36, null, 'boil', 60, 0),
    ('hop', 'Cascade', 10, null, 'boil', 10, 1),
    ('hop', 'Amarillo', 12, null, 'whirlpool', 15, 2),
    ('hop', 'Cascade', 12, null, 'whirlpool', 15, 3),
    ('hop', 'Amarillo', 48, null, 'dryhop', 0, 4),
    ('hop', 'Cascade', 48, null, 'dryhop', 0, 5),
    ('yeast', 'K97', 1, null, null, null, 0),
    ('adj', 'Lactose', 15, 'lbs', 'boil', 5, 0),
    ('adj', 'Mango Puree', 18, 'lbs', 'secondary', 0, 1)
) as v(category, name, qty, unit, stage, time_min, ord);

-- 8. Night Jörts
with r as (
  insert into recipes (name, style, og, fg, abv, mash_temp, ord)
  values ('Night Jörts', 'Czech Dark Lager', null, null, null, 152, 7) returning id
)
insert into recipe_ingredients (recipe_id, category, name, qty, unit, stage, time_min, ord)
select r.id, v.category, v.name, v.qty::numeric, v.unit::text, v.stage::text, v.time_min::numeric, v.ord
from r, (values
    ('malt', 'Pils', 185, null, null, null, 0),
    ('malt', 'Carafe III', 15, null, null, null, 1),
    ('malt', 'Carafoam', 8, null, null, null, 2),
    ('malt', 'Caramunich I', 8, null, null, null, 3),
    ('hop', 'Centennial', 16, null, 'boil', 60, 0),
    ('hop', 'Centennial', 6, null, 'boil', 5, 1),
    ('yeast', 'K97', 1, null, null, null, 0),
    ('adj', 'Clarity Ferm', 125, 'ml', 'fermentation', 0, 0),
    ('salt', 'CaCl2', 27, null, 'mash', null, 0),
    ('salt', 'CaSo4', 7, null, 'mash', null, 1)
) as v(category, name, qty, unit, stage, time_min, ord);

-- 9. Pinkety Drinkety
with r as (
  insert into recipes (name, style, og, fg, abv, mash_temp, ord)
  values ('Pinkety Drinkety', 'Cream Ale', null, null, null, 148, 8) returning id
)
insert into recipe_ingredients (recipe_id, category, name, qty, unit, stage, time_min, ord)
select r.id, v.category, v.name, v.qty::numeric, v.unit::text, v.stage::text, v.time_min::numeric, v.ord
from r, (values
    ('malt', 'Pils', 165, null, null, null, 0),
    ('malt', 'Flaked Corn', 20, null, null, null, 1),
    ('malt', 'Carafoam', 5, null, null, null, 2),
    ('hop', 'CTZ', 5, null, 'boil', 60, 0),
    ('hop', 'Saaz', 5, null, 'boil', 5, 1),
    ('yeast', 'K97', 10, null, null, null, 0),
    ('adj', 'Straw/Rhubarb', 62, 'oz', 'secondary', 0, 0),
    ('adj', 'Clarity Ferm', 125, 'ml', 'fermentation', 0, 1)
) as v(category, name, qty, unit, stage, time_min, ord);

-- 10. Red Panda
with r as (
  insert into recipes (name, style, og, fg, abv, mash_temp, ord)
  values ('Red Panda', 'Belgian Tripel', null, null, null, 152, 9) returning id
)
insert into recipe_ingredients (recipe_id, category, name, qty, unit, stage, time_min, ord)
select r.id, v.category, v.name, v.qty::numeric, v.unit::text, v.stage::text, v.time_min::numeric, v.ord
from r, (values
    ('malt', 'Pils', 300, null, null, null, 0),
    ('malt', 'Caramunich I', 20, null, null, null, 1),
    ('malt', 'Aromatic', 15, null, null, null, 2),
    ('malt', 'Carafoam', 12, null, null, null, 3),
    ('malt', 'Roasted Barley', 2, null, null, null, 4),
    ('hop', 'CTZ', 14, null, 'boil', 60, 0),
    ('hop', 'Saaz', 8, null, 'boil', 5, 1),
    ('yeast', 'BE-256', 1, null, null, null, 0),
    ('adj', 'Honey', 18, 'lbs', 'boil', 60, 0),
    ('adj', 'Whirlfloc', 12, 'each', 'boil', 15, 1),
    ('salt', 'CaSo4', 51.87, null, 'mash', null, 0),
    ('salt', 'Chalk', 42, null, 'mash', null, 1),
    ('salt', 'CaCl2', 20, null, 'mash', null, 2),
    ('salt', 'Salt', 15, null, 'mash', null, 3),
    ('salt', 'CaSo4', 12, null, 'boil', null, 4),
    ('salt', 'Chalk', 10, null, 'boil', null, 5),
    ('salt', 'CaCl2', 5, null, 'boil', null, 6),
    ('salt', 'Salt', 4, null, 'boil', null, 7)
) as v(category, name, qty, unit, stage, time_min, ord);

-- 11. Scarlett
with r as (
  insert into recipes (name, style, og, fg, abv, mash_temp, ord)
  values ('Scarlett', 'Red IPA', null, null, null, 154, 10) returning id
)
insert into recipe_ingredients (recipe_id, category, name, qty, unit, stage, time_min, ord)
select r.id, v.category, v.name, v.qty::numeric, v.unit::text, v.stage::text, v.time_min::numeric, v.ord
from r, (values
    ('malt', '2-Row', 110, null, null, null, 0),
    ('malt', 'Maris Otter', 110, null, null, null, 1),
    ('malt', 'Munich', 55, null, null, null, 2),
    ('malt', 'Caramunich I', 30, null, null, null, 3),
    ('malt', 'Roasted Barley', 4, null, null, null, 4),
    ('hop', 'Chinook', 18, null, 'boil', 60, 0),
    ('hop', 'Centennial', 18, null, 'boil', 15, 1),
    ('hop', 'Cascade', 18, null, 'boil', 10, 2),
    ('hop', 'Centennial', 42, null, 'whirlpool', 60, 3),
    ('hop', 'Cascade', 36, null, 'dryhop', 0, 4),
    ('yeast', 'DA-16', 1, null, null, null, 0),
    ('salt', 'CaSo4', 68, null, 'mash', null, 0),
    ('salt', 'CaCl2', 35, null, 'mash', null, 1),
    ('salt', 'CaSo4', 33, null, 'boil', null, 2),
    ('salt', 'CaCl2', 18, null, 'boil', null, 3)
) as v(category, name, qty, unit, stage, time_min, ord);

-- 12. Sheriff Bart IPA
with r as (
  insert into recipes (name, style, og, fg, abv, mash_temp, ord)
  values ('Sheriff Bart IPA', 'Black IPA', null, null, null, 152, 11) returning id
)
insert into recipe_ingredients (recipe_id, category, name, qty, unit, stage, time_min, ord)
select r.id, v.category, v.name, v.qty::numeric, v.unit::text, v.stage::text, v.time_min::numeric, v.ord
from r, (values
    ('malt', '2-Row', 275, null, null, null, 0),
    ('malt', 'Caramunich I', 22, null, null, null, 1),
    ('malt', 'Midnight Wheat', 22, null, null, null, 2),
    ('malt', 'Chocolate', 5, null, null, null, 3),
    ('hop', 'CTZ', 12, null, 'boil', 60, 0),
    ('hop', 'Chinook', 16, null, 'boil', 20, 1),
    ('hop', 'Cascade', 32, null, 'dryhop', 0, 2),
    ('hop', 'CTZ', 8, null, 'boil', 20, 3),
    ('hop', 'CTZ', 24, null, 'boil', 5, 4),
    ('hop', 'CTZ', 32, null, 'dryhop', 0, 5),
    ('yeast', 'US-05', 1, null, null, null, 0),
    ('adj', 'Whirlfloc', 12, 'each', 'boil', 15, 0),
    ('salt', 'CaSo4', 48, null, 'mash', null, 0),
    ('salt', 'CaCl2', 45, null, 'mash', null, 1),
    ('salt', 'Epsom', 28, null, 'mash', null, 2),
    ('salt', 'CaSo4', 48, null, 'boil', null, 3),
    ('salt', 'CaCl2', 40, null, 'boil', null, 4),
    ('salt', 'Epsom', 28, null, 'boil', null, 5)
) as v(category, name, qty, unit, stage, time_min, ord);

-- 13. Shortea Jörts
with r as (
  insert into recipes (name, style, og, fg, abv, mash_temp, ord)
  values ('Shortea Jörts', 'Kölsch', null, null, null, 152, 12) returning id
)
insert into recipe_ingredients (recipe_id, category, name, qty, unit, stage, time_min, ord)
select r.id, v.category, v.name, v.qty::numeric, v.unit::text, v.stage::text, v.time_min::numeric, v.ord
from r, (values
    ('malt', 'Pils', 165, null, null, null, 0),
    ('malt', 'Vienna', 15, null, null, null, 1),
    ('malt', 'Carafoam', 5, null, null, null, 2),
    ('hop', 'Citra', 8, null, 'boil', 60, 0),
    ('hop', 'Citra', 6, null, 'boil', 5, 1),
    ('yeast', 'K97', 1, null, null, null, 0),
    ('adj', 'Lemon', 32, 'oz', 'boil', 0, 0),
    ('adj', 'Clarity Ferm', 125, 'ml', 'fermentation', 0, 1),
    ('salt', 'Lactic Acid', 50, null, 'mash', null, 0),
    ('salt', 'CaCl2', 18, null, 'mash', null, 1),
    ('salt', 'Epsom', 11, null, 'mash', null, 2),
    ('salt', 'CaSo4', 9, null, 'mash', null, 3),
    ('salt', 'CaCl2', 30, null, 'boil', null, 4),
    ('salt', 'Epsom', 18, null, 'boil', null, 5),
    ('salt', 'CaSo4', 15, null, 'boil', null, 6)
) as v(category, name, qty, unit, stage, time_min, ord);

-- 14. Situation IPA
with r as (
  insert into recipes (name, style, og, fg, abv, mash_temp, ord)
  values ('Situation IPA', 'American IPA', null, null, null, 152, 13) returning id
)
insert into recipe_ingredients (recipe_id, category, name, qty, unit, stage, time_min, ord)
select r.id, v.category, v.name, v.qty::numeric, v.unit::text, v.stage::text, v.time_min::numeric, v.ord
from r, (values
    ('malt', '2-Row', 235, null, null, null, 0),
    ('malt', 'Caramunich I', 30, null, null, null, 1),
    ('malt', 'White Wheat', 20, null, null, null, 2),
    ('malt', 'Carafoam', 15, null, null, null, 3),
    ('malt', 'Aromatic', 10, null, null, null, 4),
    ('malt', 'Roasted Barley', 1, null, null, null, 5),
    ('hop', 'Chinook', 5, null, 'boil', 75, 0),
    ('hop', 'CTZ', 20, null, 'boil', 60, 1),
    ('hop', 'Cascade', 8, null, 'boil', 20, 2),
    ('hop', 'Chinook', 10, null, 'boil', 7.5, 3),
    ('hop', 'Amarillo', 12, null, 'boil', 5, 4),
    ('hop', 'Amarillo', 12, null, 'whirlpool', 15, 5),
    ('hop', 'Chinook', 12, null, 'whirlpool', 15, 6),
    ('hop', 'Centennial', 48, null, 'dryhop', 0, 7),
    ('hop', 'Chinook', 48, null, 'dryhop', 0, 8),
    ('yeast', 'K97', 1, null, null, null, 0),
    ('adj', 'Clarity Ferm', 125, 'ml', 'fermentation', 0, 0),
    ('salt', 'CaSo4', 58, null, 'mash', null, 0),
    ('salt', 'CaCl2', 52, null, 'mash', null, 1),
    ('salt', 'Epsom', 34, null, 'mash', null, 2),
    ('salt', 'Lactic Acid', 20, null, 'mash', null, 3),
    ('salt', 'CaSo4', 54, null, 'boil', null, 4),
    ('salt', 'Chalk', 50, null, 'boil', null, 5),
    ('salt', 'CaCl2', 48, null, 'boil', null, 6),
    ('salt', 'Epsom', 32, null, 'boil', null, 7)
) as v(category, name, qty, unit, stage, time_min, ord);

-- 15. Spruced Up
with r as (
  insert into recipes (name, style, og, fg, abv, mash_temp, ord)
  values ('Spruced Up', 'American Pale Ale', null, null, null, 152, 14) returning id
)
insert into recipe_ingredients (recipe_id, category, name, qty, unit, stage, time_min, ord)
select r.id, v.category, v.name, v.qty::numeric, v.unit::text, v.stage::text, v.time_min::numeric, v.ord
from r, (values
    ('malt', '2-Row', 110, null, null, null, 0),
    ('malt', 'Pils', 110, null, null, null, 1),
    ('malt', 'Caramunich I', 25, null, null, null, 2),
    ('malt', 'Carafoam', 10, null, null, null, 3),
    ('malt', 'Aromatic', 8, null, null, null, 4),
    ('hop', 'CTZ', 12, null, 'boil', 60, 0),
    ('hop', 'Cascade', 24, null, 'boil', 15, 1),
    ('hop', 'Cascade', 24, null, 'boil', 5, 2),
    ('hop', 'Cascade', 24, null, 'whirlpool', 5, 3),
    ('hop', 'Cascade', 32, null, 'dryhop', 0, 4),
    ('yeast', 'K97', 1, null, null, null, 0),
    ('adj', 'Clarity Ferm', 125, 'ml', 'fermentation', 0, 0)
) as v(category, name, qty, unit, stage, time_min, ord);

-- 16. Stretchy Jörts
with r as (
  insert into recipes (name, style, og, fg, abv, mash_temp, ord)
  values ('Stretchy Jörts', 'Kölsch', null, null, null, 152, 15) returning id
)
insert into recipe_ingredients (recipe_id, category, name, qty, unit, stage, time_min, ord)
select r.id, v.category, v.name, v.qty::numeric, v.unit::text, v.stage::text, v.time_min::numeric, v.ord
from r, (values
    ('malt', 'Pils', 165, null, null, null, 0),
    ('malt', 'Vienna', 20, null, null, null, 1),
    ('malt', 'Carafoam', 5, null, null, null, 2),
    ('hop', 'Saaz', 12, null, 'boil', 60, 0),
    ('hop', 'Saaz', 6, null, 'boil', 5, 1),
    ('hop', 'Saaz', 8, null, 'whirlpool', 20, 2),
    ('yeast', 'K97', 1, null, null, null, 0),
    ('adj', 'Clarity Ferm', 125, 'ml', 'fermentation', 0, 0),
    ('salt', 'Chalk', 137, null, 'mash', null, 0),
    ('salt', 'Epsom', 137, null, 'mash', null, 1),
    ('salt', 'CaCl2', 34, null, 'mash', null, 2),
    ('salt', 'CaSo4', 23, null, 'mash', null, 3),
    ('salt', 'Lactic Acid', 20, null, 'mash', null, 4),
    ('salt', 'Chalk', 232, null, 'boil', null, 5),
    ('salt', 'Epsom', 232, null, 'boil', null, 6),
    ('salt', 'CaCl2', 58, null, 'boil', null, 7),
    ('salt', 'CaSo4', 39, null, 'boil', null, 8)
) as v(category, name, qty, unit, stage, time_min, ord);

-- 17. Wicked Tickle
with r as (
  insert into recipes (name, style, og, fg, abv, mash_temp, ord)
  values ('Wicked Tickle', 'American Porter', null, null, null, 152, 16) returning id
)
insert into recipe_ingredients (recipe_id, category, name, qty, unit, stage, time_min, ord)
select r.id, v.category, v.name, v.qty::numeric, v.unit::text, v.stage::text, v.time_min::numeric, v.ord
from r, (values
    ('malt', '2-Row', 110, null, null, null, 0),
    ('malt', 'Maris Otter', 110, null, null, null, 1),
    ('malt', 'Caramunich I', 55, null, null, null, 2),
    ('malt', 'Black Patent', 12, null, null, null, 3),
    ('malt', 'Chocolate', 10, null, null, null, 4),
    ('malt', 'Carafoam', 8, null, null, null, 5),
    ('malt', 'Roasted Barley', 8, null, null, null, 6),
    ('hop', 'CTZ', 14, null, 'firstwort', 90, 0),
    ('hop', 'Willamette', 8, null, 'boil', 15, 1),
    ('hop', 'Willamette', 8, null, 'boil', 5, 2),
    ('yeast', 'S-04', 1, null, null, null, 0),
    ('adj', 'Lactose', 5, 'lbs', 'boil', 5, 0),
    ('adj', 'Whirlfloc', 12, 'each', 'boil', 15, 1),
    ('adj', 'Ghost Peppers', 1, 'each', 'secondary', 0, 2),
    ('salt', 'CaCl2', 120, null, 'mash', null, 0),
    ('salt', 'CaSo4', 30, null, 'mash', null, 1),
    ('salt', 'Epsom', 5, null, 'mash', null, 2),
    ('salt', 'CaCl2', 100, null, 'boil', null, 3),
    ('salt', 'CaSo4', 20, null, 'boil', null, 4),
    ('salt', 'Epsom', 5, null, 'boil', null, 5)
) as v(category, name, qty, unit, stage, time_min, ord);

-- 18. Wit's End
with r as (
  insert into recipes (name, style, og, fg, abv, mash_temp, ord)
  values ('Wit''s End', 'Witbier', null, null, null, 152, 17) returning id
)
insert into recipe_ingredients (recipe_id, category, name, qty, unit, stage, time_min, ord)
select r.id, v.category, v.name, v.qty::numeric, v.unit::text, v.stage::text, v.time_min::numeric, v.ord
from r, (values
    ('malt', 'Pils', 220, null, null, null, 0),
    ('malt', 'White Wheat', 55, null, null, null, 1),
    ('malt', 'Flaked Wheat', 22, null, null, null, 2),
    ('malt', 'Carafoam', 10, null, null, null, 3),
    ('hop', 'Cascade', 12, null, 'boil', 10, 0),
    ('hop', 'Amarillo', 16, null, 'boil', 7.5, 1),
    ('hop', 'Cascade', 12, null, 'boil', 5, 2),
    ('hop', 'Amarillo', 12, null, 'whirlpool', 20, 3),
    ('hop', 'Cascade', 12, null, 'whirlpool', 20, 4),
    ('hop', 'Amarillo', 48, null, 'dryhop', 0, 5),
    ('hop', 'Cascade', 48, null, 'dryhop', 0, 6),
    ('hop', 'CTZ', 4, null, 'boil', 60, 7),
    ('yeast', 'BE-256', 1, null, null, null, 0),
    ('adj', 'Coriander', 1, 'oz', 'boil', 0, 0),
    ('adj', 'Orange Peel', 1, 'oz', 'boil', 0, 1)
) as v(category, name, qty, unit, stage, time_min, ord);

-- Cellar schedules. Only All Y'alls' schedule is known; other recipes start
-- empty and get filled in-app (Recipes tab → Cellar Schedule).
insert into recipe_schedule (recipe_id, day, action, ord)
select r.id, v.day, v.action, v.ord
from recipes r, (values
    (0,  'Brew Date',        0),
    (11, 'Step Crash 55',    1),
    (11, 'Bung | Pressure',  2),
    (12, 'Blow Off',         3),
    (12, 'Dry Hop',          4),
    (13, 'Mini Blow Off',    5),
    (13, 'Rouse',            6),
    (13, 'Step Crash 40',    7),
    (14, 'Blow Off',         8),
    (14, 'Step Crash 33',    9),
    (19, 'Blow Off',        10),
    (19, 'Transfer',        11),
    (20, 'Blow Off',        12),
    (20, 'Keg',             13)
) as v(day, action, ord)
where r.name = 'All Y''alls';

commit;
