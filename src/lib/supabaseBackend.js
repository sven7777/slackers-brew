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
// every row for that key (delete-then-insert). Two brewers editing different
// ingredients in the same window can still clobber each other — eliminating
// that needs per-field writes at the app layer, a later step. Rows (not one
// JSON blob) are the prerequisite for that; this lays the groundwork.

import { localStorageBackend } from "./storage";

// supabase-js refuses an unfiltered delete; this matches every real (uuid) row.
const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

// key -> inventory.category. `adj` rows additionally carry a unit.
const CATEGORY = { malts: "malt", hops: "hop", yeast: "yeast", adj: "adj" };
// recipe_ingredients.category -> the recipe object's array field.
const RECIPE_FIELDS = [["m", "malt"], ["h", "hop"], ["y", "yeast"], ["a", "adj"], ["sa", "salt"]];
const FIELD_BY_CATEGORY = { malt: "m", hop: "h", yeast: "y", adj: "a", salt: "sa" };

const SHARED_KEYS = new Set([...Object.keys(CATEGORY), "recipes", "settings"]);

export function createSupabaseBackend(client, localBackend = localStorageBackend) {
  async function load(key, fallback) {
    if (!SHARED_KEYS.has(key)) return localBackend.load(key, fallback);
    if (key === "recipes") return loadRecipes(client, fallback);
    if (key === "settings") return loadSettings(client, fallback);
    return loadInventory(client, CATEGORY[key], key === "adj", fallback);
  }

  async function save(key, value) {
    if (!SHARED_KEYS.has(key)) return localBackend.save(key, value);
    if (key === "recipes") return saveRecipes(client, value);
    if (key === "settings") return saveSettings(client, value);
    return saveInventory(client, CATEGORY[key], value);
  }

  return { load, save };
}

// --- inventory (malts/hops/yeast/adj) -------------------------------------

async function loadInventory(client, category, withUnit, fallback) {
  const { data, error } = await client
    .from("inventory")
    .select("name,qty,unit,ord")
    .eq("category", category)
    .order("ord");
  if (error) throw error;
  if (!data || data.length === 0) return fallback;
  return data.map((r) =>
    withUnit ? { n: r.name, q: r.qty, u: r.unit } : { n: r.name, q: r.qty }
  );
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
  }));
  const { error } = await client.from("inventory").insert(rows);
  if (error) throw error;
}

// --- settings (single row) -------------------------------------------------

async function loadSettings(client, fallback) {
  const { data, error } = await client
    .from("settings")
    .select("name,tagline,emoji,logo")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return fallback;
  return { name: data.name, tagline: data.tagline, emoji: data.emoji, logo: data.logo };
}

async function saveSettings(client, s) {
  const { error } = await client.from("settings").upsert({
    id: 1,
    name: s.name ?? null,
    tagline: s.tagline ?? null,
    emoji: s.emoji ?? null,
    logo: s.logo ?? null,
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
