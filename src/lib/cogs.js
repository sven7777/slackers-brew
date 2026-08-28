// Per-batch ingredient cost: what a brew of a given recipe costs to make.
//
// Pure, like orderCalc.js and brewSheet.js, so the arithmetic is testable
// without rendering anything. Scope is ingredients only — no packaging, labor,
// or utilities.
//
// Two rules shape the whole module:
//
//   1. An unpriced ingredient is NEVER costed at $0. It goes to `missing` and
//      is left out of the total, so the UI can say "3 ingredients unpriced"
//      instead of quietly reporting a number that's too low. A confidently
//      wrong COGS is worse than an obviously incomplete one.
//
//   2. Only ONE volume is stored. A half-barrel keg is exactly ½ bbl and a 16 oz
//      pint exactly 1/248 of one, so cost/keg and cost/pint are derived from
//      that single volume rather than tracked separately.
//
// Water salts (`recipe.sa`) are deliberately excluded: there's no price source,
// they're dosed in grams, and they come to pennies. The Cost view states that
// rather than silently dropping them.

import { defSettings } from "./defaults";
import { compareNames } from "./sortNames";

export const GAL_PER_BBL = 31;
const KEGS_PER_BBL = 2; // a half-barrel keg is 15.5 gal
export const GAL_PER_KEG = GAL_PER_BBL / KEGS_PER_BBL;
// A 16 oz pint, so 8 to the gallon and 248 to the barrel. This is cost per pint
// of PACKAGED beer — it does not model taproom pour loss (foam, line purge,
// tasters), so the cost of a pint actually sold is somewhat higher.
export const PINTS_PER_BBL = GAL_PER_BBL * 8;

// Every money figure is rounded UP to the cent. Costing should never come in
// under what a batch actually costs, so a fraction of a cent always rounds
// against us.
//
// The toFixed(6) is not cosmetic: 185 × 0.724 lands on 133.94000000000003 in
// binary floating point, and a naive ceil would turn that into $133.95. Kill
// the float noise first, then ceil.
export const ceilCents = (n) =>
  Number.isFinite(n) ? Math.ceil(Number((n * 100).toFixed(6))) / 100 : null;

// Recipe tuple shapes, by category: malt/yeast [name, qty]; hop
// [name, qty, stage, time]; adjunct [name, qty, unit, stage, time]. Adjuncts
// carry their own unit; the rest are implicit per category.
const CATEGORIES = [
  { key: "malt", field: "m", unit: () => "lb" },
  { key: "hop", field: "h", unit: () => "oz" },
  { key: "yeast", field: "y", unit: () => "pack" },
  { key: "adj", field: "a", unit: (t) => t[2] },
];

