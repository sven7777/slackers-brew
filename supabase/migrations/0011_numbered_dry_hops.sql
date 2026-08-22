-- Migration 0011: number the dry-hop charges.
--
-- A beer can be dry hopped more than once, and each charge goes in on its own
-- day. The model had a single `dryhop` stage and a single "Dry Hop" schedule
-- action, so there was nothing to join a hop to a date: the Cellar Sheet could
-- only print one date, and printed it against the first hop row alone.
--
-- Stages become dryhop1/dryhop2/dryhop3 and actions "Dry Hop 1/2/3", so the
-- charge number is the join key. Everything that exists today was a single
-- charge, so it all becomes charge 1 — which is also what the app assumes when
-- it meets an unmigrated value, so nothing breaks in the window between this
-- deploying and running.
--
-- Write-once and idempotent: after it runs, the old spellings match nothing.
-- Only `stage` and `action` are touched — no hop, amount, day or ordering
-- changes, so a recipe's contents and its schedule shape are untouched.

-- Hops: the single dry-hop stage becomes charge 1.
update public.recipe_ingredients
   set stage = 'dryhop1'
 where category = 'hop'
   and stage = 'dryhop';

-- Schedule: the single "Dry Hop" action becomes "Dry Hop 1". Case- and
-- space-insensitive because the action column is free text — the picker offers
-- a list, but a brewer can type into it.
update public.recipe_schedule
   set action = 'Dry Hop 1'
 where lower(btrim(action)) = 'dry hop';
