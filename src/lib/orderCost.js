// What the order will COST — and the list to paste into the email.
//
// `orderCalc.js` answers "how much of each ingredient do we need": 40 lbs of
// Munich, 3 oz of Saaz. That is the brewing question. This module answers the
// buying one, and they are not the same question:
//
//   ⚠️ YOU BUY WHOLE PACKS. 40 lbs of Munich is one 55 lb sack and costs a
//   whole sack. The rounding UP is the feature, not a rounding error — an
//   estimate built by multiplying 40 × $0.71 says $28.40 for something that
//   will invoice at $39.05, and it is wrong in the direction that gets a
//   brewery a bill it did not plan for.
//
//   ⚠️ THE SKU IS WHAT YOU ORDER, NOT THE NAME. computeOrder() aggregates by
//   ingredient name and deliberately stops there (a brew sheet distinguishes
//   Midnight Wheat from Carafa Special III). The vendor does not: those are one
//   sack under one SKU, and 30 lbs of each is ONE bag, not two. So lines are
//   merged by SKU here — resolved through skuFor(), never by reading
//   products.js's own list, which knows nothing about an adopted ingredient
//   (see catalogChanges / the curated-map blind spot).
//
// The per-unit price the rest of the app stores (`inventory.cpu`) is exactly
// right for COGS and exactly wrong for an order, so it is converted back UP to
// a pack price here. That round trip carries the cent-rounding applyPrices.js
// documents (a malt stored at $0.71/lb was quoted at $0.724), which is worth
// up to ~$0.28 on a 55 lb sack and ~$0.88 on an 11 lb hop box. This is an
// ESTIMATE and the panel says so; it is not an invoice.
//
// cogs.js's honesty rule carries over unchanged: an ingredient with no price is
// never costed at $0. It is listed, left out of the subtotal, and the subtotal
// is marked a floor.

import { ceilCents } from "./cogs";
import { skuFor } from "./applyPrices";
import { adjUnits } from "./defaults";
import { parseNum } from "./overhead";
import { normalizeUnit, unitsPerPack } from "./pricing";
import { categoryUnit, productsBySku } from "./products";
import { compareNames } from "./sortNames";

// The four categories, in the order Derek's order email lists them. Malts,
// then yeast, then hops, then adjuncts — his sheet, not alphabetical and not
// the Inventory tab's order.
export const ORDER_SECTIONS = [
  { key: "malts", category: "malt", label: "Malts" },
  { key: "yeast", category: "yeast", label: "Yeast" },
  { key: "hops", category: "hop", label: "Hops" },
  { key: "adj", category: "adj", label: "Adjuncts" },
];

// The unit a category's recipe quantities are counted in. Adjuncts carry their
// own per row (honey in pounds, Clarity Ferm in millilitres); the row's unit
// wins over the catalog default, because an adopted adjunct may be counted in
// something defaults.js has never heard of.
export const recipeUnitFor = (category, row) =>
  category === "adj" ? (row?.u || adjUnits[row?.n] || null) : (categoryUnit[category] ?? null);

// --- the pack you actually buy --------------------------------------------

// `orderPack` in products.js is free text describing the real purchasable unit
// ("55 lb", "500 g", "pack of 10", and plain "lb" for honey bought by the
// pound). Read a size off it where there is one.
//
// ⚠️ This is NOT packQty/packUnit. Those describe the pack a PRICE applies to,
// which for every malt and hop on the vendor's list is one pound — the sack and
// the box are what ships. Costing wants the priced pack; ordering wants the
// shipped one, and conflating them orders 55 bags of Munich.
const PACK_TEXT_RE = /^\s*(\d+(?:\.\d+)?)?\s*(lbs?|oz|g|kg|ml|l|gal|each)\b/i;

export function parseOrderPack(text) {
  const m = PACK_TEXT_RE.exec(String(text ?? ""));
  if (!m) return null;
  const qty = m[1] == null ? 1 : Number(m[1]);
  const unit = normalizeUnit(m[2]);
  if (!Number.isFinite(qty) || qty <= 0 || !unit) return null;
  return { qty, unit };
}

// The pack an order line is counted in, for one product.
//
// products.js first, because `orderPack` is the hand-checked answer to exactly
// this question. Then the product's own pack — which is what an ingredient
// adopted from the vendor catalog has, since a parsed catalog row carries the
// priced pack and nothing else. Null when neither reads, and null must stay
// visible: a pack we cannot size cannot be counted or costed, and guessing one
// pound would quietly order a sack as 55 sacks.
export function orderPackFor(product) {
  if (!product) return null;
  const parsed = parseOrderPack(product.orderPack);
  const pack = parsed ?? (Number.isFinite(product.packQty) && product.packUnit
    ? { qty: product.packQty, unit: normalizeUnit(product.packUnit) }
    : null);
  if (!pack?.unit) return null;
  return { ...pack, label: `${pack.qty}${pack.unit}` };
}