// Post-boil yield is a free-text brew-sheet field, so it arrives as anything
// from "150" to "4.8 bbl". Parse tolerantly to gallons; return null (not a
// guess) when there's no number to find, so the caller can fall back to the
// brewery default.
export function parseVolume(text) {
  if (typeof text === "number") return Number.isFinite(text) && text > 0 ? text : null;
  if (typeof text !== "string") return null;
  const m = text.match(/-?\d*\.?\d+/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  if (!Number.isFinite(n) || n <= 0) return null;
  return /bbl|barrel/i.test(text) ? n * GAL_PER_BBL : n;
}

// Kettle → packaged loss implied by an average keg count, or null when there is
// nothing usable to derive it from.
//
// More beer packaged than boiled is not a yield, it's a typo (a kettle volume
// left at the 150 gal default while kegs were entered for a bigger system,
// say). Costing must never divide by a volume the brewery didn't make, so that
// case returns null too and the caller falls back to the percentage.
export function lossFromKegs(kegs, kettleGal) {
  if (kegs == null || kettleGal == null) return null;
  const packagedGal = kegs * GAL_PER_KEG;
  return packagedGal < kettleGal ? (1 - packagedGal / kettleGal) * 100 : null;
}

// Where a batch's volume comes from, in ONE place, because two callers used to
// answer it differently. The Cost panel read `settings.lossPct` and fell back to
// 0% when the key was absent; Settings' own preview fell back to the brewery
// default of 33%. A settings record saved before these fields existed has
// neither key, so the same batch read as 100.5 gal packaged in Settings and a
// full 150 gal in Cost — costing every beer against ~50% more volume than it
// ever packages ($90/bbl instead of $135/bbl).
//
// Empty means "use the brewery default", which is what the Settings inputs
// already promise by showing that default as their placeholder.
//
// A recipe may override the brewery loss % with `process.avgKegs`: what this
// beer ACTUALLY yields, averaged over the brews of it. Kegs is the number a
// brewer counts on the floor; a loss percentage is an abstraction derived from
// it, so the recipe-level field asks for the measurement and this function does
// the algebra. A dry-hop-heavy beer packaging 6 kegs and a clean lager
// packaging 7 differ by 14% of their COGS, and nobody should have to work that
// back to "23% vs 28% loss" by hand.
//
// The brewery-wide default works the same way, from `settings.avgKegs`: the
// Settings tab asks for kegs too, so there is one unit for yield in the app
// rather than kegs on a recipe and a percentage behind it in Settings.
//
// That back-solve uses the SETTINGS kettle volume, never the recipe's. The
// setting is a ratio measured on a typical batch — 6.5 kegs off the house 150
// gal boil is 33% loss, and 33% is what should carry over to a recipe that
// boils a different volume. Dividing the house keg count by the recipe's
// kettle would read a 300 gal brew as losing 66%.
//
// Returns `lossPct` either way, so the cost math downstream stays one number
// wide and double batches keep scaling by volume.
export function batchVolume({ recipe, settings } = {}) {
  const settingsGal = parseVolume(settings?.postBoilYield) ?? parseVolume(defSettings.postBoilYield);
  const kettleGal = parseVolume(recipe?.process?.postBoilYield) ?? settingsGal;

  // A stored `lossPct` still stands for a settings record saved before the kegs
  // field existed (and for anyone who prefers the percentage); defSettings
  // backstops both.
  const storedLoss = Number.isFinite(settings?.lossPct) ? settings.lossPct : defSettings.lossPct;
  const defaultAvgKegs = parseKegs(settings?.avgKegs);
  const defaultLossFromKegs = lossFromKegs(defaultAvgKegs, settingsGal);
  const defaultLossPct = defaultLossFromKegs ?? storedLoss;

  const avgKegs = parseKegs(recipe?.process?.avgKegs);
  const recipeLossFromKegs = lossFromKegs(avgKegs, kettleGal);

  return {
    kettleGal,
    lossPct: recipeLossFromKegs ?? defaultLossPct,
    avgKegs,
    source: recipeLossFromKegs != null ? "kegs" : "loss",
    // Kegs were entered and they don't fit in the boil, so the percentage is
    // used instead and the UI says why. Same guard at both levels.
    kegsRejected: recipeLossFromKegs == null && avgKegs != null && kettleGal != null,
    defaultLossPct,
    defaultAvgKegs,
    defaultSource: defaultLossFromKegs != null ? "kegs" : "loss",
    defaultKegsRejected: defaultAvgKegs != null && defaultLossFromKegs == null,
  };
}

// A loss percentage for display. Derived from kegs it carries float noise
// (6.5 kegs off 150 gal is 32.833333…%), and a tenth of a percent is already
// finer than the measurement behind it. Whole numbers stay whole.
export const fmtLossPct = (n) =>
  Number.isFinite(n) ? String(Math.round(n * 10) / 10) : "";

// Average yield is a free-text field like post-boil yield, so "6.5", "6.5 kegs"
// and "  7 " all have to land. Null (not a guess, not 0) when there's no usable
// number, so the caller falls back to the brewery loss %.
export function parseKegs(text) {
  const n = typeof text === "number" ? text : parseFloat(String(text ?? "").trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Build the name → cost-per-unit lookup the cost math needs from the inventory
// arrays the app already holds. Inventory rows gain `cpu` (cost per recipe unit)
// alongside the existing `n`/`q`.
export function priceMapFrom({ malts = [], hops = [], yeast = [], adj = [] }) {
  const pick = (rows) => Object.fromEntries(
    rows.filter(r => r && r.n != null).map(r => [r.n, Number.isFinite(r.cpu) ? r.cpu : null])
  );
  return { malt: pick(malts), hop: pick(hops), yeast: pick(yeast), adj: pick(adj) };
}

// Cost one recipe.
//
//   recipe      — {m[], h[], y[], a[]}
//   priceMap    — {malt:{name:cpu}, hop:…, yeast:…, adj:…}
//   postBoilGal — kettle volume in gallons
//   lossPct     — brewhouse loss from kettle to package (trub, yeast, dry hop
//                 absorption, transfer). Slackers measures ~33%: 150 gal off the
//                 kettle becomes 6.5 kegs.
//   dbl         — a double batch is two brews: ingredients AND volume double,
//                 so the total doubles while cost/bbl stays put.
export function computeRecipeCost({ recipe, priceMap, postBoilGal, lossPct = 0, dbl = false }) {
  const mult = dbl ? 2 : 1;
  const lines = [];
  const missing = [];
  const byCategory = { malt: 0, hop: 0, yeast: 0, adj: 0 };

  for (const { key, field, unit } of CATEGORIES) {
    // The same ingredient may appear at several stages (a hop at boil,
    // whirlpool, and dry hop). Cost cares about the total, not the schedule,
    // so fold them into one line per name — as computeOrder() does.
    const totals = new Map();
    for (const tuple of recipe?.[field] || []) {
      if (!tuple) continue;
      const [name, qty] = tuple;
      const q = Number(qty);
      if (name == null || !Number.isFinite(q)) continue;
      const prev = totals.get(name);
      totals.set(name, { qty: (prev?.qty || 0) + q * mult, unit: prev?.unit ?? unit(tuple) });
    }

    // Alphabetical within the category, matching the Recipes tab's ingredient
    // tables. Order is safe to choose here: the rows key and edit by NAME, and
    // the subtotal sums already-rounded line costs, so it doesn't move a cent.
    const entries = [...totals.entries()].sort(([a], [b]) => compareNames(a, b));

    for (const [name, { qty, unit: u }] of entries) {
      const cpu = priceMap?.[key]?.[name];
      if (!Number.isFinite(cpu)) {
        missing.push({ category: key, name, qty, unit: u });
        lines.push({ category: key, name, qty, unit: u, costPerUnit: null, cost: null });
        continue;
      }
      // Round the line, then build the totals from rounded lines, so the
      // column on screen adds up to the total on screen.
      const cost = ceilCents(qty * cpu);
      byCategory[key] = ceilCents(byCategory[key] + cost);
      lines.push({ category: key, name, qty, unit: u, costPerUnit: cpu, cost });
    }
  }

  const total = ceilCents(byCategory.malt + byCategory.hop + byCategory.yeast + byCategory.adj);

  const kettleGal = Number.isFinite(postBoilGal) && postBoilGal > 0 ? postBoilGal * mult : null;
  const keep = 1 - (Number.isFinite(lossPct) ? lossPct : 0) / 100;
  const packagedGal = kettleGal != null && keep > 0 ? kettleGal * keep : null;
  const packagedBbl = packagedGal != null ? packagedGal / GAL_PER_BBL : null;
  const kegs = packagedBbl != null ? packagedBbl * KEGS_PER_BBL : null;

  // Without a usable volume there is no per-bbl figure. Null, not Infinity or
  // NaN, so the UI has one thing to check.
  const pints = packagedBbl != null ? packagedBbl * PINTS_PER_BBL : null;
  const priced = packagedBbl != null && packagedBbl > 0;
  // Each derived from the same total and its own volume, then rounded up
  // independently — so at the cent they can sit a penny off exact halving.
  // That's the cost of every figure being a true ceiling; the underlying
  // quantities are still one volume apart.
  const costPerBbl = priced ? ceilCents(total / packagedBbl) : null;
  const costPerKeg = priced ? ceilCents(total / kegs) : null;
  const costPerPint = priced ? ceilCents(total / pints) : null;

  return {
    lines, byCategory, total, missing,
    packagedGal, packagedBbl, kegs, pints,
    costPerBbl, costPerKeg, costPerPint,
  };
}
