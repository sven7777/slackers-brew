-- Migration 0019: give save_shared's whole-table DELETE a WHERE clause that
-- survives the planner.
--
-- 0018 shipped `delete from public.%I` with no WHERE for the ops that replace a
-- whole table (recipes, recipe_ingredients, recipe_schedule, settings,
-- products). On Supabase that fails at runtime:
--
--     DELETE requires a WHERE clause
--
-- which is the `safeupdate` extension, preloaded for the authenticated role. It
-- checks in the executor whether the DELETE's scan carries a qual, and refuses
-- when it does not. Stock Postgres has no such rule, so a local cluster runs
-- 0018 perfectly — which is exactly how this got through a migration that WAS
-- tested against a real database. The inventory ops were unaffected because
-- they already filter on `category`, so only recipes, settings and the catalog
-- broke, and they broke SAFELY: the transaction rolls back and SaveErrorBanner
-- says so. Nothing was lost, nothing was half-written. That part worked.
--
-- ⚠️ The fix is not "add WHERE true". The planner CONSTANT-FOLDS a provably
-- true qual and the scan ends up with none, which is the state safeupdate
-- rejects. Measured on PostgreSQL 17 — `explain (costs off) delete from
-- products ...`:
--
--     where true                  -> no Filter   (folded)
--     where id is not null        -> no Filter   (folded: id is NOT NULL)
--     where ctid is not null      -> no Filter   (folded: ctid is never null)
--     where id is not null
--        or id is null            -> no Filter   (folded)
--     where ctid <> '(0,0)'::tid  -> Filter: (ctid <> '(0,0)'::tid)   ✅
--
-- So: `ctid <> '(0,0)'`. It is generic (ctid is a system column on every table,
-- so this needs no per-table knowledge of a primary key's name or type), it is
-- always true of a real row (item pointers are 1-based, so (0,0) is never a
-- live tuple), and the planner cannot prove that, which is the whole point.
--
-- This is the same wall 0018 walked into from the other side: the code it
-- replaced wrote `.neq("id", ZERO_UUID)` with the comment "supabase-js refuses
-- an unfiltered delete". The refusal is the database's, not the client's, and
-- dropping that filter dropped the workaround with it.
--
-- Idempotent: create or replace. Only the DELETE line changes from 0018.

create or replace function public.save_shared(
  p_key      text,
  p_expected bigint,
  p_ops      jsonb
) returns bigint
  language plpgsql
  security invoker
  set search_path = public
as $$
declare
  -- Whitelist. A table name arriving from the client is quoted by %I, so it
  -- cannot inject; this is here so a typo fails loudly instead of silently
  -- matching nothing, and so the blast radius of this function is readable.
  allowed constant text[] := array[
    'inventory', 'recipes', 'recipe_ingredients', 'recipe_schedule',
    'settings', 'products'
  ];
  op      jsonb;
  tbl     text;
  rows    jsonb;
  cols    text;
  claimed bigint;
begin
  if not is_member() then
    raise exception 'save_shared: not a member';
  end if;

  -- 1. Claim the key: bump the version only if it still holds what this tab
  --    last saw. Everything below happens in the same transaction, so a
  --    refusal here means not one data row is touched.
  update data_versions
     set version = p_expected + 1, updated_at = now()
   where key = p_key and version = p_expected
  returning version into claimed;

  if claimed is null then
    -- Either the key has no version row at all (a database predating 0014, or
    -- a key added since) — nothing to be stale against, so create it and carry
    -- on — or the version moved under us, which is the refusal this exists for.
    if exists (select 1 from data_versions where key = p_key) then
      raise exception 'stale_write' using detail = p_key;
    end if;
    -- ON CONFLICT rather than a bare insert: two tabs saving a brand-new key
    -- can both pass the EXISTS above, and the loser would then fail on the
    -- primary key — an error the client does not recognise as staleness, so
    -- SaveErrorBanner would offer Retry where it must offer Reload. Losing the
    -- race IS being stale, so say so. (A concurrent uncommitted insert blocks
    -- here until it commits, and then returns no row, which is the same path.)
    insert into data_versions (key, version) values (p_key, 1)
    on conflict (key) do nothing
    returning version into claimed;
    if claimed is null then
      raise exception 'stale_write' using detail = p_key;
    end if;
  end if;

  -- 2. Apply each op in order. Ops are ordered by the caller, which is how a
  --    parent table is refilled before the children that reference it.
  for op in select * from jsonb_array_elements(coalesce(p_ops, '[]'::jsonb))
  loop
    tbl := op ->> 'table';
    if tbl is null or not (tbl = any(allowed)) then
      raise exception 'save_shared: table % is not writable here', coalesce(tbl, '(null)');
    end if;

    -- Delete: one text column equal to one value (today only
    -- inventory.category, which is how one shelf is replaced without touching
    -- the other three), or the whole table.
    --
    -- ⚠️ The whole-table form carries `ctid <> '(0,0)'` and MUST keep a qual
    -- the planner cannot fold away — see the header. An unfiltered DELETE is
    -- rejected outright by Supabase's safeupdate.
    if op ? 'whereCol' then
      execute format('delete from public.%I where %I = $1', tbl, op ->> 'whereCol')
        using op ->> 'whereVal';
    else
      execute format($q$delete from public.%I where ctid <> '(0,0)'::tid$q$, tbl);
    end if;

    rows := coalesce(op -> 'rows', '[]'::jsonb);
    if jsonb_array_length(rows) > 0 then
      -- Insert only the columns the caller actually sent, so every column it
      -- leaves out keeps its DEFAULT. `insert ... select *` would instead write
      -- an explicit NULL into each one and break the next NOT NULL DEFAULT
      -- column anybody adds (`products.id`, `inventory.updated_at`).
      --
      -- ⚠️ The column list is the UNION over every row, not the keys of the
      -- first one. Reading it off row 0 was tried and is quietly wrong: a batch
      -- whose second row carries a price the first one lacks inserts that row
      -- with the price DROPPED, no error, no row count to notice it by. The
      -- builders in supabaseBackend.js emit uniform keys precisely so this
      -- never arises, but "the writer promised" is not a reason for the one
      -- shared write path to lose a field silently.
      select string_agg(k, ', ') into cols from (
        select distinct quote_ident(jsonb_object_keys(e)) as k
          from jsonb_array_elements(rows) as e
      ) as keys;
      execute format(
        'insert into public.%I (%s) select %s from jsonb_populate_recordset(null::public.%I, $1)',
        tbl, cols, cols, tbl
      ) using rows;
    end if;
  end loop;

  return claimed;
end;
$$;

comment on function public.save_shared(text, bigint, jsonb) is
  'Replace the rows behind one shared key in a single transaction, claiming its data_versions slot first. See supabase/migrations/0018_transactional_save.sql and 0019_save_shared_where_clause.sql.';
