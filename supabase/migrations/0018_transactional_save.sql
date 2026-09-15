-- Migration 0018: make a whole-list save ONE transaction.
--
-- Every shared key is written as delete-then-insert (see supabaseBackend.js),
-- and until now that was four sequential round trips from the browser with the
-- version compare-and-swap as a fifth. Between the DELETE and the INSERT the
-- table is EMPTY: a dropped connection, a closed laptop or a 502 right there
-- loses the catalog outright, and the only net is the nightly dump. 0014 said
-- this out loud ("a crash between the CAS and the insert leaves the version
-- bumped with the data half-written") and left it standing, because closing the
-- stale-overwrite window was the urgent half. This closes the other half.
--
-- A plpgsql function called over RPC runs inside a single transaction, so the
-- claim, the deletes and the inserts either all happen or none of them do. The
-- browser can no longer be interrupted mid-write, because from its side there
-- is no longer a middle.
--
-- ⚠️ The CAS claim MUST stay in here with the writes it authorises. Splitting
-- them back apart is what 0014 built and what this migration is finishing: a
-- claim that commits while its writes roll back leaves every other tab stale
-- against a version that never wrote anything.
--
-- WHY IT IS GENERIC. The function takes a list of {table, delete-filter, rows}
-- ops and knows nothing about recipes, inventory or prices. The row shapes stay
-- in JavaScript, where they already are, are already tested, and change every
-- few weeks — a second copy of them in SQL is exactly the trap
-- SETTINGS_PREFS documents (a field added on one side and forgotten on the
-- other writes a silent null). The caller generates the `recipes.id` uuids
-- itself, so children can reference their parent without a round trip back to
-- the client for the inserted ids.
--
-- It grants no authority a member does not already have: every table here is
-- readable and writable through PostgREST by any member, under the same
-- policies, and the function is SECURITY INVOKER so RLS still applies to every
-- statement it runs.
--
-- Idempotent: create or replace.

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
    insert into data_versions (key, version) values (p_key, 1)
    returning version into claimed;
  end if;

  -- 2. Apply each op in order. Ops are ordered by the caller, which is how a
  --    parent table is refilled before the children that reference it.
  for op in select * from jsonb_array_elements(coalesce(p_ops, '[]'::jsonb))
  loop
    tbl := op ->> 'table';
    if tbl is null or not (tbl = any(allowed)) then
      raise exception 'save_shared: table % is not writable here', coalesce(tbl, '(null)');
    end if;

    -- Delete: the whole table, or one text column equal to one value (today
    -- only inventory.category, which is how one shelf is replaced without
    -- touching the other three).
    if op ? 'whereCol' then
      execute format('delete from public.%I where %I = $1', tbl, op ->> 'whereCol')
        using op ->> 'whereVal';
    else
      execute format('delete from public.%I', tbl);
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
  'Replace the rows behind one shared key in a single transaction, claiming its data_versions slot first. See supabase/migrations/0018_transactional_save.sql.';
