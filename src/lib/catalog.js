// The vendor catalog: everything the vendor sells, not just what we stock.
//
// `products.js` is the hand-curated bridge from brewer shorthand to the ~30
// SKUs Slackers actually buys. This module is the other half: the whole price
// list, ingested verbatim, so a recipe can call for a malt the brewery has
// never bought and the Add picker can still offer it.
//
// The rows are already there. `parsePriceList()` parses the entire file on
// every price import — 563 product rows on the August 2026 Houston list — and
// until now everything outside `defaultProductMap` was simply never looked at,
// because `priceChanges()` walks INVENTORY and asks the file about each row.
// This walks the file instead.
//
// ⚠️ Prices flow through here, so nothing in this module may be committed with
// a real one attached. The catalog is stored in the private database exactly
// like `inventory.cost_per_unit`; fixtures use fabricated round numbers. Same
// rule as products.js, same reason: this repo is public and BSG stamps its
// lists confidential.

// Vendor codes, from characters 2-4 of the SKU. Only the ones the list actually
// demonstrates: MWEY is Weyermann on all 60 of its rows, MSIM Simpsons on all
// 31, and so on. The generic `*ZZZ` buckets encode no vendor at all (BZZZ alone
// holds 185 rows from a dozen suppliers), so they resolve to null and the
// vendor stays unknown rather than guessed.
const VENDOR_BY_CODE = {
  RAH: "Rahr",
  WEY: "Weyermann",
  SIM: "Simpsons",
  DIN: "Dingemans",
  CRI: "Crisp",
  GAM: "Gambrinus",
  MCI: "Minch",
};

export function vendorFromSku(sku) {
  const code = String(sku ?? "").slice(1, 4);
  return VENDOR_BY_CODE[code] ?? null;
}

// Yeast is recognisable by brand, not by SKU: the vendor files yeast under the
// same `B` prefix as sanitiser, oak, rice hulls and keg bungs. These are the
// dry-yeast brand families on the list, plus DADY, which spells itself out
// (Distillers Active Dry Yeast).
//
// ⚠️ Matching the word "yeast" itself would be wrong, and so would the obvious
// brand sweep. The list's "Yeast Nutrients" section holds Yeastex® 61 and
// Yeastex® 82, and the whole Kerry Pathfinder range ends in
// "Pathfinder N-Pure Seltzer Nutrient" — nutrients, filed beside the yeast and
// named like it. Both were in an earlier draft of this pattern and both were
// wrong. A nutrient classified as yeast becomes a pitchable strain in the Add
// picker, which is a worse outcome than an unclassified row a human sorts out.
const YEAST_RE = /\b(SafAle|SafLager|SafBrew|SafSpirit|SafCider|Fermentis|LalBrew|Lallemand|DADY)/i;

// Categories a recipe can actually use. Anything else is `other` — real
// catalogue entries the brewery may well buy, but never grain-bill lines.
export const CATALOG_CATEGORIES = ["malt", "hop", "yeast", "adj", "other"];

// Classify a row, or decline to.
//
// ⚠️ Deliberately few rules, each one the list demonstrates outright, and
// `null` for everything else. Category decides which recipe table an
// ingredient can join, so a wrong guess files a malt under hops; and unlike a
// mistyped price, nothing downstream re-checks it. The rest are classified by
// the brewer when the ingredient is adopted, which is the same judgement
// `defaultProductMap` records by hand today.
//
// What that leaves, on the August 2026 list: 163 malts and 62 yeasts named
// outright, 27 rows fenced off as `other`, and the remainder unclassified —
// which is reported as its own number rather than folded into a success count.
export function classify(row) {
  const sku = String(row?.sku ?? "");
  const name = String(row?.name ?? "");

  // Equipment (Grainfather G70, saccharometers, test jars) and merchandise
  // (Xtratuf boots) — fenced off so they can never reach an ingredient picker.
  if (/^[EX]/.test(sku)) return "other";

  // The whole M range is malt: 163 rows on this list, every one of them.
  if (sku.startsWith("M")) return "malt";

  if (YEAST_RE.test(name)) return "yeast";

  return null;
}

// --- pack sizes -----------------------------------------------------------
//
// A price means nothing without the quantity it buys. The list says this two
// different ways: a unit column of "price / lb" (the price IS per pound), or
// "each" (the price buys one pack, whose size is written into the name).

