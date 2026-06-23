-- Migration 0002: brew-day recipe data (roadmap PR1)
-- Matched by recipe name, sets targets/mash temp and FULLY REPLACES each
-- recipe's ingredient rows with the staged, BeerSmith-sourced schedule.
-- Source: ~/Downloads/Slackers20260402.bsmx via src/lib/beersmith.js.
-- WARNING: overwrites recipe_ingredients for these recipes — any manual recipe
-- edits made in the app since seeding will be replaced. Run 0001 first.
-- Re-runnable.

do $$
declare rid uuid;
begin
  -- All Y'alls
  select id into rid from recipes where name = 'All Y''alls';
  if rid is not null then
    update recipes set og=null, fg=null, abv=null, mash_temp=155 where id=rid;
    delete from recipe_ingredients where recipe_id=rid;
    insert into recipe_ingredients (recipe_id,category,name,qty,unit,stage,time_min,ord) values
    (rid,'malt','2-Row',185,null,null,null,0),
    (rid,'malt','White Wheat',55,null,null,null,1),
    (rid,'malt','Flaked Wheat',35,null,null,null,2),
    (rid,'malt','Flaked Oat',15,null,null,null,3),
    (rid,'hop','Cascade',12,null,'boil',10,0),
    (rid,'hop','Amarillo',16,null,'boil',7.5,1),
    (rid,'hop','Cascade',12,null,'boil',5,2),
    (rid,'hop','Amarillo',12,null,'whirlpool',20,3),
    (rid,'hop','Cascade',12,null,'whirlpool',20,4),
    (rid,'hop','Chinook',8,null,'whirlpool',20,5),
    (rid,'hop','Cascade',48,null,'dryhop',0,6),
    (rid,'hop','Mosaic',48,null,'dryhop',0,7),
    (rid,'hop','Simcoe',16,null,'dryhop',0,8),
    (rid,'yeast','K97',1,null,null,null,0),
    (rid,'salt','CaCl2',100,null,'mash',null,0),
    (rid,'salt','CaSo4',40,null,'mash',null,1),
    (rid,'salt','CaCl2',80,null,'sparge',null,2),
    (rid,'salt','CaSo4',32,null,'sparge',null,3);
  end if;

  -- Beachcomber
  select id into rid from recipes where name = 'Beachcomber';
  if rid is not null then
    update recipes set og=null, fg=null, abv=null, mash_temp=152 where id=rid;
    delete from recipe_ingredients where recipe_id=rid;
    insert into recipe_ingredients (recipe_id,category,name,qty,unit,stage,time_min,ord) values
    (rid,'malt','Pils',110,null,null,null,0),
    (rid,'malt','White Wheat',55,null,null,null,1),
    (rid,'malt','Vienna',15,null,null,null,2),
    (rid,'malt','Flaked Wheat',15,null,null,null,3),
    (rid,'malt','Carafoam',10,null,null,null,4),
    (rid,'hop','Amarillo',15,null,'boil',60,0),
    (rid,'hop','Crystal',8,null,'boil',5,1),
    (rid,'yeast','BE-134',1,null,null,null,0),
    (rid,'adj','Candi Syrup',5,'lbs','boil',15,0);
  end if;

  -- Coffee Snout
  select id into rid from recipes where name = 'Coffee Snout';
  if rid is not null then
    update recipes set og=null, fg=null, abv=null, mash_temp=154 where id=rid;
    delete from recipe_ingredients where recipe_id=rid;
    insert into recipe_ingredients (recipe_id,category,name,qty,unit,stage,time_min,ord) values
    (rid,'malt','Maris Otter',165,null,null,null,0),
    (rid,'malt','2-Row',110,null,null,null,1),
    (rid,'malt','Munich',40,null,null,null,2),
    (rid,'malt','Caramunich I',15,null,null,null,3),
    (rid,'malt','Chocolate',12,null,null,null,4),
    (rid,'malt','Roasted Barley',8,null,null,null,5),
    (rid,'malt','Carafoam',5,null,null,null,6),
    (rid,'hop','CTZ',12,null,'boil',60,0),
    (rid,'hop','Willamette',12,null,'boil',5,1),
    (rid,'yeast','S-04',1,null,null,null,0),
    (rid,'adj','Coffee',5,'lbs','secondary',0,0),
    (rid,'salt','CaSo4',60,null,'mash',null,0),
    (rid,'salt','Baking Soda',50,null,'mash',null,1),
    (rid,'salt','Salt',7,null,'mash',null,2),
    (rid,'salt','CaSo4',32,null,'sparge',null,3),
    (rid,'salt','Baking Soda',30,null,'sparge',null,4),
    (rid,'salt','Salt',4,null,'sparge',null,5);
  end if;

  -- Hefelump
  select id into rid from recipes where name = 'Hefelump';
  if rid is not null then
    update recipes set og=null, fg=null, abv=null, mash_temp=152 where id=rid;
    delete from recipe_ingredients where recipe_id=rid;
    insert into recipe_ingredients (recipe_id,category,name,qty,unit,stage,time_min,ord) values
    (rid,'malt','Pils',110,null,null,null,0),
    (rid,'malt','White Wheat',110,null,null,null,1),
    (rid,'malt','Caramunich I',15,null,null,null,2),
    (rid,'malt','Carafoam',10,null,null,null,3),
    (rid,'malt','Vienna',10,null,null,null,4),
    (rid,'hop','Saaz',14,null,'boil',60,0),
    (rid,'hop','Saaz',6,null,'boil',5,1),
    (rid,'yeast','WB-06',1,null,null,null,0),
    (rid,'adj','Orange Peel',3,'oz','boil',15,0),
    (rid,'salt','Chalk',11,null,'mash',null,0),
    (rid,'salt','Baking Soda',5,null,'mash',null,1),
    (rid,'salt','Chalk',95,null,'boil',null,2),
    (rid,'salt','Baking Soda',40,null,'boil',null,3);
  end if;

  -- James
  select id into rid from recipes where name = 'James';
  if rid is not null then
    update recipes set og=null, fg=null, abv=null, mash_temp=154 where id=rid;
    delete from recipe_ingredients where recipe_id=rid;
    insert into recipe_ingredients (recipe_id,category,name,qty,unit,stage,time_min,ord) values
    (rid,'malt','2-Row',110,null,null,null,0),
    (rid,'malt','Maris Otter',110,null,null,null,1),
    (rid,'malt','Caramunich I',35,null,null,null,2),
    (rid,'malt','Chocolate',15,null,null,null,3),
    (rid,'malt','Carafoam',10,null,null,null,4),
    (rid,'hop','CTZ',10,null,'boil',60,0),
    (rid,'hop','Willamette',4,null,'boil',15,1),
    (rid,'yeast','S-04',1,null,null,null,0),
    (rid,'adj','Clarity Ferm',125,'ml','fermentation',0,0),
    (rid,'salt','Lactic Acid',50,null,'mash',null,0),
    (rid,'salt','CaSo4',48,null,'mash',null,1),
    (rid,'salt','Baking Soda',42,null,'mash',null,2),
    (rid,'salt','Chalk',10,null,'mash',null,3),
    (rid,'salt','Salt',6,null,'mash',null,4),
    (rid,'salt','CaSo4',42,null,'boil',null,5),
    (rid,'salt','Baking Soda',35,null,'boil',null,6),
    (rid,'salt','Chalk',6,null,'boil',null,7),
    (rid,'salt','Salt',5,null,'boil',null,8);
  end if;

  -- Leder Jörtsen
  select id into rid from recipes where name = 'Leder Jörtsen';
  if rid is not null then
    update recipes set og=null, fg=null, abv=null, mash_temp=152 where id=rid;
    delete from recipe_ingredients where recipe_id=rid;
    insert into recipe_ingredients (recipe_id,category,name,qty,unit,stage,time_min,ord) values
    (rid,'malt','Munich',110,null,null,null,0),
    (rid,'malt','Pils',110,null,null,null,1),
    (rid,'malt','Vienna',15,null,null,null,2),
    (rid,'malt','Carafoam',10,null,null,null,3),
    (rid,'malt','Caramunich I',10,null,null,null,4),
    (rid,'hop','Amarillo',18,null,'boil',60,0),
    (rid,'hop','Saaz',8,null,'boil',20,1),
    (rid,'hop','Saaz',10,null,'boil',5,2),
    (rid,'yeast','K97',1,null,null,null,0),
    (rid,'adj','Clarity Ferm',125,'ml','fermentation',0,0),
    (rid,'salt','Chalk',58,null,'mash',null,0),
    (rid,'salt','Baking Soda',24,null,'mash',null,1),
    (rid,'salt','Chalk',73,null,'boil',null,2),
    (rid,'salt','Baking Soda',30,null,'boil',null,3);
  end if;

  -- Mango Unchained
  select id into rid from recipes where name = 'Mango Unchained';
  if rid is not null then
    update recipes set og=null, fg=null, abv=null, mash_temp=152 where id=rid;
    delete from recipe_ingredients where recipe_id=rid;
    insert into recipe_ingredients (recipe_id,category,name,qty,unit,stage,time_min,ord) values
    (rid,'malt','2-Row',330,null,null,null,0),
    (rid,'malt','Flaked Wheat',20,null,null,null,1),
    (rid,'malt','Carafoam',20,null,null,null,2),
    (rid,'malt','Caramunich I',20,null,null,null,3),
    (rid,'hop','CTZ',36,null,'boil',60,0),
    (rid,'hop','Cascade',10,null,'boil',10,1),
    (rid,'hop','Amarillo',12,null,'whirlpool',15,2),
    (rid,'hop','Cascade',12,null,'whirlpool',15,3),
    (rid,'hop','Amarillo',48,null,'dryhop',0,4),
    (rid,'hop','Cascade',48,null,'dryhop',0,5),
    (rid,'yeast','K97',1,null,null,null,0),
    (rid,'adj','Lactose',15,'lbs','boil',5,0),
    (rid,'adj','Mango Puree',18,'lbs','secondary',0,1);
  end if;

  -- Night Jörts
  select id into rid from recipes where name = 'Night Jörts';
  if rid is not null then
    update recipes set og=null, fg=null, abv=null, mash_temp=152 where id=rid;
    delete from recipe_ingredients where recipe_id=rid;
    insert into recipe_ingredients (recipe_id,category,name,qty,unit,stage,time_min,ord) values
    (rid,'malt','Pils',185,null,null,null,0),
    (rid,'malt','Carafe III',15,null,null,null,1),
    (rid,'malt','Carafoam',8,null,null,null,2),
    (rid,'malt','Caramunich I',8,null,null,null,3),
    (rid,'hop','Centennial',16,null,'boil',60,0),
    (rid,'hop','Centennial',6,null,'boil',5,1),
    (rid,'yeast','K97',1,null,null,null,0),
    (rid,'adj','Clarity Ferm',125,'ml','fermentation',0,0),
    (rid,'salt','CaCl2',27,null,'mash',null,0),
    (rid,'salt','CaSo4',7,null,'mash',null,1);
  end if;

  -- Pinkety Drinkety
  select id into rid from recipes where name = 'Pinkety Drinkety';
  if rid is not null then
    update recipes set og=null, fg=null, abv=null, mash_temp=148 where id=rid;
    delete from recipe_ingredients where recipe_id=rid;
    insert into recipe_ingredients (recipe_id,category,name,qty,unit,stage,time_min,ord) values
    (rid,'malt','Pils',165,null,null,null,0),
    (rid,'malt','Flaked Corn',20,null,null,null,1),
    (rid,'malt','Carafoam',5,null,null,null,2),
    (rid,'hop','CTZ',5,null,'boil',60,0),
    (rid,'hop','Saaz',5,null,'boil',5,1),
    (rid,'yeast','K97',10,null,null,null,0),
    (rid,'adj','Straw/Rhubarb',62,'oz','secondary',0,0),
    (rid,'adj','Clarity Ferm',125,'ml','fermentation',0,1);
  end if;

  -- Red Panda
  select id into rid from recipes where name = 'Red Panda';
  if rid is not null then
    update recipes set og=null, fg=null, abv=null, mash_temp=152 where id=rid;
    delete from recipe_ingredients where recipe_id=rid;
    insert into recipe_ingredients (recipe_id,category,name,qty,unit,stage,time_min,ord) values
    (rid,'malt','Pils',300,null,null,null,0),
    (rid,'malt','Caramunich I',20,null,null,null,1),
    (rid,'malt','Aromatic',15,null,null,null,2),
    (rid,'malt','Carafoam',12,null,null,null,3),
    (rid,'malt','Roasted Barley',2,null,null,null,4),
    (rid,'hop','CTZ',14,null,'boil',60,0),
    (rid,'hop','Saaz',8,null,'boil',5,1),
    (rid,'yeast','BE-256',1,null,null,null,0),
    (rid,'adj','Honey',18,'lbs','boil',60,0),
    (rid,'adj','Whirlfloc',12,'each','boil',15,1),
    (rid,'salt','CaSo4',51.87,null,'mash',null,0),
    (rid,'salt','Chalk',42,null,'mash',null,1),
    (rid,'salt','CaCl2',20,null,'mash',null,2),
    (rid,'salt','Salt',15,null,'mash',null,3),
    (rid,'salt','CaSo4',12,null,'boil',null,4),
    (rid,'salt','Chalk',10,null,'boil',null,5),
    (rid,'salt','CaCl2',5,null,'boil',null,6),
    (rid,'salt','Salt',4,null,'boil',null,7);
  end if;

  -- Scarlett
  select id into rid from recipes where name = 'Scarlett';
  if rid is not null then
    update recipes set og=null, fg=null, abv=null, mash_temp=154 where id=rid;
    delete from recipe_ingredients where recipe_id=rid;
    insert into recipe_ingredients (recipe_id,category,name,qty,unit,stage,time_min,ord) values
    (rid,'malt','2-Row',110,null,null,null,0),
    (rid,'malt','Maris Otter',110,null,null,null,1),
    (rid,'malt','Munich',55,null,null,null,2),
    (rid,'malt','Caramunich I',30,null,null,null,3),
    (rid,'malt','Roasted Barley',4,null,null,null,4),
    (rid,'hop','Chinook',18,null,'boil',60,0),
    (rid,'hop','Centennial',18,null,'boil',15,1),
    (rid,'hop','Cascade',18,null,'boil',10,2),
    (rid,'hop','Centennial',42,null,'whirlpool',60,3),
    (rid,'hop','Cascade',36,null,'dryhop',0,4),
    (rid,'yeast','DA-16',1,null,null,null,0),
    (rid,'salt','CaSo4',68,null,'mash',null,0),
    (rid,'salt','CaCl2',35,null,'mash',null,1),
    (rid,'salt','CaSo4',33,null,'boil',null,2),
    (rid,'salt','CaCl2',18,null,'boil',null,3);
  end if;

  -- Sheriff Bart IPA
  select id into rid from recipes where name = 'Sheriff Bart IPA';
  if rid is not null then
    update recipes set og=null, fg=null, abv=null, mash_temp=152 where id=rid;
    delete from recipe_ingredients where recipe_id=rid;
    insert into recipe_ingredients (recipe_id,category,name,qty,unit,stage,time_min,ord) values
    (rid,'malt','2-Row',275,null,null,null,0),
    (rid,'malt','Caramunich I',22,null,null,null,1),
    (rid,'malt','Midnight Wheat',22,null,null,null,2),
    (rid,'malt','Chocolate',5,null,null,null,3),
    (rid,'hop','CTZ',12,null,'boil',60,0),
    (rid,'hop','Chinook',16,null,'boil',20,1),
    (rid,'hop','Cascade',32,null,'dryhop',0,2),
    (rid,'hop','CTZ',8,null,'boil',20,3),
    (rid,'hop','CTZ',24,null,'boil',5,4),
    (rid,'hop','CTZ',32,null,'dryhop',0,5),
    (rid,'yeast','US-05',1,null,null,null,0),
    (rid,'adj','Whirlfloc',12,'each','boil',15,0),
    (rid,'salt','CaSo4',48,null,'mash',null,0),
    (rid,'salt','CaCl2',45,null,'mash',null,1),
    (rid,'salt','Epsom',28,null,'mash',null,2),
    (rid,'salt','CaSo4',48,null,'boil',null,3),
    (rid,'salt','CaCl2',40,null,'boil',null,4),
    (rid,'salt','Epsom',28,null,'boil',null,5);
  end if;

  -- Shortea Jörts
  select id into rid from recipes where name = 'Shortea Jörts';
  if rid is not null then
    update recipes set og=null, fg=null, abv=null, mash_temp=152 where id=rid;
    delete from recipe_ingredients where recipe_id=rid;
    insert into recipe_ingredients (recipe_id,category,name,qty,unit,stage,time_min,ord) values
    (rid,'malt','Pils',165,null,null,null,0),
    (rid,'malt','Vienna',15,null,null,null,1),
    (rid,'malt','Carafoam',5,null,null,null,2),
    (rid,'hop','Citra',8,null,'boil',60,0),
    (rid,'hop','Citra',6,null,'boil',5,1),
    (rid,'yeast','K97',1,null,null,null,0),
    (rid,'adj','Lemon',32,'oz','boil',0,0),
    (rid,'adj','Clarity Ferm',125,'ml','fermentation',0,1),
    (rid,'salt','Lactic Acid',50,null,'mash',null,0),
    (rid,'salt','CaCl2',18,null,'mash',null,1),
    (rid,'salt','Epsom',11,null,'mash',null,2),
    (rid,'salt','CaSo4',9,null,'mash',null,3),
    (rid,'salt','CaCl2',30,null,'boil',null,4),
    (rid,'salt','Epsom',18,null,'boil',null,5),
    (rid,'salt','CaSo4',15,null,'boil',null,6);
  end if;

  -- Situation IPA
  select id into rid from recipes where name = 'Situation IPA';
  if rid is not null then
    update recipes set og=null, fg=null, abv=null, mash_temp=152 where id=rid;
    delete from recipe_ingredients where recipe_id=rid;
    insert into recipe_ingredients (recipe_id,category,name,qty,unit,stage,time_min,ord) values
    (rid,'malt','2-Row',235,null,null,null,0),
    (rid,'malt','Caramunich I',30,null,null,null,1),
    (rid,'malt','White Wheat',20,null,null,null,2),
    (rid,'malt','Carafoam',15,null,null,null,3),
    (rid,'malt','Aromatic',10,null,null,null,4),
    (rid,'malt','Roasted Barley',1,null,null,null,5),
    (rid,'hop','Chinook',5,null,'boil',75,0),
    (rid,'hop','CTZ',20,null,'boil',60,1),
    (rid,'hop','Cascade',8,null,'boil',20,2),
    (rid,'hop','Chinook',10,null,'boil',7.5,3),
    (rid,'hop','Amarillo',12,null,'boil',5,4),
    (rid,'hop','Amarillo',12,null,'whirlpool',15,5),
    (rid,'hop','Chinook',12,null,'whirlpool',15,6),
    (rid,'hop','Centennial',48,null,'dryhop',0,7),
    (rid,'hop','Chinook',48,null,'dryhop',0,8),
    (rid,'yeast','K97',1,null,null,null,0),
    (rid,'adj','Clarity Ferm',125,'ml','fermentation',0,0),
    (rid,'salt','CaSo4',58,null,'mash',null,0),
    (rid,'salt','CaCl2',52,null,'mash',null,1),
    (rid,'salt','Epsom',34,null,'mash',null,2),
    (rid,'salt','Lactic Acid',20,null,'mash',null,3),
    (rid,'salt','CaSo4',54,null,'boil',null,4),
    (rid,'salt','Chalk',50,null,'boil',null,5),
    (rid,'salt','CaCl2',48,null,'boil',null,6),
    (rid,'salt','Epsom',32,null,'boil',null,7);
  end if;

  -- Spruced Up
  select id into rid from recipes where name = 'Spruced Up';
  if rid is not null then
    update recipes set og=null, fg=null, abv=null, mash_temp=152 where id=rid;
    delete from recipe_ingredients where recipe_id=rid;
    insert into recipe_ingredients (recipe_id,category,name,qty,unit,stage,time_min,ord) values
    (rid,'malt','2-Row',110,null,null,null,0),
    (rid,'malt','Pils',110,null,null,null,1),
    (rid,'malt','Caramunich I',25,null,null,null,2),
    (rid,'malt','Carafoam',10,null,null,null,3),
    (rid,'malt','Aromatic',8,null,null,null,4),
    (rid,'hop','CTZ',12,null,'boil',60,0),
    (rid,'hop','Cascade',24,null,'boil',15,1),
    (rid,'hop','Cascade',24,null,'boil',5,2),
    (rid,'hop','Cascade',24,null,'whirlpool',5,3),
    (rid,'hop','Cascade',32,null,'dryhop',0,4),
    (rid,'yeast','K97',1,null,null,null,0),
    (rid,'adj','Clarity Ferm',125,'ml','fermentation',0,0);
  end if;

  -- Stretchy Jörts
  select id into rid from recipes where name = 'Stretchy Jörts';
  if rid is not null then
    update recipes set og=null, fg=null, abv=null, mash_temp=152 where id=rid;
    delete from recipe_ingredients where recipe_id=rid;
    insert into recipe_ingredients (recipe_id,category,name,qty,unit,stage,time_min,ord) values
    (rid,'malt','Pils',165,null,null,null,0),
    (rid,'malt','Vienna',20,null,null,null,1),
    (rid,'malt','Carafoam',5,null,null,null,2),
    (rid,'hop','Saaz',12,null,'boil',60,0),
    (rid,'hop','Saaz',6,null,'boil',5,1),
    (rid,'hop','Saaz',8,null,'whirlpool',20,2),
    (rid,'yeast','K97',1,null,null,null,0),
    (rid,'adj','Clarity Ferm',125,'ml','fermentation',0,0),
    (rid,'salt','Chalk',137,null,'mash',null,0),
    (rid,'salt','Epsom',137,null,'mash',null,1),
    (rid,'salt','CaCl2',34,null,'mash',null,2),
    (rid,'salt','CaSo4',23,null,'mash',null,3),
    (rid,'salt','Lactic Acid',20,null,'mash',null,4),
    (rid,'salt','Chalk',232,null,'boil',null,5),
    (rid,'salt','Epsom',232,null,'boil',null,6),
    (rid,'salt','CaCl2',58,null,'boil',null,7),
    (rid,'salt','CaSo4',39,null,'boil',null,8);
  end if;

  -- Wicked Tickle
  select id into rid from recipes where name = 'Wicked Tickle';
  if rid is not null then
    update recipes set og=null, fg=null, abv=null, mash_temp=152 where id=rid;
    delete from recipe_ingredients where recipe_id=rid;
    insert into recipe_ingredients (recipe_id,category,name,qty,unit,stage,time_min,ord) values
    (rid,'malt','2-Row',110,null,null,null,0),
    (rid,'malt','Maris Otter',110,null,null,null,1),
    (rid,'malt','Caramunich I',55,null,null,null,2),
    (rid,'malt','Black Patent',12,null,null,null,3),
    (rid,'malt','Chocolate',10,null,null,null,4),
    (rid,'malt','Carafoam',8,null,null,null,5),
    (rid,'malt','Roasted Barley',8,null,null,null,6),
    (rid,'hop','CTZ',14,null,'firstwort',90,0),
    (rid,'hop','Willamette',8,null,'boil',15,1),
    (rid,'hop','Willamette',8,null,'boil',5,2),
    (rid,'yeast','S-04',1,null,null,null,0),
    (rid,'adj','Lactose',5,'lbs','boil',5,0),
    (rid,'adj','Whirlfloc',12,'each','boil',15,1),
    (rid,'adj','Ghost Peppers',1,'each','secondary',0,2),
    (rid,'salt','CaCl2',120,null,'mash',null,0),
    (rid,'salt','CaSo4',30,null,'mash',null,1),
    (rid,'salt','Epsom',5,null,'mash',null,2),
    (rid,'salt','CaCl2',100,null,'boil',null,3),
    (rid,'salt','CaSo4',20,null,'boil',null,4),
    (rid,'salt','Epsom',5,null,'boil',null,5);
  end if;

  -- Wit's End
  select id into rid from recipes where name = 'Wit''s End';
  if rid is not null then
    update recipes set og=null, fg=null, abv=null, mash_temp=152 where id=rid;
    delete from recipe_ingredients where recipe_id=rid;
    insert into recipe_ingredients (recipe_id,category,name,qty,unit,stage,time_min,ord) values
    (rid,'malt','Pils',220,null,null,null,0),
    (rid,'malt','White Wheat',55,null,null,null,1),
    (rid,'malt','Flaked Wheat',22,null,null,null,2),
    (rid,'malt','Carafoam',10,null,null,null,3),
    (rid,'hop','Cascade',12,null,'boil',10,0),
    (rid,'hop','Amarillo',16,null,'boil',7.5,1),
    (rid,'hop','Cascade',12,null,'boil',5,2),
    (rid,'hop','Amarillo',12,null,'whirlpool',20,3),
    (rid,'hop','Cascade',12,null,'whirlpool',20,4),
    (rid,'hop','Amarillo',48,null,'dryhop',0,5),
    (rid,'hop','Cascade',48,null,'dryhop',0,6),
    (rid,'hop','CTZ',4,null,'boil',60,7),
    (rid,'yeast','BE-256',1,null,null,null,0),
    (rid,'adj','Coriander',1,'oz','boil',0,0),
    (rid,'adj','Orange Peel',1,'oz','boil',0,1);
  end if;
end $$;