// --- one order line -------------------------------------------------------

// Resolve a single inventory row's product, pack and pack price. Everything
// that can fail returns a named reason rather than a zero, because every one of
// them is something the brewer can fix (link the row, adopt the product, import
// a price) and none of them should be discoverable only as a total that came in
// low.
function resolveLine(category, row, cpu, catalog) {
  const sku = skuFor(category, row);
  if (!sku) return { sku: null, reason: "unmapped" };
  const product = productsBySku[sku] ?? catalog?.[sku];
  if (!product) return { sku, reason: "unmapped" };
  const pack = orderPackFor(product);
  if (!pack) return { sku, product, reason: "nopack" };
  const per = unitsPerPack(
    { packQty: pack.qty, packUnit: pack.unit, unitMass: product.unitMass },
    recipeUnitFor(category, row)
  );
  if (per == null || per <= 0) return { sku, product, pack, reason: "unconvertible" };
  // Money rounds UP, as everywhere else in this app: an estimate should never
  // come in under what the order actually costs.
  const packPrice = Number.isFinite(cpu) ? ceilCents(cpu * per) : null;
  return { sku, product, pack, per, packPrice, reason: packPrice == null ? "unpriced" : null };
}

// --- what the vendor adds to the goods ------------------------------------

// The lines BSG puts under the subtotal, in the order the invoice prints them.
// Taken from a real one (Derek, 2026-09-14), which is the only way to know this
// list: a price list carries none of it, and `parsePriceList()` deliberately
// rejects prose that merely mentions money ("Pallet fee: $12.50") so it can
// never be mistaken for a product row.
//
// ⚠️ Every one is a FLAT AMOUNT PER ORDER, not a percentage, and the invoice is
// what settles that. "Fuel surcharge adjustment" is the one that sounds like a
// rate and is not: $5.25 against $1,205.72 of goods is 0.435%, which is not a
// rate anybody publishes — it tracks the freight line, not the order. Modelling
// it as a percentage of the subtotal would have looked right on this invoice
// and drifted on every other one.
//
// ⚠️ And the amounts themselves are NEVER committed — same rule as vendor
// prices, same reason (this repo is public, tests use fabricated numbers). They
// live in `settings.costs` in the private database, entered in the app.
export const ORDER_FEE_FIELDS = [
  ["liftgateFee", "Liftgate", "charged when there's no dock to unload onto"],
  ["palletFee", "Pallet charges", "flat per order on the invoice — say so if yours scales with pallet count"],
  ["fuelSurcharge", "Fuel surcharge", "the invoice's \"fuel surcharge adjustment\" — it tracks freight, not order size"],
  ["freightFee", "Freight", "an average: BSG bills it per shipment, so a small order won't pay this much"],
  ["orderSalesTax", "Sales tax", "the invoice taxes SOME lines only — enter what a typical order is charged"],
];

export const orderFeeLabel = (key) => ORDER_FEE_FIELDS.find(([k]) => k === key)?.[1] || key;
export const orderFeeHint = (key) => ORDER_FEE_FIELDS.find(([k]) => k === key)?.[2] || null;

// The fee lines as entered, plus the ones that aren't.
//
// ⚠️ A BLANK FEE IS UNKNOWN, NOT ZERO — overhead.js's rule, and it matters more
// here than anywhere: on Derek's invoice the fees and tax are $178.90 against
// $1,205.72 of goods, so treating "not entered yet" as "not charged" would quote
// an order 13% under its bill. That is the very failure this whole module exists
// to prevent, arriving by a different door. An explicit **0** is a confirmed
// answer and reads as free; empty is named on screen and makes the total a floor.
export function orderFees(settings) {
  const stored = settings?.costs || {};
  const lines = [];
  const missing = [];
  let total = 0;
  for (const [key, label] of ORDER_FEE_FIELDS) {
    const amount = parseNum(stored[key]);
    if (amount == null) missing.push(key);
    else total = ceilCents(total + amount);
    lines.push({ key, label, amount });
  }
  return { lines, total, missing };
}

// --- the estimate ---------------------------------------------------------

