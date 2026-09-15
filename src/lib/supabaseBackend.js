// The Supabase implementation of the persistence backend contract (see repo.js).
// load/save are ASYNC here — that's the behavior change usePersistentState
// absorbs with loading/error state.
//
// It translates the app's blob-per-key shapes into the per-row schema
// (supabase/schema.sql) and back:
//   malts/hops/yeast/adj -> inventory rows (one category each)
//   recipes              -> recipes + recipe_ingredients + recipe_schedule rows
//   settings             -> the single settings row (id = 1)
//   everything else (tab/selR/orders) -> delegated to localStorage: it's
//     per-device UI state, not shared brewery data.
//
// On a read error this THROWS rather than returning the fallback. That matters:
// if a failed load quietly returned the default, the hook would then persist
// that default back over real data. Throwing routes it to the hook's error
// state, which suppresses the save.
//
// Every save replaces all the rows behind its key (delete-then-insert), and it
// goes to the database as ONE transaction — the `save_shared` RPC from
// migration 0018, which claims the key's data_versions slot and rewrites its
// rows together or does neither. Before that it was four sequential round trips
// with the table EMPTY between two of them, so an interrupted save could leave
// no catalog at all. There is no longer a middle to be interrupted in.
//
// Two other protections stack on top and are still needed:
//   - Same-client saves are SERIALIZED and DEBOUNCED by usePersistentState. Two
//     in flight at once interleaved their delete/insert phases and doubled the
//     recipes on 2026-07-14; a unique index on recipes.ord now makes that fail
//     loudly instead.
//   - A stale tab is REFUSED by the version claim (migration 0014).
//
// KNOWN LIMITATION: two brewers editing different ingredients in the same
// window can still clobber each other — the loser's whole list wins or loses as
// one. Eliminating that needs per-field writes at the app layer, a later step.
// Rows (not one JSON blob) are the prerequisite for that; this lays the
// groundwork.

import { localStorageBackend } from "./storage";
import { StaleWriteError } from "./staleWrite";

// key -> inventory.category. `adj` rows additionally carry a unit.
const CATEGORY = { malts: "malt", hops: "hop", yeast: "yeast", adj: "adj" };
// recipe_ingredients.category -> the recipe object's array field.
const RECIPE_FIELDS = [["m", "malt"], ["h", "hop"], ["y", "yeast"], ["a", "adj"], ["sa", "salt"]];
const FIELD_BY_CATEGORY = { malt: "m", hop: "h", yeast: "y", adj: "a", salt: "sa" };

const SHARED_KEYS = new Set([...Object.keys(CATEGORY), "recipes", "settings", "catalog"]);

// Settings fields that live in the `prefs` JSONB column rather than one of
// their own. Brewery identity earned columns; these are small brewery
// preferences that keep arriving one at a time, so they take the same shape
// `recipes.process` took, for the same reason — a new one costs no migration.
//
// They had NO home here before: the batch-volume fields shipped with the COGS
// work but were never added to the select or the upsert, so on the Supabase
// backend every one of them was dropped on save and re-read as the built-in
// default. Costing quietly ran against 150 gal / 33% no matter what Settings
// showed. Anything added to the settings object from here on belongs in this
// list or in a column.
//
// `costs` is deliberately ONE nested object rather than a field per input: the
// overhead/pricing model adds ~20 of them and will add more, and every one
// added here individually is another chance to repeat exactly the failure
// described above. One entry covers all of them, now and later — see
// lib/overhead.js.
const SETTINGS_PREFS = ["postBoilYield", "lossPct", "avgKegs", "costs"];

