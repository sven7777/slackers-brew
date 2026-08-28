// Cross-recipe cost analytics: what every beer in the book costs, side by side.
//
// Pure, like cogs.js and orderCalc.js. It adds no arithmetic of its own — every
// figure comes from `computeRecipeCost()`, so a number here and the same number
// on that recipe's Cost panel are the same calculation, not two that agree by
// accident.
//
// Three things shape it:
//
//   1. Each recipe is costed against ITS OWN volume. `batchVolume()` reads the
//      recipe's post-boil yield and average keg yield before falling back to the
//      brewery defaults, so a beer that packages 6 kegs and one that packages 7
//      are not silently compared on the same denominator.
//
//   2. Every recipe is costed as a SINGLE batch. Cost per bbl/keg/pint don't
//      move when a batch is doubled (ingredients and volume double together),
//      so a double-batch toggle here would change only the batch totals and
//      nothing about how the beers rank. One basis, stated on screen.
//
//   3. cogs.js's honesty rule carries over, one level up. A recipe with an
//      unpriced ingredient has a total that is a FLOOR, not a cost, so it is
//      marked as such and left out of the brewery-wide averages — with the
//      count of what was left out reported, since an average over half the book
//      that reads as an average over all of it is the failure being avoided.

import { batchVolume, ceilCents, computeRecipeCost, priceMapFrom } from "./cogs";
import { compareNames } from "./sortNames";

// A recipe mid-edit may have no name; the picker already shows it this way, so
// the analytics list calls it the same thing rather than printing a blank row.
export const UNTITLED = "(untitled)";
export const recipeName = (r) => r?.n?.trim() || UNTITLED;

// Cost every recipe in the book.
//
//   recs     — the recipe list, as stored (each row carries its stored `index`,
//              so a caller can jump to that recipe's own Cost panel)
//   malts/hops/yeast/adj — inventory, which is where prices live
//   settings — brewery defaults for volume and yield
//
// Archived inventory rows are deliberately included in the price map: archiving
// says "we stopped buying it", not "it was free", and a recipe still calling for
// it still costs what it costs. That matches computeOrder(), which ignores the
// flag for the same reason.
export function costAllRecipes({ recs = [], malts = [], hops = [], yeast = [], adj = [], settings } = {}) {
  const priceMap = priceMapFrom({ malts, hops, yeast, adj });

  const rows = recs.map((recipe, index) => {
    const { kettleGal, lossPct } = batchVolume({ recipe, settings });
    const r = computeRecipeCost({ recipe, priceMap, postBoilGal: kettleGal, lossPct });

    // A recipe with no ingredients at all totals $0 and reports nothing
    // missing, which would read as a beer that costs nothing to brew. It is an
    // empty shell, so it is flagged and kept out of every statistic below.
    const empty = r.lines.length === 0;

    return {
      index,
      name: recipeName(recipe),
      style: recipe?.s || "",
      empty,
      // The total is complete only when every line priced. Otherwise it is a
      // floor, and the UI has to say so.
      complete: !empty && r.missing.length === 0,
      missing: r.missing,
      missingCount: r.missing.length,
      ingredientCount: r.lines.length,
      total: r.total,
      byCategory: r.byCategory,
      costPerBbl: r.costPerBbl,
      costPerKeg: r.costPerKeg,
      costPerPint: r.costPerPint,
      packagedBbl: r.packagedBbl,
      kegs: r.kegs,
      kettleGal,
      lossPct,
    };
  });

  // Default order is alphabetical, like every other list a brewer scans for a
  // name. The table's own column sorts are layered on top of this.
  rows.sort((a, b) => compareNames(a.name, b.name));

  return { rows, summary: summarize(rows), blockers: blockers(rows) };
}

// Brewery-wide figures, computed over the recipes that actually have a complete
// cost. `counted` against `recipes` is the honest part — it is what stops an
// average over four priced beers reading as the average of eighteen.
export function summarize(rows = []) {
  const counted = rows.filter((r) => r.complete && r.costPerBbl != null);
  const avg = (pick) => {
    if (!counted.length) return null;
    const sum = counted.reduce((s, r) => s + pick(r), 0);
    return ceilCents(sum / counted.length);
  };
  const extreme = (better) =>
    counted.length
      ? counted.reduce((best, r) => (better(r.costPerBbl, best.costPerBbl) ? r : best))
      : null;

  return {
    recipes: rows.length,
    counted: counted.length,
    // Split so the UI can say WHY a recipe is not in the average — an empty
    // shell and an unpriced ingredient are different problems with different
    // fixes.
    incomplete: rows.filter((r) => !r.complete && !r.empty).length,
    empty: rows.filter((r) => r.empty).length,
    avgBatch: avg((r) => r.total),
    avgCostPerBbl: avg((r) => r.costPerBbl),
    avgCostPerKeg: avg((r) => r.costPerKeg),
    avgCostPerPint: avg((r) => r.costPerPint),
    cheapest: extreme((a, b) => a < b),
    priciest: extreme((a, b) => a > b),
  };
}

// What is actually stopping the book from being costable, ranked by how much
// each fix would buy. One unpriced malt used in twelve recipes is one price to
// enter and twelve beers gained; the per-recipe warnings alone never make that
// visible, because each one only ever sees its own gap.
export function blockers(rows = []) {
  const byName = new Map();
  for (const row of rows) {
    for (const m of row.missing) {
      const key = `${m.category} ${m.name}`;
      const hit = byName.get(key) || { category: m.category, name: m.name, unit: m.unit, recipes: [] };
      // A name appears at most once per recipe: computeRecipeCost() has already
      // folded an ingredient used at several stages into one line.
      hit.recipes.push(row.name);
      byName.set(key, hit);
    }
  }
  return [...byName.values()].sort(
    (a, b) => b.recipes.length - a.recipes.length || compareNames(a.name, b.name)
  );
}

// Column sorting for the table. Names collate; money and volume sort
// numerically with nulls LAST in both directions — a recipe with no volume has
// no cost per bbl, and floating it to the top of an ascending sort would read
// as the cheapest beer in the book. Ties fall back to the name, so a sort is
// never arbitrary between two equal figures.
export const SORT_KEYS = ["name", "total", "costPerBbl", "costPerKeg", "costPerPint", "kegs"];

export function sortRows(rows = [], key = "name", dir = "asc") {
  const sign = dir === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    if (key === "name") return sign * compareNames(a.name, b.name);
    const x = a[key];
    const y = b[key];
    if (x == null && y == null) return compareNames(a.name, b.name);
    if (x == null) return 1;
    if (y == null) return -1;
    if (x === y) return compareNames(a.name, b.name);
    return sign * (x - y);
  });
}
