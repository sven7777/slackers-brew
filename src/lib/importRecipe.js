// Pure helpers for the in-app BeerSmith import (see beersmith.js for the parser
// and brew-day-sheets-roadmap PR3). These take a parsed recipe in the app model
// and the user's name mappings, and produce the recipe to commit plus a diff to
// preview. No React, no DOM — unit-tested in importRecipe.test.js.

import { maltNames, hopNames, yeastNames, adjNames, saltNames, adjUnits } from "./defaults";

// recipe field -> [catalog names, mapping category label]
const CATALOG = {
  m: [maltNames, "malt"],
  h: [hopNames, "hop"],
  y: [yeastNames, "yeast"],
  a: [adjNames, "adj"],
  sa: [saltNames, "salt"],
};
const FIELD_BY_CATEGORY = { malt: "m", hop: "h", yeast: "y", adj: "a", salt: "sa" };

// A stable string key for a mapping entry. raw names can't be assumed
// colon-free downstream, so split on the FIRST colon only (see splitKey).
export const mappingKey = (category, raw) => `${category}:${raw}`;
const splitKey = (key) => {
  const i = key.indexOf(":");
  return { category: key.slice(0, i), raw: key.slice(i + 1) };
};

// Ingredient names in a recipe that aren't in the app catalog yet — exactly the
// rows the import UI must ask the user to map. Deduped, in field/appearance order.
export function unmappedInRecipe(recipe) {
  const out = [];
  const seen = new Set();
  for (const [field, [names, category]] of Object.entries(CATALOG)) {
    for (const tuple of recipe[field] ?? []) {
      const raw = tuple[0];
      const key = mappingKey(category, raw);
      if (!names.includes(raw) && !seen.has(key)) {
        seen.add(key);
        out.push({ category, raw });
      }
    }
  }
  return out;
}

// Apply user mappings to a parsed recipe, returning a new recipe. `mappings` is
// { "category:raw": chosenCatalogName }; a falsy value means "keep as-is / add
// as new" and is skipped. Mapping an adjunct also adopts the catalog unit.
export function applyMappings(recipe, mappings) {
  const r = structuredClone(recipe);
  for (const [key, chosen] of Object.entries(mappings || {})) {
    if (!chosen) continue;
    const { category, raw } = splitKey(key);
    const field = FIELD_BY_CATEGORY[category];
    if (!field || !r[field]) continue;
    r[field] = r[field].map((tuple) => {
      if (tuple[0] !== raw) return tuple;
      const t = [...tuple];
      t[0] = chosen;
      if (category === "adj" && adjUnits[chosen]) t[2] = adjUnits[chosen];
      return t;
    });
  }
  return r;
}

// One human-readable line per ingredient in a field, used for preview + diff.
function fieldLines(recipe, field) {
  return (recipe[field] ?? []).map((t) => {
    switch (field) {
      case "m": return `${t[0]} — ${t[1]} lb`;
      case "y": return `${t[0]} — ${t[1]} pk`;
      case "h": return `${t[0]} — ${t[1]} oz · ${t[2]}${t[3] ? ` ${t[3]}m` : ""}`;
      case "a": return `${t[0]} — ${t[1]} ${t[2]} · ${t[3]}${t[4] ? ` ${t[4]}m` : ""}`;
      case "sa": return `${t[0]} — ${t[1]} g · ${t[2]}`;
      default: return `${t[0]} — ${t[1]}`;
    }
  });
}

export const FIELD_LABELS = { m: "Malts", h: "Hops", y: "Yeast", a: "Adjuncts", sa: "Salts" };

// Full preview of a recipe as labeled line lists, e.g. { m: [...], h: [...] }.
export function summarizeRecipe(recipe) {
  return Object.fromEntries(Object.keys(FIELD_LABELS).map((f) => [f, fieldLines(recipe, f)]));
}

// Diff two recipes for the "update existing" preview. Lines carry qty, so a qty
// change shows as a removed + an added line — simple and unambiguous. Header
// changes (style/mash/targets) are listed separately.
export function diffRecipes(oldR, newR) {
  const fields = {};
  for (const f of Object.keys(FIELD_LABELS)) {
    const oldLines = fieldLines(oldR, f);
    const newSet = new Set(fieldLines(newR, f));
    const oldSet = new Set(oldLines);
    fields[f] = {
      added: fieldLines(newR, f).filter((l) => !oldSet.has(l)),
      removed: oldLines.filter((l) => !newSet.has(l)),
    };
  }
  const header = [];
  for (const [k, label] of [["s", "Style"], ["mt", "Mash °F"], ["og", "OG"], ["fg", "FG"], ["abv", "ABV"]]) {
    if ((oldR[k] ?? null) !== (newR[k] ?? null)) header.push({ label, from: oldR[k] ?? null, to: newR[k] ?? null });
  }
  return { fields, header };
}