export function createSupabaseBackend(client, localBackend = localStorageBackend) {
  // The version each key was at when THIS tab last read or wrote it. Everything
  // about staleness is a comparison against these numbers — see
  // supabase/migrations/0014_data_versions.sql for why they exist.
  const seen = new Map();
  let inFlight = null;

  // All versions in one query, and concurrent callers share it: the app mounts
  // six keys at once, and six identical round trips to a six-row table would be
  // silly. Read BEFORE the data it describes, never after — recording a version
  // newer than the rows we then read would make a stale tab look current, which
  // is the one direction this must never be wrong in.
  async function readVersions() {
    if (inFlight) return inFlight;
    inFlight = (async () => {
      const { data, error } = await client.from("data_versions").select("key,version");
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((r) => [r.key, Number(r.version)]));
    })().finally(() => { inFlight = null; });
    return inFlight;
  }

  async function load(key, fallback) {
    if (!SHARED_KEYS.has(key)) return localBackend.load(key, fallback);
    const versions = await readVersions();
    seen.set(key, versions[key] ?? 0);
    if (key === "recipes") return loadRecipes(client, fallback);
    if (key === "settings") return loadSettings(client, fallback);
    if (key === "catalog") return loadCatalog(client, fallback);
    return loadInventory(client, CATEGORY[key], key === "adj", fallback);
  }

  // One save, one transaction, one round trip.
  //
  // The version claim and the rows it authorises go to the database together
  // (migration 0018): every shared key is written as delete-then-insert, and a
  // save that could be interrupted between those two halves is a save that can
  // empty a table and leave it that way. The client's job is now only to say
  // WHICH rows — `buildOps` — and the database's is to make them all land or
  // none of them.
  //
  // `seen` still advances on success, because the version this write produced
  // is the one this tab is now current against; a refusal leaves it alone so a
  // reload is the only way forward, which is what StaleWriteError tells the
  // banner to offer.
  async function save(key, value) {
    if (!SHARED_KEYS.has(key)) return localBackend.save(key, value);
    const expected = seen.has(key) ? seen.get(key) : (await readVersions())[key] ?? 0;
    const { data, error } = await client.rpc("save_shared", {
      p_key: key,
      p_expected: expected,
      p_ops: buildOps(key, value),
    });
    if (error) {
      if (isStaleRefusal(error)) throw new StaleWriteError(key);
      throw error;
    }
    seen.set(key, Number(data));
  }

  // Which of the keys this tab is showing have moved on the server since it
  // read them. Only keys actually loaded here are reported — a key this tab
  // never read can't be displaying anything out of date.
  async function staleKeys() {
    if (seen.size === 0) return [];
    const versions = await readVersions();
    return [...seen.entries()]
      .filter(([key, v]) => (versions[key] ?? 0) > v)
      .map(([key]) => key);
  }

  return { load, save, staleKeys };
}

// --- the write plan --------------------------------------------------------
//
// A key's value becomes a list of ops, each "empty this table (or this slice of
// it) and put these rows in it", applied in order inside one transaction by
// save_shared. Ordering is load-bearing for recipes: the parent table is
// refilled before the children that reference it.
//
// These builders are pure, which is the point of the split — the row shapes
// change every few weeks and are the thing worth testing, while the transaction
// is fixed and lives in SQL.
export function buildOps(key, value) {
  if (key === "recipes") return recipeOps(value);
  if (key === "settings") return [{ table: "settings", rows: [settingsRow(value)] }];
  if (key === "catalog") return [{ table: "products", rows: catalogRows(value) }];
  return [{
    table: "inventory",
    whereCol: "category",
    whereVal: CATEGORY[key],
    rows: inventoryRows(CATEGORY[key], value),
  }];
}

// `raise exception 'stale_write'` from save_shared. PostgREST hands plpgsql's
// RAISE back as P0001 with the message intact; match the message rather than
// the code, since every other guard in the function raises P0001 too.
function isStaleRefusal(error) {
  return typeof error?.message === "string" && error.message.includes("stale_write");
}

// Recipe ids are generated HERE so recipe_ingredients and recipe_schedule rows
// can name their parent without a round trip back for the inserted ids — which
// is what would put a gap in the middle of the transaction again. A recipe's id
// has never been stable across saves anyway (the unique key is `ord`).
const newId = () =>
  globalThis.crypto?.randomUUID?.() ??
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });

// --- inventory (malts/hops/yeast/adj) -------------------------------------

