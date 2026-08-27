// The spot hop list as CATALOG entries — every variety BSG quoted, not just the
// fourteen Slackers buys.
//
// This is the hop half of the vendor catalog, and it merges on a different key
// than the malt half, which is the whole reason it is its own module. The
// Houston price list gives every product a vendor SKU, and that SKU is the
// identity everything else hangs off. The spot hop list has no SKUs at all: it
// is a variety × crop-year table printed out of a spreadsheet. So identity here
// is the VARIETY, and the SKU is synthesised from it — the same trick
// products.js already plays with `HOP-CAS`, extended to varieties nobody has
// bought yet.
//
// Two things follow from that, and both are load-bearing:
//
//   * a variety we already buy MUST resolve to the SKU products.js already
//     assigned it. Generating `HOP-CASCADE` beside the existing `HOP-CAS` would
//     put two identities on one hop, and the catalog's first rule is that the
//     SKU is the identity;
//   * a synthesised SKU has to be stable across imports, or every month's list
//     would read as a page of brand-new products.
//
// ⚠️ Prices flow through here. Same rule as everywhere else: never commit one,
// fixtures use fabricated round numbers.

import { newestQuote, ourHops } from "./spotHops";
import { compareNames } from "./sortNames";

// --- the variety, read off the row label -----------------------------------
//
// Labels on the April 2026 list, in the shapes they actually occur:
//
//   Cascade Pellet - 11lb                     Strata® - 11lb
//   Bravo™ Hop Pellet 44 lb                   Czech Saaz 11 lb/5 kg
//   Nelson Sauvin™ Pellet - 11lb New Zealand  Hallertau Mittelfrüh Pellet - 11lb
//   Amarillo® Pellet - 11lb* American/German
//
// The variety is everything BEFORE the product form or the pack size, and the
// origin that trails some rows falls away with it. Cutting there rather than
// trying to describe a variety is what makes this survive the list's
// inconsistency — three different ways of writing "11 lb" and two different
// places to put the word "Pellet".
const CUT_RE = /\s*\b(?:hop\s+pellets?|pellets?|hops?|t-?90|\d{1,3}\s?lb\b|-\s*co2)\b/i;

// ⚠️ Case is PRESERVED here, unlike everywhere else in the hop parse.
// `normalizeVariety` folds case because it exists to MATCH two spellings of one
// hop; this name is going to be stored, shown in the Add picker and printed on
// a brew sheet, and "cascade" is not what anyone calls it.
const tidyLabel = (label) => String(label ?? "")
  .replace(/[®™©|]/g, " ")
  .replace(/[\u2010-\u2015]/g, "-")
  .replace(/\s+/g, " ")
  .trim();

// A variety name from a row label, or null when the label has no form or pack
// marker to cut at. Null is the honest answer for a row this rule does not
// understand: inventing a variety from a whole label would put "Amarillo® -
// CO2 Hop Extract (150GMA)" in the Add picker as an ingredient.
export function varietyOf(label) {
  const text = tidyLabel(label);
  const cut = CUT_RE.exec(text);
  if (!cut) return null;
  const name = text.slice(0, cut.index).replace(/[\s\-–,*]+$/, "").trim();
  return name || null;
}

// --- identity --------------------------------------------------------------

