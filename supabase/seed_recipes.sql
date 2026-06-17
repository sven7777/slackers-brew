-- Slackers Brewing — seed recipes from Derek's localStorage into Supabase (roadmap Step 6)
-- Run once in the Supabase SQL Editor while the recipes tables are empty.
-- Each recipe is inserted with its ingredients in a single CTE so the FK links cleanly.

begin;

-- 1. All Y'alls
with r as (
  insert into recipes (name, style, ord) values ('All Y''alls', 'NEIPA', 0) returning id
)
insert into recipe_ingredients (recipe_id, category, name, qty, unit, ord)
select r.id, v.category, v.name, v.qty, v.unit, v.ord from r, (values
    ('malt', '2-Row', 185, null, 0),
    ('malt', 'White Wheat', 55, null, 1),
    ('malt', 'Flaked Wheat', 35, null, 2),
    ('malt', 'Flaked Oat', 15, null, 3),
    ('hop', 'Cascade', 84, null, 0),
    ('hop', 'Amarillo', 40, null, 1),
    ('hop', 'Chinook', 8, null, 2),
    ('hop', 'Mosaic', 48, null, 3),
    ('hop', 'Simcoe', 16, null, 4),
    ('yeast', 'K97', 1, null, 0)
) as v(category, name, qty, unit, ord);

-- 2. Beachcomber
with r as (
  insert into recipes (name, style, ord) values ('Beachcomber', 'Belgian Blond', 1) returning id
)
insert into recipe_ingredients (recipe_id, category, name, qty, unit, ord)
select r.id, v.category, v.name, v.qty, v.unit, v.ord from r, (values
    ('malt', 'Pils', 110, null, 0),
    ('malt', 'White Wheat', 55, null, 1),
    ('malt', 'Vienna', 15, null, 2),
    ('malt', 'Flaked Wheat', 15, null, 3),
    ('malt', 'Carafoam', 10, null, 4),
    ('hop', 'Amarillo', 15, null, 0),
    ('hop', 'Crystal', 8, null, 1),
    ('yeast', 'BE-134', 1, null, 0),
    ('adj', 'Candi Syrup', 5, 'lbs', 0)
) as v(category, name, qty, unit, ord);

-- 3. Coffee Snout
with r as (
  insert into recipes (name, style, ord) values ('Coffee Snout', 'Baltic Porter', 2) returning id
)
insert into recipe_ingredients (recipe_id, category, name, qty, unit, ord)
select r.id, v.category, v.name, v.qty, v.unit, v.ord from r, (values
    ('malt', 'Maris Otter', 165, null, 0),
    ('malt', '2-Row', 110, null, 1),
    ('malt', 'Munich', 40, null, 2),
    ('malt', 'Caramunich I', 15, null, 3),
    ('malt', 'Chocolate', 12, null, 4),
    ('malt', 'Roasted Barley', 8, null, 5),
    ('malt', 'Carafoam', 5, null, 6),
    ('hop', 'CTZ', 12, null, 0),
    ('hop', 'Willamette', 12, null, 1),
    ('yeast', 'S-04', 1, null, 0),
    ('adj', 'Coffee', 5, 'lbs', 0)
) as v(category, name, qty, unit, ord);

-- 4. Hefelump
with r as (
  insert into recipes (name, style, ord) values ('Hefelump', 'Weissbier', 3) returning id
)
insert into recipe_ingredients (recipe_id, category, name, qty, unit, ord)
select r.id, v.category, v.name, v.qty, v.unit, v.ord from r, (values
    ('malt', 'Pils', 110, null, 0),
    ('malt', 'White Wheat', 110, null, 1),
    ('malt', 'Caramunich I', 15, null, 2),
    ('malt', 'Carafoam', 10, null, 3),
    ('malt', 'Vienna', 10, null, 4),
    ('hop', 'Saaz', 20, null, 0),
    ('yeast', 'WB-06', 1, null, 0),
    ('adj', 'Orange Peel', 3, 'oz', 0)
) as v(category, name, qty, unit, ord);