async function loadInventory(client, category, withUnit, fallback) {
  const { data, error } = await client
    .from("inventory")
    .select("name,qty,unit,ord,cost_per_unit,product_sku,vendor,price_effective,archived")
    .eq("category", category)
    .order("ord");
  if (error) throw error;
  if (!data || data.length === 0) return fallback;
  // Pricing fields must round-trip: save() replaces every row for the category,
  // so anything not loaded here would be wiped by the next inventory edit. They
  // are attached only when the row actually carries a price, keeping an
  // unpriced row the plain {n, q} the rest of the app has always seen.
  return data.map((r) => ({
    n: r.name,
    q: r.qty,
    ...(withUnit ? { u: r.unit } : null),
    // Attached only when true, so a stocked row stays the plain {n, q} shape
    // the rest of the app has always seen.
    ...(r.archived ? { archived: true } : null),
    ...(r.cost_per_unit == null && r.product_sku == null ? null : {
      cpu: r.cost_per_unit,
      sku: r.product_sku,
      vendor: r.vendor,
      pricedAt: r.price_effective,
    }),
  }));
}

function inventoryRows(category, items) {
  return (items ?? []).map((it, i) => ({
    category,
    name: it.n,
    qty: it.q,
    unit: it.u ?? null,
    ord: i,
    cost_per_unit: it.cpu ?? null,
    product_sku: it.sku ?? null,
    vendor: it.vendor ?? null,
    price_effective: it.pricedAt ?? null,
    archived: it.archived === true,
  }));
}

// --- catalog (the whole vendor range, in `products`) -----------------------
//
// The `products` table has existed since migration 0008 but was never written
// to: prices lived entirely on `inventory.cost_per_unit`, and the ~30 products
// Slackers buys were described in code by products.js. This is the first writer.
//
// Deliberately NOT wired into App.jsx state. Every other shared key is a
// usePersistentState hook loaded at mount, but the catalog is hundreds of rows
// that only the price import and the ingredient picker ever need, and paying
// for it on every page load would be a real cost for a list that changes about
// once a month. It still routes through repo.load/save, so it keeps the CAS
// staleness guard and the save chain that come with a shared key.

async function loadCatalog(client, fallback) {
  const { data, error } = await client
    .from("products")
    .select("sku,vendor,name,price,pack_qty,pack_unit,order_pack,category,source,effective")
    .order("sku");
  if (error) throw error;
  if (!data || data.length === 0) return fallback;
  return data.map((r) => ({
    sku: r.sku,
    name: r.name,
    vendor: r.vendor,
    category: r.category,
    price: r.price,
    packQty: r.pack_qty,
    packUnit: r.pack_unit,
    orderPack: r.order_pack,
    source: r.source,
    effective: r.effective,
  }));
}

function catalogRows(entries) {
  return (entries ?? []).map((e) => ({
    sku: e.sku,
    name: e.name,
    vendor: e.vendor ?? null,
    category: e.category ?? null,
    price: e.price ?? null,
    // Null, not 1, when the list gave no pack size: migration 0016 drops the
    // NOT NULL for exactly this. A made-up denominator under a real price is
    // the confidently-wrong number costPerUnit() returns null to avoid.
    pack_qty: e.packQty ?? null,
    pack_unit: e.packUnit ?? null,
    order_pack: e.orderPack ?? null,
    source: e.source ?? null,
    effective: e.effective ?? null,
  }));
}

// --- settings (single row) -------------------------------------------------

async function loadSettings(client, fallback) {
  const { data, error } = await client
    .from("settings")
    .select("name,tagline,emoji,logo,prefs")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return fallback;
  const out = { name: data.name, tagline: data.tagline, emoji: data.emoji, logo: data.logo };
  // Only keys actually stored come back, so a settings row written before a
  // pref existed stays absent rather than arriving as null — the difference
  // between "unset, use the default" and "explicitly nothing".
  for (const k of SETTINGS_PREFS) {
    if (data.prefs && k in data.prefs) out[k] = data.prefs[k];
  }
  return out;
}

