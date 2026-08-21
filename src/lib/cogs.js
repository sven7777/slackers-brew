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
//   2. Only ONE volume is stored. A half-barrel keg is exactly ½ bbl, so
//      cost/keg is always cost/bbl ÷ 2 — deriving it rather than tracking a
//      second number means the two can never drift apart.
//
// Water salts (`recipe.sa`) are deliberately excluded: there's no price source,
// they're dosed in grams, and they come to pennies. The Cost view states that
// rather than silently dropping them.

const GAL_PER_BBL = 31;
const KEGS_PER_BBL = 2; // a half-barrel keg is 15.5 gal

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

    for (const [name, { qty, unit: u }] of totals) {
      const cpu = priceMap?.[key]?.[name];
      if (!Number.isFinite(cpu)) {
        missing.push({ category: key, name, qty, unit: u });
        lines.push({ category: key, name, qty, unit: u, costPerUnit: null, cost: null });
        continue;
      }
      const cost = qty * cpu;
      byCategory[key] += cost;
      lines.push({ category: key, name, qty, unit: u, costPerUnit: cpu, cost });
    }
  }

  const total = byCategory.malt + byCategory.hop + byCategory.yeast + byCategory.adj;

  const kettleGal = Number.isFinite(postBoilGal) && postBoilGal > 0 ? postBoilGal * mult : null;
  const keep = 1 - (Number.isFinite(lossPct) ? lossPct : 0) / 100;
  const packagedGal = kettleGal != null && keep > 0 ? kettleGal * keep : null;
  const packagedBbl = packagedGal != null ? packagedGal / GAL_PER_BBL : null;
  const kegs = packagedBbl != null ? packagedBbl * KEGS_PER_BBL : null;

  // Without a usable volume there is no per-bbl figure. Null, not Infinity or
  // NaN, so the UI has one thing to check.
  const costPerBbl = packagedBbl != null && packagedBbl > 0 ? total / packagedBbl : null;
  const costPerKeg = costPerBbl != null ? costPerBbl / KEGS_PER_BBL : null;

  return { lines, byCategory, total, missing, packagedGal, packagedBbl, kegs, costPerBbl, costPerKeg };
}
