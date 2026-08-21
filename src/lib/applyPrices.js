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

// Price one category's inventory rows, returning new rows (never mutating).
// A row whose ingredient has no mapped product, or whose product has no price in
// this file, is returned with its existing pricing untouched — importing a
// partial price list must not wipe prices already entered by hand.
export function priceRows(category, rows, priceBySku) {
  const map = defaultProductMap[category] || {};
  return (rows || []).map((row) => {
    const sku = map[row?.n];
    const entry = sku ? priceBySku?.[sku] : null;
    if (!sku || !entry) return row;
    const product = productsBySku[sku];
    const cpu = costPerUnit({ ...product, price: entry.price }, unitFor(category, row.n, row));
    if (cpu == null) return row;
    return { ...row, cpu, sku, vendor: product.vendor ?? null, pricedAt: entry.effective };
  });
}

// Apply a price file across all four inventory categories at once.
// Returns { malts, hops, yeast, adj, priced, skipped } so the UI can report what
// actually landed rather than claiming success blindly.
export function applyPrices({ malts = [], hops = [], yeast = [], adj = [] }, priceBySku) {
  const out = {
    malts: priceRows("malt", malts, priceBySku),
    hops: priceRows("hop", hops, priceBySku),
    yeast: priceRows("yeast", yeast, priceBySku),
    adj: priceRows("adj", adj, priceBySku),
  };
  const all = [...out.malts, ...out.hops, ...out.yeast, ...out.adj];
  const priced = all.filter((r) => Number.isFinite(r?.cpu)).length;
  return { ...out, priced, skipped: all.length - priced };
}
