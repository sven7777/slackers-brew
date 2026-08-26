// What the stock on hand is worth: quantity × the price already stored on each
// inventory row (`cpu`, cost per recipe unit — see applyPrices.js).
//
// Pure, like cogs.js, and it keeps that module's two rules for exactly the same
// reason:
//
//   1. An unpriced row is NEVER valued at $0. Its value is null, it's left out
//      of the total, and it's counted in `unpriced` so the tab can say how much
//      of the shelf the number covers. A confidently wrong inventory value is
//      worse than an obviously incomplete one.
//
//   2. Money rounds UP to the cent (`ceilCents`), and rows are rounded before
//      they're summed, so the column on screen adds up to the total on screen.
//
// Note the asymmetry with COGS: a batch cost rounds up because a cost should
// never come in under the truth. Here the rounding is a rounding, not a
// judgement — but it's the same arithmetic in the same app, so it stays the
// same function rather than becoming a second convention to remember.

import { ceilCents } from "./cogs";

// One row's value, or null when it has no price. A missing or blank quantity is
// an empty shelf, not an unknown one — it values at $0 and the row still counts
// as priced. Only a quantity that isn't a number at all (a stale hand-edit) is
// unvalued, since guessing at it would be inventing stock.
export function rowValue(item) {
  const cpu = item?.cpu;
  if (!Number.isFinite(cpu)) return null;
  const raw = item?.q;
  const q = raw === "" || raw == null ? 0 : Number(raw);
  if (!Number.isFinite(q)) return null;
  return ceilCents(q * cpu);
}

// One category: the rounded rows summed, plus how many rows carry a price at
// all. `unpriced` is the honest part — it's what stops `total` from reading as
// the value of everything on the shelf when it's the value of half of it.
export function categoryValue(items = []) {
  let total = 0;
  let priced = 0;
  let unpriced = 0;
  for (const it of items) {
    const v = rowValue(it);
    if (v == null) { unpriced += 1; continue; }
    priced += 1;
    total = ceilCents(total + v);
  }
  return { total, priced, unpriced };
}

// All four categories, with each one's subtotal kept alongside the grand total
// so the tab can label a card and the banner from one call.
export function inventoryValue({ malts = [], hops = [], yeast = [], adj = [] } = {}) {
  const byCategory = {
    malt: categoryValue(malts),
    hop: categoryValue(hops),
    yeast: categoryValue(yeast),
    adj: categoryValue(adj),
  };
  let total = 0;
  let priced = 0;
  let unpriced = 0;
  for (const c of Object.values(byCategory)) {
    total = ceilCents(total + c.total);
    priced += c.priced;
    unpriced += c.unpriced;
  }
  return { byCategory, total, priced, unpriced };
}

// Oldest price behind a set of figures. A year-old number should look like one,
// so both the Inventory tab and the Cost panel print this date beside their
// totals. Dates are ISO (`YYYY-MM-DD`) from the vendor list's effective date,
// so a string sort is a date sort; rows priced by hand carry none and are
// ignored rather than counted as priced today.
export function priceAsOf({ malts = [], hops = [], yeast = [], adj = [] } = {}) {
  return [...malts, ...hops, ...yeast, ...adj]
    .filter((i) => Number.isFinite(i?.cpu) && i?.pricedAt)
    .map((i) => i.pricedAt)
    .sort()[0] || null;
}