-- 5. James
with r as (
  insert into recipes (name, style, ord) values ('James', 'American Brown', 4) returning id
)
insert into recipe_ingredients (recipe_id, category, name, qty, unit, ord)
select r.id, v.category, v.name, v.qty, v.unit, v.ord from r, (values
    ('malt', '2-Row', 110, null, 0),
    ('malt', 'Maris Otter', 110, null, 1),
    ('malt', 'Caramunich I', 35, null, 2),
    ('malt', 'Chocolate', 15, null, 3),
    ('malt', 'Carafoam', 10, null, 4),
    ('hop', 'CTZ', 10, null, 0),
    ('hop', 'Willamette', 4, null, 1),
    ('yeast', 'S-04', 1, null, 0),
    ('adj', 'Clarity Ferm', 125, 'ml', 0)
) as v(category, name, qty, unit, ord);

-- 6. Leder Jörtsen
with r as (
  insert into recipes (name, style, ord) values ('Leder Jörtsen', 'Festbier', 5) returning id
)
insert into recipe_ingredients (recipe_id, category, name, qty, unit, ord)
select r.id, v.category, v.name, v.qty, v.unit, v.ord from r, (values
    ('malt', 'Munich', 110, null, 0),
    ('malt', 'Pils', 110, null, 1),
    ('malt', 'Vienna', 15, null, 2),
    ('malt', 'Carafoam', 10, null, 3),
    ('malt', 'Caramunich I', 10, null, 4),
    ('hop', 'Amarillo', 18, null, 0),
    ('hop', 'Saaz', 18, null, 1),
    ('yeast', 'K97', 1, null, 0),
    ('adj', 'Clarity Ferm', 125, 'ml', 0)
) as v(category, name, qty, unit, ord);

-- 7. Mango Unchained
with r as (
  insert into recipes (name, style, ord) values ('Mango Unchained', 'Double IPA', 6) returning id
)
insert into recipe_ingredients (recipe_id, category, name, qty, unit, ord)
select r.id, v.category, v.name, v.qty, v.unit, v.ord from r, (values
    ('malt', '2-Row', 330, null, 0),
    ('malt', 'Flaked Wheat', 20, null, 1),
    ('malt', 'Carafoam', 20, null, 2),
    ('malt', 'Caramunich I', 20, null, 3),
    ('hop', 'CTZ', 36, null, 0),
    ('hop', 'Cascade', 70, null, 1),
    ('hop', 'Amarillo', 60, null, 2),
    ('yeast', 'K97', 1, null, 0),
    ('adj', 'Lactose', 15, 'lbs', 0),
    ('adj', 'Mango Puree', 18, 'lbs', 1)
) as v(category, name, qty, unit, ord);

-- 8. Night Jörts
with r as (
  insert into recipes (name, style, ord) values ('Night Jörts', 'Czech Dark Lager', 7) returning id
)
insert into recipe_ingredients (recipe_id, category, name, qty, unit, ord)
select r.id, v.category, v.name, v.qty, v.unit, v.ord from r, (values
    ('malt', 'Pils', 185, null, 0),
    ('malt', 'Carafe III', 15, null, 1),
    ('malt', 'Carafoam', 8, null, 2),
    ('malt', 'Caramunich I', 8, null, 3),
    ('hop', 'Centennial', 22, null, 0),
    ('yeast', 'K97', 1, null, 0),
    ('adj', 'Clarity Ferm', 125, 'ml', 0)
) as v(category, name, qty, unit, ord);

-- 9. Pinkety Drinkety
with r as (
  insert into recipes (name, style, ord) values ('Pinkety Drinkety', 'Cream Ale', 8) returning id
)
insert into recipe_ingredients (recipe_id, category, name, qty, unit, ord)
select r.id, v.category, v.name, v.qty, v.unit, v.ord from r, (values
    ('malt', 'Pils', 165, null, 0),
    ('malt', 'Flaked Corn', 20, null, 1),
    ('malt', 'Carafoam', 5, null, 2),
    ('hop', 'CTZ', 5, null, 0),
    ('hop', 'Saaz', 5, null, 1),
    ('yeast', 'K97', 1, null, 0),
    ('adj', 'Straw/Rhubarb', 62, 'oz', 0),
    ('adj', 'Clarity Ferm', 125, 'ml', 1)
) as v(category, name, qty, unit, ord);

