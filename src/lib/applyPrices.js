// Turn a vendor price file into priced inventory rows.
//
// The catalog in products.js knows *what* we buy for each generic ingredient
// (SKU, vendor, pack size); it deliberately holds no prices, because this repo
// is public and BSG marks its pricing confidential. So a price file supplies
// only `{sku: {price, effective}}`, and this module joins the two:
//
//   ingredient name → default SKU → product pack → cost per recipe unit
//
// That join is also the shape the future price-list uploader needs — parse a
// vendor list into {sku: price} in the browser, hand it to applyPrices(), write
// the result to the private database. Nothing confidential touches git either way.

import { productsBySku, defaultProductMap, categoryUnit } from "./products";
import { costPerUnit } from "./pricing";
import { adjUnits } from "./defaults";

// Adjuncts carry a per-item unit; the other categories have one unit each.
const unitFor = (category, name, row) =>
  category === "adj" ? (row?.u || adjUnits[name]) : categoryUnit[category];

// Read a parsed price file. Accepts either the wrapped form written by the seed
// generator ({prices: {...}}) or a bare {sku: price} map, and tolerates a plain
// number in place of {price}.
export function readPriceFile(json) {
  const raw = json?.prices ?? json;
  if (!raw || typeof raw !== "object") return {};
  const out = {};
  for (const [sku, v] of Object.entries(raw)) {
    if (sku.startsWith("_")) continue;
    const price = typeof v === "number" ? v : v?.price;
    if (!Number.isFinite(price)) continue;
    out[sku] = { price, effective: (typeof v === "object" && v?.effective) || null };
  }
  return out;
}

// Which vendor product an inventory row is: the curated map first, then the
// row's own SKU.
//
// The map is a deliberate editorial decision in code ("our Pils is now Rahr
// North Star"), so where it has an opinion it wins — that is what let #83
// repoint Pils by editing one line. But it only knows the ~30 generic names
// Slackers started with, and an ingredient ADOPTED from the vendor catalog is
// in none of them. Such a row carries the SKU the brewer picked, and reading it
// here is what makes the next import reprice it. Without this an adopted
// ingredient's price would freeze at whatever the list said the day it was
// adopted, and freeze SILENTLY — exactly the failure that hid a discontinued
// Pils SKU for a year.
export const skuFor = (category, row) =>
  defaultProductMap[category]?.[row?.n] || row?.sku || null;

// Price one category's inventory rows, returning new rows (never mutating).
// A row whose ingredient has no mapped product, or whose product has no price in
// this file, is returned with its existing pricing untouched — importing a
// partial price list must not wipe prices already entered by hand.
//
// `catalog` is an optional {sku: {packQty, packUnit, vendor}} lookup for
// products products.js has never heard of. The price import passes the rows it
// just parsed, so an adopted ingredient is costed against the pack size THIS
// file quotes rather than the one it was adopted at — a repack (Mango Puree
// 44.1 lb → 44 lb) moves the denominator of every price derived from it.
export function priceRows(category, rows, priceBySku, catalog = {}) {
  return (rows || []).map((row) => {
    const sku = skuFor(category, row);
    const entry = sku ? priceBySku?.[sku] : null;
    if (!sku || !entry) return row;
    // products.js first: it is the hand-checked description of what Slackers
    // buys, and it carries things a parsed row cannot (Whirlfloc's tablet mass,
    // without which "each" has no size). The catalog covers everything it has
    // never heard of — which is every adopted ingredient.
    const product = productsBySku[sku] ?? catalog?.[sku];
    if (!product) return row;
    const raw = costPerUnit({ ...product, price: entry.price }, unitFor(category, row.n, row));
    if (raw == null) return row;
    // Store to the cent. A vendor quote can carry more precision than that
    // (malt at $0.724/lb, hops at $0.874375/oz once converted from $/lb), but a
    // price the UI shows to two decimals has to BE two decimals, or the cost
    // column stops reconciling with the price beside it. Worth at most ~$1.30
    // on a batch. Nearest, not up: costs round up, but a price is a quote.
    const cpu = Math.round(raw * 100) / 100;
    return { ...row, cpu, sku, vendor: product.vendor ?? null, pricedAt: entry.effective };
  });
}

// Apply a price file across all four inventory categories at once.
// Returns { malts, hops, yeast, adj, priced, skipped } so the UI can report what
// actually landed rather than claiming success blindly.
export function applyPrices({ malts = [], hops = [], yeast = [], adj = [] }, priceBySku, catalog = {}) {
  const out = {
    malts: priceRows("malt", malts, priceBySku, catalog),
    hops: priceRows("hop", hops, priceBySku, catalog),
    yeast: priceRows("yeast", yeast, priceBySku, catalog),
    adj: priceRows("adj", adj, priceBySku, catalog),
  };
  const all = [...out.malts, ...out.hops, ...out.yeast, ...out.adj];
  const priced = all.filter((r) => Number.isFinite(r?.cpu)).length;
  return { ...out, priced, skipped: all.length - priced };
}
