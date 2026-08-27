// Adopting a catalog product: the one-way bridge from what the vendor sells to
// what's on our shelf.
//
//   Catalog (563 rows, reference)  --adopt-->  Inventory (~55 rows, ours)
//
// The catalog is deliberately NOT the inventory. Inventory is a counting sheet
// — a screen per category, a quantity per row — and 163 malts would wreck it,
// make "N of M priced" meaningless, and turn every quantity edit into a
// 163-row delete-then-insert (the shape behind the save race). So a vendor row
// becomes an inventory row only when a brewer says "we buy this one", and that
// moment is where three things get decided that no parser can decide:
//
//   the NAME    — vendor names are catalog entries, not brew-sheet lines.
//                 "Rahr The Brewer's Standard™ 2-Row" verbatim would both print
//                 on a brew sheet and sit next to the existing "2-Row" as a
//                 second row for one sack. We suggest a stripped name to save
//                 typing; the brewer owns the judgement.
//   the CATEGORY — which recipe table it may join. classify() leaves ~311 of
//                 563 rows unclassified on purpose, because a wrong guess files
//                 a malt under hops and nothing downstream re-checks it. Nobody
//                 would ever classify 311 things; a brewer classifies the one
//                 they are buying, at the moment they buy it.
//   the PACK    — 79 base names on the August 2026 list ship in more than one
//                 size (Coriander Powder at 2 lb and at 50 lb). The catalog
//                 cannot know which one Slackers orders, and the pack is the
//                 denominator of the derived price.
//
// Everything here is pure. The dialog that collects those three answers is
// components/AdoptDialog.jsx.

import { skuFor } from "./applyPrices";
import { stripPack } from "./catalog";
import { costPerUnit } from "./pricing";
import { categoryUnit, defaultProductMap } from "./products";
import { compareNames } from "./sortNames";

// The categories an adopted row can land in. `other` (equipment, merchandise)
// is deliberately absent: those are real things the brewery buys and they are
// still browsable, but they are never grain-bill lines.
export const ADOPT_CATEGORIES = ["malt", "hop", "yeast", "adj"];

export const categoryLabels = { malt: "Malt", hop: "Hop", yeast: "Yeast", adj: "Adjunct" };

// Which inventory list a category writes to, matching App.jsx's state names.
export const categoryKey = { malt: "malts", hop: "hops", yeast: "yeast", adj: "adj" };

// The units an adjunct can be counted in. Every other category has exactly one
// (categoryUnit in products.js); adjuncts carry their own per row, because a
// brewery measures honey in pounds and Clarity Ferm in millilitres.
export const ADJ_UNITS = ["lbs", "oz", "ml", "each"];

// --- the suggested name ---------------------------------------------------

const TRADEMARKS = /[™®©]/g;

// Collapse runs of whitespace and drop the separators a stripped pack suffix
// leaves behind ("Fermentis SafAle™ K-97 - 500 g" strips to "…K-97 -"). Shared
// by the suggested name and the grouping key, because a trailing dash that
// survived in one and not the other would put the same product in two groups.
const tidy = (s) => String(s ?? "").replace(/\s+/g, " ").replace(/^[-–,\s]+|[-–,\s]+$/g, "");

// A short, brew-sheet-shaped name suggested from a catalog row: pack suffix,
// trademark marks and the vendor's own name removed.
//
// Only the vendor the SKU itself names is stripped (see vendorFromSku) —
// "Gambrinus Munich Light" is Munich Light, and every one of Gambrinus' 40 rows
// repeats the word. Nothing else is: a brand INSIDE a name may be the only
// thing identifying the product ("SafAle K-97" is not "K-97" to everyone), and
// guessing there would be editing the brewer's data rather than saving them
// keystrokes. EDITABLE wherever it is offered — it is a first draft, and the
// brewer is the one who knows this sack is what they have always called
// "2-Row".
export function suggestName(entry) {
  let n = stripPack(entry?.name ?? "").replace(TRADEMARKS, "");
  const vendor = entry?.vendor;
  if (vendor && n.toLowerCase().startsWith(`${vendor.toLowerCase()} `)) {
    n = n.slice(vendor.length + 1);
  }
  return tidy(n);
}

// --- pack sizes -----------------------------------------------------------

// The grouping key for "the same product in a different size". Lower-cased and
// trademark-free so "Weyermann® Sinamar® - 5.9 kg" and "- 25 kg" group.
export const packBase = (name) => tidy(stripPack(name ?? "").replace(TRADEMARKS, "")).toLowerCase();

// Every SKU that is this product in some size, the given one included, ordered
// smallest pack first. An unreadable pack sorts last: it is the one a brewer
// should think twice about, since it cannot be costed.
export function packSiblings(entries = [], entry) {
  if (!entry) return [];
  const base = packBase(entry.name);
  return entries
    .filter((e) => packBase(e.name) === base)
    .sort((a, b) => {
      if (a.packQty == null) return b.packQty == null ? compareNames(a.sku, b.sku) : 1;
      if (b.packQty == null) return -1;
      if (a.packUnit === b.packUnit) return a.packQty - b.packQty;
      return compareNames(`${a.packUnit}`, `${b.packUnit}`);
    });
}