function settingsRow(s) {
  const prefs = {};
  for (const k of SETTINGS_PREFS) {
    if (s?.[k] != null && s[k] !== "") prefs[k] = s[k];
  }
  return {
    id: 1,
    name: s?.name ?? null,
    tagline: s?.tagline ?? null,
    emoji: s?.emoji ?? null,
    logo: s?.logo ?? null,
    prefs,
  };
}

// --- recipes (header + ingredient rows) ------------------------------------

async function loadRecipes(client, fallback) {
  const { data: recs, error: e1 } = await client
    .from("recipes")
    .select("id,name,style,og,fg,abv,mash_temp,ferm_temp,process,ord")
    .order("ord");
  if (e1) throw e1;
  if (!recs || recs.length === 0) return fallback;

  const { data: ings, error: e2 } = await client
    .from("recipe_ingredients")
    .select("recipe_id,category,name,qty,unit,stage,time_min,ord")
    .order("ord");
  if (e2) throw e2;

  const { data: sched, error: e3 } = await client
    .from("recipe_schedule")
    .select("recipe_id,day,action,ord")
    .order("ord");
  if (e3) throw e3;

  const byId = new Map(
    recs.map((r) => [r.id, {
      n: r.name, s: r.style,
      og: r.og, fg: r.fg, abv: r.abv, mt: r.mash_temp, ft: r.ferm_temp, process: r.process ?? null,
      m: [], h: [], y: [], a: [], sa: [], sc: [],
    }])
  );
  for (const ing of ings ?? []) {
    const rec = byId.get(ing.recipe_id);
    if (!rec) continue;
    rec[FIELD_BY_CATEGORY[ing.category]].push(ingredientToTuple(ing));
  }
  for (const row of sched ?? []) {
    const rec = byId.get(row.recipe_id);
    if (!rec) continue;
    rec.sc.push([row.day, row.action]);
  }
  return recs.map((r) => byId.get(r.id));
}

// recipe_ingredients row -> the recipe object's tuple shape for its category.
function ingredientToTuple(ing) {
  switch (ing.category) {
    case "hop": return [ing.name, ing.qty, ing.stage, ing.time_min];
    case "adj": return [ing.name, ing.qty, ing.unit, ing.stage, ing.time_min];
    case "salt": return [ing.name, ing.qty, ing.stage];
    default: return [ing.name, ing.qty]; // malt, yeast
  }
}

// A recipe tuple -> the columns of a recipe_ingredients row (inverse of above).
function tupleToColumns(category, tuple) {
  switch (category) {
    case "hop": return { unit: null, stage: tuple[2] ?? null, time_min: tuple[3] ?? null };
    case "adj": return { unit: tuple[2] ?? null, stage: tuple[3] ?? null, time_min: tuple[4] ?? null };
    case "salt": return { unit: null, stage: tuple[2] ?? null, time_min: null };
    default: return { unit: null, stage: null, time_min: null }; // malt, yeast
  }
}

function recipeOps(recipes) {
  const ids = (recipes ?? []).map(() => newId());

  const recRows = (recipes ?? []).map((r, i) => ({
    id: ids[i],
    name: r.n, style: r.s ?? null,
    og: r.og ?? null, fg: r.fg ?? null, abv: r.abv ?? null,
    mash_temp: r.mt ?? null, ferm_temp: r.ft ?? null, process: r.process ?? null,
    ord: i,
  }));

  const ingRows = [];
  const schedRows = [];
  (recipes ?? []).forEach((r, i) => {
    for (const [field, category] of RECIPE_FIELDS) {
      (r[field] ?? []).forEach((tuple, j) => {
        ingRows.push({
          recipe_id: ids[i], category, name: tuple[0], qty: tuple[1],
          ...tupleToColumns(category, tuple), ord: j,
        });
      });
    }
    (r.sc ?? []).forEach(([day, action], j) => {
      schedRows.push({ recipe_id: ids[i], day, action, ord: j });
    });
  });

  // Recipes first: the children reference them, and emptying `recipes` cascades
  // both child tables away before their own op refills them.
  return [
    { table: "recipes", rows: recRows },
    { table: "recipe_ingredients", rows: ingRows },
    { table: "recipe_schedule", rows: schedRows },
  ];
}