// Build the priced order from computeOrder()'s output.
//
// Inputs:
//   order     — computeOrder() result: {malts, hops, yeast, adj} of {n, order, u}
//   inventory — {malts, hops, yeast, adj} rows, for `cpu` and `sku`
//   catalog   — optional {sku: entry} for products products.js has never heard
//               of, i.e. every adopted ingredient
//   settings  — for `costs`, which carries the vendor's fee lines
//
// Returns one section per category with its merged lines, the goods subtotal,
// the fees under it, the order total, and everything left out of any of them.
export function buildOrderEstimate({ order, inventory = {}, catalog = {}, settings = null } = {}) {
  const sections = [];
  const unpriced = [];
  const nopack = [];
  let subtotal = 0;

  for (const { key, category, label } of ORDER_SECTIONS) {
    const rows = (order?.[key] ?? []).filter((r) => r.order > 0);
    const invRows = inventory[key] ?? [];
    const byId = new Map();

    for (const r of rows) {
      const invRow = invRows.find((i) => i.n === r.n) ?? {};
      const line = resolveLine(category, { ...invRow, n: r.n, u: r.u ?? invRow.u }, invRow.cpu, catalog);
      // Merge on SKU, so two names for one sack become one order line. A row
      // with no product has no SKU to merge on and stays its own line, keyed by
      // name — it is still something that has to be bought.
      const id = line.sku ?? `name:${r.n}`;
      const prev = byId.get(id);
      if (prev) {
        prev.names.push(r.n);
        prev.qty += r.order;
      } else {
        byId.set(id, { ...line, names: [r.n], qty: r.order, unit: recipeUnitFor(category, { ...invRow, n: r.n, u: r.u ?? invRow.u }) });
      }
    }

    const lines = [...byId.values()].map((l) => {
      const names = [...l.names].sort(compareNames);
      const name = names.join(" / ");
      // Packs are counted from the MERGED quantity, not per name: 30 lbs of
      // Midnight Wheat and 30 lbs of Carafa Special III is one 55 lb sack plus
      // a second, never two sacks plus two.
      const packs = l.per ? Math.ceil(l.qty / l.per) : null;
      const cost = packs != null && l.packPrice != null ? ceilCents(l.packPrice * packs) : null;
      if (cost != null) subtotal = ceilCents(subtotal + cost);
      else if (l.reason === "unpriced") unpriced.push(name);
      else nopack.push(name);
      return {
        name, names, sku: l.sku ?? null, qty: l.qty, unit: l.unit,
        pack: l.pack ?? null, packLabel: l.pack?.label ?? null,
        packs, packPrice: l.packPrice ?? null, cost, reason: l.reason ?? null,
      };
    }).sort((a, b) => compareNames(a.name, b.name));

    if (lines.length) sections.push({ key, category, label, lines });
  }

  const fees = orderFees(settings);

  return {
    sections,
    subtotal,
    unpriced,
    nopack,
    fees,
    // The invoice's own shape: goods, then what the vendor adds.
    total: ceilCents(subtotal + fees.total),
    // Anything left out makes the subtotal a floor, and the UI marks it `+`,
    // the same convention cogs.js and analytics.js use.
    floor: unpriced.length > 0 || nopack.length > 0,
    // ⚠️ Kept SEPARATE from `floor`, because the two gaps are fixed in different
    // places and by different people: an unpriced ingredient is an import that
    // hasn't run, an unentered fee is a Settings field nobody has filled. The
    // total is a floor if EITHER is true, but a card that said only "incomplete"
    // would send a brewer to the wrong screen.
    totalFloor: unpriced.length > 0 || nopack.length > 0 || fees.missing.length > 0,
  };
}

// --- the email ------------------------------------------------------------

// The order as plain text, in the shape Derek pastes into an email to BSG:
//
//   Malts
//   1 Pils (55lb)
//   2 Munich (55lb)
//
//   Yeast
//   2 BE-256 (500g)
//
// Pack count, name, pack size. No prices — this is what to send them, not what
// we think it costs. Plain text on purpose: it pastes into any mail client,
// where anything richer needs `text/html` on the clipboard.
//
// A line whose pack could not be read still prints, with its raw quantity
// instead of a pack count. Dropping it would be the one failure mode an order
// list cannot have.
export function orderEmailText(estimate) {
  return (estimate?.sections ?? [])
    .map(({ label, lines }) => [
      label,
      ...lines.map((l) =>
        l.packs != null
          ? `${l.packs} ${l.name} (${l.packLabel})`
          : `${l.name} — ${l.qty} ${l.unit ?? ""}`.trim()
      ),
    ].join("\n"))
    .join("\n\n");
}
