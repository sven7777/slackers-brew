// What a price import would actually do, computed BEFORE it does it.
//
// Importing a vendor list rewrites the numbers every batch cost is built from,
// across the whole brewery and straight into the shared database. So the UI
// shows the change set first and applies it only on confirmation, and this is
// the module that produces it: old price → new price, per ingredient, plus an
// honest account of everything the file did NOT cover.
//
// It deliberately reports three outcomes rather than a success count. An
// ingredient the list doesn't price is not the same as one whose price didn't
// move, and neither is the same as one we have no product mapping for at all —
// collapsing them is how a half-applied import passes for a complete one.

import { applyPrices } from "./applyPrices";
import { defaultProductMap, productsBySku } from "./products";

const CATEGORIES = [
  ["malt", "malts"],
  ["hop", "hops"],
  ["yeast", "yeast"],
  ["adj", "adj"],
];

export const categoryLabels = { malt: "Malts", hop: "Hops", yeast: "Yeast", adj: "Adjuncts" };

// Compare current inventory against a {sku: {price}} map.
//
// Returns the priced inventory (`next`, ready to save) alongside:
//   changes   — priced differently than before (`from` null = newly priced)
//   unchanged — covered by the file, same price to the cent
//   skipped   — not covered, with why ("unmapped" | "absent")
export function priceChanges(inventory, priceBySku) {
  const next = applyPrices(inventory, priceBySku || {});
  const changes = [];
  const unchanged = [];
  const skipped = [];

  for (const [category, key] of CATEGORIES) {
    const before = inventory?.[key] || [];
    const after = next[key] || [];
    before.forEach((row, i) => {
      const name = row?.n;
      const sku = defaultProductMap[category]?.[name] || null;
      const entry = {
        category,
        name,
        sku,
        vendor: sku ? productsBySku[sku]?.vendor ?? null : null,
        from: Number.isFinite(row?.cpu) ? row.cpu : null,
        to: Number.isFinite(after[i]?.cpu) ? after[i].cpu : null,
      };

      // No vendor product for this ingredient (honey, ghost peppers), or the
      // list simply doesn't carry it (hops aren't on the malt list at all).
      if (!sku) { skipped.push({ ...entry, reason: "unmapped" }); return; }
      if (!priceBySku?.[sku]) { skipped.push({ ...entry, reason: "absent" }); return; }

      // Covered, but the conversion didn't reconcile (unit mismatch) — the price
      // exists yet can't be expressed in the recipe's unit, so nothing changes.
      if (entry.to == null) { skipped.push({ ...entry, reason: "unconvertible" }); return; }

      if (entry.from == null || entry.from !== entry.to) changes.push(entry);
      else unchanged.push(entry);
    });
  }

  return { next, changes, unchanged, skipped };
}