-- 10. Red Panda
with r as (
  insert into recipes (name, style, ord) values ('Red Panda', 'Belgian Tripel', 9) returning id
)
insert into recipe_ingredients (recipe_id, category, name, qty, unit, ord)
select r.id, v.category, v.name, v.qty, v.unit, v.ord from r, (values
    ('malt', 'Pils', 300, null, 0),
    ('malt', 'Caramunich I', 20, null, 1),
    ('malt', 'Aromatic', 15, null, 2),
    ('malt', 'Carafoam', 12, null, 3),
    ('malt', 'Roasted Barley', 2, null, 4),
    ('hop', 'CTZ', 14, null, 0),
    ('hop', 'Saaz', 8, null, 1),
    ('yeast', 'BE-256', 1, null, 0),
    ('adj', 'Honey', 18, 'lbs', 0)
) as v(category, name, qty, unit, ord);

-- 11. Scarlett
with r as (
  insert into recipes (name, style, ord) values ('Scarlett', 'Red IPA', 10) returning id
)
insert into recipe_ingredients (recipe_id, category, name, qty, unit, ord)
select r.id, v.category, v.name, v.qty, v.unit, v.ord from r, (values
    ('malt', '2-Row', 110, null, 0),
    ('malt', 'Maris Otter', 110, null, 1),
    ('malt', 'Munich', 55, null, 2),
    ('malt', 'Caramunich I', 30, null, 3),
    ('malt', 'Roasted Barley', 4, null, 4),
    ('hop', 'Chinook', 18, null, 0),
    ('hop', 'Centennial', 60, null, 1),
    ('hop', 'Cascade', 54, null, 2),
    ('yeast', 'DA-16', 1, null, 0)
) as v(category, name, qty, unit, ord);

-- 12. Sheriff Bart IPA
with r as (
  insert into recipes (name, style, ord) values ('Sheriff Bart IPA', 'Black IPA', 11) returning id
)
insert into recipe_ingredients (recipe_id, category, name, qty, unit, ord)
select r.id, v.category, v.name, v.qty, v.unit, v.ord from r, (values
    ('malt', '2-Row', 275, null, 0),
    ('malt', 'Caramunich I', 22, null, 1),
    ('malt', 'Midnight Wheat', 22, null, 2),
    ('malt', 'Chocolate', 5, null, 3),
    ('hop', 'CTZ', 76, null, 0),
    ('hop', 'Chinook', 16, null, 1),
    ('hop', 'Cascade', 32, null, 2),
    ('yeast', 'US-05', 1, null, 0)
) as v(category, name, qty, unit, ord);

-- 13. Shortea Jörts
with r as (
  insert into recipes (name, style, ord) values ('Shortea Jörts', 'Kölsch', 12) returning id
)
insert into recipe_ingredients (recipe_id, category, name, qty, unit, ord)
select r.id, v.category, v.name, v.qty, v.unit, v.ord from r, (values
    ('malt', 'Pils', 165, null, 0),
    ('malt', 'Vienna', 15, null, 1),
    ('malt', 'Carafoam', 5, null, 2),
    ('hop', 'Citra', 14, null, 0),
    ('yeast', 'K97', 1, null, 0),
    ('adj', 'Lemon', 32, 'oz', 0),
    ('adj', 'Clarity Ferm', 125, 'ml', 1)
) as v(category, name, qty, unit, ord);

-- 14. Situation IPA
with r as (
  insert into recipes (name, style, ord) values ('Situation IPA', 'American IPA', 13) returning id
)
insert into recipe_ingredients (recipe_id, category, name, qty, unit, ord)
select r.id, v.category, v.name, v.qty, v.unit, v.ord from r, (values
    ('malt', '2-Row', 235, null, 0),
    ('malt', 'Caramunich I', 30, null, 1),
    ('malt', 'White Wheat', 20, null, 2),
    ('malt', 'Carafoam', 15, null, 3),
    ('malt', 'Aromatic', 10, null, 4),
    ('malt', 'Roasted Barley', 1, null, 5),
    ('hop', 'Chinook', 70, null, 0),
    ('hop', 'CTZ', 20, null, 1),
    ('hop', 'Cascade', 8, null, 2),
    ('hop', 'Centennial', 72, null, 3),
    ('yeast', 'K97', 1, null, 0),
    ('adj', 'Clarity Ferm', 125, 'ml', 0)
) as v(category, name, qty, unit, ord);