// How a pack reads on screen. Null is not "1" and must not print as a size.
export const packLabel = (entry) =>
  entry?.packQty == null ? "pack size not listed" : `${entry.packQty} ${entry.packUnit ?? ""}`.trim();

// --- the derived price ----------------------------------------------------

// The unit an adopted row will be counted in. Malts are pounds, hops ounces,
// yeast pitches; an adjunct takes whichever unit its pack suggests, which the
// dialog then lets the brewer change.
export function suggestUnit(category, entry) {
  if (category !== "adj") return categoryUnit[category] ?? null;
  const u = String(entry?.packUnit ?? "").toLowerCase();
  if (u === "each") return "each";
  if (u === "ml" || u === "l" || u === "gal") return "ml";
  if (u === "g" || u === "kg" || u === "lb" || u === "oz") return "lbs";
  return "lbs";
}

// What one recipe unit of this product costs, and — when that can't be
// answered — WHY, so the dialog can say so before anything is stored rather
// than leaving a silent null to surface later as an unpriced ingredient.
//
// Same rounding as every other stored price: to the cent, nearest rather than
// up, because this is a vendor quote and not a cost (see applyPrices.js).
export function derivedCost(entry, unit) {
  if (entry?.price == null || !Number.isFinite(entry.price)) return { cpu: null, why: "unpriced" };
  if (entry.packQty == null) return { cpu: null, why: "nopack" };
  const raw = costPerUnit({ packQty: entry.packQty, packUnit: entry.packUnit, price: entry.price }, unit);
  if (raw == null) return { cpu: null, why: "unconvertible" };
  return { cpu: Math.round(raw * 100) / 100, why: null };
}

export const costGaps = {
  unpriced: "This list didn't quote a price for it.",
  nopack: "The list doesn't say what size this pack is, so a per-unit price can't be worked out.",
  unconvertible: "The pack is measured in units this can't be counted in.",
};

// --- landing it on the shelf ----------------------------------------------

// Does the brewery already stock something by this name? Checked across every
// category, not just the one being adopted into.
//
// ⚠️ This is the Carafa lesson. One sack ended up as THREE inventory rows —
// Carafa III, Carafe III and Carafa Special III — because nothing ever asked.
// The answer is a warning rather than a block: two products really can share a
// short name, and the brewer is the one who knows.
export function findDuplicate(inventory = {}, name) {
  const want = String(name ?? "").trim().toLowerCase();
  if (!want) return null;
  for (const category of ADOPT_CATEGORIES) {
    const item = (inventory[categoryKey[category]] ?? []).find(
      (it) => String(it?.n ?? "").trim().toLowerCase() === want,
    );
    if (item) return { category, item };
  }
  return null;
}

// --- linking an existing row ----------------------------------------------
//
// Adopting creates a row; linking points one that already exists at a product.
// They are the same act at two different times, and the second one is needed
// because a row can arrive with no product at all: typed in by hand, or created
// implicitly by the price field (the Whirlfloc case). Such a row is costed at
// nothing forever, and nothing on screen says which product it should be —
// prod carried "Candi Sugar, Dark" exactly like that.

// The vendor product a row resolves to today, or null. Same resolution the
// price import uses, so what the Inventory tab shows is what an import will act
// on rather than a second opinion.
export const productSku = (category, row) => skuFor(category, row);

// Is this row's OWN sku what decides which product it is?
//
// ⚠️ Only then is linking offered. `defaultProductMap` is a brewery-wide
// editorial decision that lives in code and wins over a row's sku (that is what
// let #83 repoint Pils by editing one line), so a per-row link on a name the map
// covers would appear to work and change nothing. The rows that need linking are
// exactly the ones the map has never heard of: hand-typed names, and anything
// adopted from the catalog.
export const isLinkable = (category, row) => !defaultProductMap[category]?.[row?.n];

// What linking writes onto the row.
//
// ⚠️ The price is written ONLY when one could be derived. A product with no
// price on this list, or a pack that doesn't reconcile with the unit, must not
// blank a number somebody typed in by hand — the same rule a partial price
// import keeps.
export function linkFields(entry, unit) {
  const { cpu } = derivedCost(entry, unit);
  return {
    sku: entry?.sku ?? null,
    vendor: entry?.vendor ?? null,
    ...(cpu == null ? null : { cpu, pricedAt: entry?.effective ?? null }),
  };
}

// The inventory row an adoption produces.
//
// Quantity 0 — adopting says "we buy this", not "we have this", and Derek's
// call was no quantity prompt: you type the number on the Inventory tab, which
// is where you are standing when you count it.
//
// `sku` is the important field. It is what makes the next price import reprice
// this ingredient (applyPrices reads the row's own SKU before the curated map),
// so an adopted ingredient is a first-class one rather than a name whose price
// freezes at whatever the list said the day it was adopted.
export function adoptedRow(entry, { name, category, unit } = {}) {
  const u = unit ?? suggestUnit(category, entry);
  const { cpu } = derivedCost(entry, u);
  return {
    n: String(name ?? "").trim() || suggestName(entry),
    q: 0,
    ...(category === "adj" ? { u } : null),
    cpu,
    sku: entry?.sku ?? null,
    vendor: entry?.vendor ?? null,
    pricedAt: entry?.effective ?? null,
  };
}