const PER_LB_RE = /^\s*price\s*\/\s*lb\s*$/i;
const PER_100_RE = /^\s*per\s*(\d+)\s*$/i;

// "- 55 lb", "- 500 g", "- 5.9 kg", "2lb", "50lb", "5 gallon", "1L", "- 6 pack",
// "6-pack", and the same followed by the container it ships in ("- 60 lb Pail",
// "- 3000 lb (Tote)").
//
// Anchored at the END of the name, because that is where the vendor writes the
// pack and a name can carry other numbers. That anchor is doing real work: it
// is what stops the inch marks in 'Oak 1.5" x 9"' and '1 lb Nylon Bag 11" x 8"'
// from being read as a pack size — those rows end in dimensions, so they match
// nothing and are honestly reported as having no pack.
const CONTAINER = "pail|drum|tote|case|jug|bottle|can|keg|bag|box|tub|pack";
const PACK_RE = new RegExp(
  String.raw`(?:^|[-\s(])(\d+(?:\.\d+)?)\s*-?\s*(lb|lbs|kg|g|gal|gallon|l|ml|oz|pack|ct)\b\.?\s*\)?` +
  String.raw`(?:\s*\(?\s*(?:${CONTAINER})s?\s*\)?)?\s*$`,
  "i",
);

const UNIT_ALIASES = {
  lbs: "lb", gallon: "gal", pack: "each", ct: "each", l: "L",
};

// The name with its pack suffix removed: "Fermentis SafAle™ K-97 - 500 g" →
// "Fermentis SafAle™ K-97". Two things need this and they need it to agree.
// The adopt dialog suggests a short name from it, and it is what groups the
// SKUs that are the SAME product in different sizes — Coriander Powder is sold
// at 2 lb and 50 lb under two SKUs, and a brewer adopting it is choosing a
// size, not choosing between two ingredients. Same regex as parsePack(), so a
// suffix that is read as a pack is always the suffix that is stripped.
export function stripPack(name) {
  return String(name ?? "").replace(PACK_RE, "").replace(/\s+/g, " ").trim();
}

// Pack size for one row, or null when the file doesn't say.
//
// Returning null rather than a default is the same rule `costPerUnit()` keeps:
// a pack we can't read makes the row uncostable, which must be visible, never
// quietly assumed to be one pound.
export function parsePack(row) {
  const unit = String(row?.unit ?? "");
  const name = String(row?.name ?? "");

  // Quoted per pound: the pack is one pound regardless of the sack it ships in,
  // exactly as products.js records for malts and hops.
  if (PER_LB_RE.test(unit)) return { qty: 1, unit: "lb" };

  const per = PER_100_RE.exec(unit);
  if (per) return { qty: Number(per[1]), unit: "each" };

  const m = PACK_RE.exec(name);
  if (!m) return null;
  const qty = Number(m[1]);
  if (!Number.isFinite(qty) || qty <= 0) return null;
  const raw = m[2].toLowerCase();
  return { qty, unit: UNIT_ALIASES[raw] ?? raw };
}

// --- building the catalog -------------------------------------------------

// One parsed price-list row → one catalog entry.
//
// `category: null` and `pack: null` are both legitimate outcomes and are kept
// as-is: the entry still belongs in the catalog (it is a thing the vendor
// sells), it simply isn't ready to be costed or added to a recipe until a
// human fills the gap in.
export function catalogEntry(row, { source = null, effective = null } = {}) {
  const pack = parsePack(row);
  return {
    sku: row.sku,
    name: row.name,
    vendor: vendorFromSku(row.sku),
    category: classify(row),
    price: row.price,
    packQty: pack?.qty ?? null,
    packUnit: pack?.unit ?? null,
    source,
    effective,
  };
}

// A whole parsed price list → catalog entries, plus the counts the review
// screen reports.
//
// A SKU repeated in the file is already collapsed by parsePriceList (the "New
// and Notable" block reprints rows), so entries are unique by SKU here.
export function buildCatalog(rows, meta = {}) {
  const entries = (rows ?? []).map((r) => catalogEntry(r, meta));
  const byCategory = {};
  let unclassified = 0;
  let unpacked = 0;
  for (const e of entries) {
    if (e.category) byCategory[e.category] = (byCategory[e.category] ?? 0) + 1;
    else unclassified++;
    if (e.packQty == null) unpacked++;
  }
  return { entries, counts: { total: entries.length, byCategory, unclassified, unpacked } };
}