-- 15. Spruced Up
with r as (
  insert into recipes (name, style, ord) values ('Spruced Up', 'American Pale Ale', 14) returning id
)
insert into recipe_ingredients (recipe_id, category, name, qty, unit, ord)
select r.id, v.category, v.name, v.qty, v.unit, v.ord from r, (values
    ('malt', '2-Row', 110, null, 0),
    ('malt', 'Pils', 110, null, 1),
    ('malt', 'Caramunich I', 25, null, 2),
    ('malt', 'Carafoam', 10, null, 3),
    ('malt', 'Aromatic', 8, null, 4),
    ('hop', 'CTZ', 12, null, 0),
    ('hop', 'Cascade', 104, null, 1),
    ('yeast', 'K97', 1, null, 0),
    ('adj', 'Clarity Ferm', 125, 'ml', 0)
) as v(category, name, qty, unit, ord);

-- 16. Stretchy Jörts
with r as (
  insert into recipes (name, style, ord) values ('Stretchy Jörts', 'Kölsch', 15) returning id
)
insert into recipe_ingredients (recipe_id, category, name, qty, unit, ord)
select r.id, v.category, v.name, v.qty, v.unit, v.ord from r, (values
    ('malt', 'Pils', 165, null, 0),
    ('malt', 'Vienna', 20, null, 1),
    ('malt', 'Carafoam', 5, null, 2),
    ('hop', 'Saaz', 26, null, 0),
    ('yeast', 'K97', 1, null, 0),
    ('adj', 'Clarity Ferm', 125, 'ml', 0)
) as v(category, name, qty, unit, ord);

-- 17. Wicked Tickle
with r as (
  insert into recipes (name, style, ord) values ('Wicked Tickle', 'American Porter', 16) returning id
)
insert into recipe_ingredients (recipe_id, category, name, qty, unit, ord)
select r.id, v.category, v.name, v.qty, v.unit, v.ord from r, (values
    ('malt', '2-Row', 110, null, 0),
    ('malt', 'Maris Otter', 110, null, 1),
    ('malt', 'Caramunich I', 55, null, 2),
    ('malt', 'Black Patent', 12, null, 3),
    ('malt', 'Chocolate', 10, null, 4),
    ('malt', 'Carafoam', 8, null, 5),
    ('malt', 'Roasted Barley', 8, null, 6),
    ('hop', 'CTZ', 14, null, 0),
    ('hop', 'Willamette', 16, null, 1),
    ('yeast', 'S-04', 1, null, 0),
    ('adj', 'Lactose', 5, 'lbs', 0),
    ('adj', 'Ghost Peppers', 1, 'each', 1)
) as v(category, name, qty, unit, ord);

-- 18. Wit's End
with r as (
  insert into recipes (name, style, ord) values ('Wit''s End', 'Witbier', 17) returning id
)
insert into recipe_ingredients (recipe_id, category, name, qty, unit, ord)
select r.id, v.category, v.name, v.qty, v.unit, v.ord from r, (values
    ('malt', 'Pils', 220, null, 0),
    ('malt', 'White Wheat', 55, null, 1),
    ('malt', 'Flaked Wheat', 22, null, 2),
    ('malt', 'Carafoam', 10, null, 3),
    ('hop', 'CTZ', 4, null, 0),
    ('hop', 'Cascade', 84, null, 1),
    ('hop', 'Amarillo', 76, null, 2),
    ('yeast', 'BE-256', 1, null, 0),
    ('adj', 'Coriander', 1, 'oz', 0),
    ('adj', 'Orange Peel', 1, 'oz', 1)
) as v(category, name, qty, unit, ord);

commit;
