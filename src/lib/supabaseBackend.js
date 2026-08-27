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
// KNOWN LIMITATION: the app saves a whole array per change, so save() replaces
// every row for that key (delete-then-insert). Same-client saves are
// serialized by usePersistentState (two in flight at once interleaved their
// delete/insert phases and doubled the recipes on 2026-07-14; a unique index
// on recipes.ord now makes that fail loudly instead). Two brewers editing
// different ingredients in the same window can still clobber each other —
// eliminating that needs per-field writes at the app layer, a later step.
// Rows (not one JSON blob) are the prerequisite for that; this lays the
// groundwork.

import { localStorageBackend } from "./storage";
import { StaleWriteError } from "./staleWrite";

// supabase-js refuses an unfiltered delete; this matches every real (uuid) row.
const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

// key -> inventory.category. `adj` rows additionally carry a unit.
const CATEGORY = { malts: "malt", hops: "hop", yeast: "yeast", adj: "adj" };
// recipe_ingredients.category -> the recipe object's array field.
const RECIPE_FIELDS = [["m", "malt"], ["h", "hop"], ["y", "yeast"], ["a", "adj"], ["sa", "salt"]];
const FIELD_BY_CATEGORY = { malt: "m", hop: "h", yeast: "y", adj: "a", salt: "sa" };

const SHARED_KEYS = new Set([...Object.keys(CATEGORY), "recipes", "settings"]);

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
const SETTINGS_PREFS = ["postBoilYield", "lossPct", "avgKegs"];

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
    return loadInventory(client, CATEGORY[key], key === "adj", fallback);
  }

  // Claim the right to rewrite this key: bump the version only if it still
  // holds the value this tab last saw. No match means somebody else wrote in
  // the meantime, and the caller must not touch a single data row.
  async function claim(key) {
    const expected = seen.has(key) ? seen.get(key) : (await readVersions())[key] ?? 0;
    const { data, error } = await client
      .from("data_versions")
      .update({ version: expected + 1, updated_at: new Date().toISOString() })
      .eq("key", key)
      .eq("version", expected)
      .select("version");
    if (error) throw error;
    if (data?.length) {
      seen.set(key, expected + 1);
      return;
    }
    // No row matched. Either the key has no version row at all (a database that
    // predates migration 0014, or a key added since) — in which case create it
    // and carry on, since there is no history to be stale against — or the
    // version moved, which is the refusal this whole mechanism exists for.
    const { data: existing, error: readErr } = await client
      .from("data_versions").select("version").eq("key", key).maybeSingle();
    if (readErr) throw readErr;
    if (existing) throw new StaleWriteError(key);
    const { error: insErr } = await client
      .from("data_versions").insert({ key, version: 1 });
    if (insErr) throw insErr;
    seen.set(key, 1);
  }

  async function save(key, value) {
    if (!SHARED_KEYS.has(key)) return localBackend.save(key, value);
    await claim(key);
    if (key === "recipes") return saveRecipes(client, value);
    if (key === "settings") return saveSettings(client, value);
    return saveInventory(client, CATEGORY[key], value);
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

// --- inventory (malts/hops/yeast/adj) -------------------------------------

async function loadInventory(client, category, withUnit, fallback) {
  const { data, error } = await client
    .from("inventory")
    .select("name,qty,unit,ord,cost_per_unit,product_sku,vendor,price_effective")
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
    ...(r.cost_per_unit == null && r.product_sku == null ? null : {
      cpu: r.cost_per_unit,
      sku: r.product_sku,
      vendor: r.vendor,
      pricedAt: r.price_effective,
    }),
  }));
}

async function saveInventory(client, category, items) {
  const del = await client.from("inventory").delete().eq("category", category);
  if (del.error) throw del.error;
  if (!items || items.length === 0) return;
  const rows = items.map((it, i) => ({
    category,
    name: it.n,
    qty: it.q,
    unit: it.u ?? null,
    ord: i,
    cost_per_unit: it.cpu ?? null,
    product_sku: it.sku ?? null,
    vendor: it.vendor ?? null,
    price_effective: it.pricedAt ?? null,
  }));
  const { error } = await client.from("inventory").insert(rows);
  if (error) throw error;
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

async function saveSettings(client, s) {
  const prefs = {};
  for (const k of SETTINGS_PREFS) {
    if (s?.[k] != null && s[k] !== "") prefs[k] = s[k];
  }
  const { error } = await client.from("settings").upsert({
    id: 1,
    name: s.name ?? null,
    tagline: s.tagline ?? null,
    emoji: s.emoji ?? null,
    logo: s.logo ?? null,
    prefs,
  });
  if (error) throw error;
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

async function saveRecipes(client, recipes) {
  // Delete every recipe; recipe_ingredients cascade away with their parent.
  const del = await client.from("recipes").delete().neq("id", ZERO_UUID);
  if (del.error) throw del.error;
  if (!recipes || recipes.length === 0) return;

  const recRows = recipes.map((r, i) => ({
    name: r.n, style: r.s ?? null,
    og: r.og ?? null, fg: r.fg ?? null, abv: r.abv ?? null,
    mash_temp: r.mt ?? null, ferm_temp: r.ft ?? null, process: r.process ?? null,
    ord: i,
  }));
  const { data: inserted, error: e1 } = await client
    .from("recipes")
    .insert(recRows)
    .select("id,ord");
  if (e1) throw e1;

  // Map back by ord (not array position) so reordered insert results still link.
  const idByOrd = new Map(inserted.map((r) => [r.ord, r.id]));
  const ingRows = [];
  recipes.forEach((r, i) => {
    const recipeId = idByOrd.get(i);
    for (const [field, category] of RECIPE_FIELDS) {
      (r[field] ?? []).forEach((tuple, j) => {
        ingRows.push({
          recipe_id: recipeId, category, name: tuple[0], qty: tuple[1],
          ...tupleToColumns(category, tuple), ord: j,
        });
      });
    }
  });
  if (ingRows.length) {
    const { error: e2 } = await client.from("recipe_ingredients").insert(ingRows);
    if (e2) throw e2;
  }

  // Cellar schedule rows (recipe_schedule cascaded away with their parent above).
  const schedRows = [];
  recipes.forEach((r, i) => {
    const recipeId = idByOrd.get(i);
    (r.sc ?? []).forEach(([day, action], j) => {
      schedRows.push({ recipe_id: recipeId, day, action, ord: j });
    });
  });
  if (schedRows.length) {
    const { error: e3 } = await client.from("recipe_schedule").insert(schedRows);
    if (e3) throw e3;
  }
}