// Fold to the letters a SKU can carry: accents off (Hallertau Mittelfrüh),
// punctuation and spaces out.
const slug = (variety) => String(variety ?? "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toUpperCase().replace(/[^A-Z0-9]/g, "");

// The SKU for a variety: the one products.js already assigned if we buy this
// hop, otherwise a stable synthetic one.
//
// ⚠️ The lookup comes first and is deliberately loose (case and punctuation
// folded), because getting it wrong is not a cosmetic problem: `HOP-CASCADE`
// alongside the existing `HOP-CAS` would be two catalog identities for one hop,
// and every rename/repack/discontinued check in catalogChanges.js is keyed on
// exactly that identity.
export function hopSku(variety, hops = ourHops()) {
  const want = slug(variety);
  if (!want) return null;
  const known = hops.find((h) => slug(h.name) === want);
  return known ? known.sku : `HOP-${want}`;
}

// --- pack ------------------------------------------------------------------

// The box the variety ships in, from the label ("- 11lb", "44 lb",
// "11 lb/5 kg"). This is the ORDER pack, not the pricing pack: the list quotes
// every hop per pound, so a catalog entry's pack is 1 lb exactly as products.js
// records for the hops we already buy, and the box is carried alongside for the
// order sheet.
const BOX_RE = /(\d{1,3})\s?lb\b/i;
export const orderPackOf = (label) => {
  const m = BOX_RE.exec(String(label ?? ""));
  return m ? `${m[1]} lb` : null;
};

// --- building --------------------------------------------------------------

// Rows that describe a hop we could actually put in a recipe.
//
// ⚠️ Cryo, Enriched and CO2 extract are excluded, and the exclusion is counted
// rather than silent. Extract is quoted per CAN, so carrying it as a per-pound
// price would be a straightforward lie; Cryo and Enriched are concentrated
// products at their own money, and a recipe calling for "Cascade" costed at
// Cryo prices is a large silent error. A 44 lb box is NOT excluded here, unlike
// in the pricing path: it is a real product, its price is quoted per pound like
// every other row, and on the April 2026 list it is the ONLY way Lemondrop
// appears at all.
const isCatalogRow = (row) => !/\b(cryo|enriched)\b|\bco2\b|\bextract\b/i.test(row?.label ?? "");

// Parsed spot-hop rows → catalog entries, one per variety.
//
// Rows are pooled by variety before pricing, exactly as the review screen pools
// them (`newestQuote`), so the price a brewer confirms for a hop we stock and
// the price stored against the same hop in the catalog are the same number
// read the same way. The crop year is read off the list, never stored — the
// brewery buys the newest crop, and which year that is is a property of the
// page in front of you.
export function buildHopCatalog(rows, { source = null, effective = null } = {}) {
  const usable = (rows ?? []).filter(isCatalogRow);
  const skippedVariants = (rows ?? []).length - usable.length;

  const byVariety = new Map();
  let unnamed = 0;
  for (const row of usable) {
    const variety = varietyOf(row.label);
    if (!variety) { unnamed++; continue; }
    const key = variety.toLowerCase();
    if (!byVariety.has(key)) byVariety.set(key, { variety, rows: [] });
    byVariety.get(key).rows.push(row);
  }

  const entries = [...byVariety.values()].map(({ variety, rows: found }) => {
    const quote = newestQuote(found);
    return {
      sku: hopSku(variety),
      name: variety,
      vendor: null,          // the spot list names no supplier per row
      category: "hop",       // the one category a document can demonstrate outright
      // Null, not zero, when the newest crop year is contested — the same rule
      // the review screen keeps by prefilling nothing. A hop nobody can price
      // is still a hop worth listing.
      price: quote.price,
      packQty: 1,
      packUnit: "lb",        // every row on this list is quoted per pound
      orderPack: orderPackOf(found[0]?.label),
      cropYear: quote.year,
      source,
      effective,
    };
  }).sort((a, b) => compareNames(a.name, b.name));

  const priced = entries.filter((e) => e.price != null).length;
  return {
    entries,
    counts: {
      rows: (rows ?? []).length,
      varieties: entries.length,
      priced,
      unpriced: entries.length - priced,
      skippedVariants,
      unnamed,
    },
  };
}

// The varieties on this list that the brewery has never bought — what makes the
// ingest worth doing at all, and the number worth printing on the review screen.
export function newVarieties(entries = [], hops = ourHops()) {
  const ours = new Set(hops.map((h) => h.sku));
  return entries.filter((e) => !ours.has(e.sku));
}
