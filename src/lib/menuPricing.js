// What a beer should be SOLD for, and what is left after it is.
//
// overhead.js answers "what does a pint cost" and stops there. This module is
// the other half: it takes that cost, puts a price beside it, and subtracts
// everything that comes off a price before a single cost is paid — sales tax,
// card processing, excise, and (on a mixed beverage permit) gross receipts.
//
// ⚠️ It is a separate module from overhead.js on purpose. `costStack()` is the
// COST model; this is the PRICE model, and they fail in opposite directions: a
// cost that is too low and a price that is too high are the same mistake made
// from either end. Keeping them apart means the price model consumes the cost
// model's published output and can never quietly adjust it.
//
// ⚠️ It is also NOT `pricing.js`, which is the vendor-pack → recipe-unit
// converter for what the brewery BUYS. That one prices a sack of malt; this one
// prices a pint.
//
// Three rules it inherits, and one of its own:
//
//   1. An unconfirmed input is not a zero (overhead.js). A serving with no board
//      price is a size that isn't sold yet, not a free one: it gets a
//      recommendation and no margin, rather than a margin of −100%.
//   2. Costs round UP to the cent (cogs.js), so a cost never comes in under what
//      it really is.
//   3. NEW, and the mirror of rule 2: money coming IN rounds DOWN. Net revenue
//      and every margin floor to the cent. Between the two, every rounding in
//      this module goes against the brewery — the only direction that can't turn
//      a marginal beer into one that looks like it clears.
//   4. Deductions are linear in the price, which is what makes a recommended
//      price solvable in closed form rather than searched for. `deductionFactors()`
//      is that linearity written down once; `deductions()` and
//      `recommendedPrice()` are the same arithmetic run forwards and backwards,
//      so a price this module recommends and the margin it then reports on that
//      price cannot disagree.

import { PINTS_PER_BBL, ceilCents } from "./cogs";
import { costInputs, costStack, parseNum, pourKeep } from "./overhead";

export const OZ_PER_PINT = 16;
// 31 gal × 8 pints × 16 oz. The unit excise is quoted in is the barrel; the unit
// a customer buys is the ounce, and this is the whole bridge between them.
export const OZ_PER_BBL = PINTS_PER_BBL * OZ_PER_PINT;

// Rule 3. The mirror of cogs.js's `ceilCents`, float-noise guard and all —
// 7.39 lands on 738.9999999 in binary, and a naive floor would report $7.38.
export const floorCents = (n) =>
  Number.isFinite(n) ? Math.floor(Number((n * 100).toFixed(6))) / 100 : null;

const pct = (n) => (Number.isFinite(n) ? n / 100 : 0);

// "a $8.00 pint" is read aloud as "a eight dollar pint". English takes "an"
// before a vowel SOUND, and the prices that start with one are the eights and
// the elevens: $8, $11, $18, $80-89. Scoped to a MENU price deliberately —
// $110 is "one hundred ten" and would want "a", but no brewery pours one, and a
// rule that handled it would be longer than the thing it corrects.
//
// It lives here rather than in either panel because both the Pricing view and
// the Settings preview print a price into a sentence, and two copies of a rule
// this fiddly is two chances for one of them to drift.
export const article = (price) =>
  /^\$?(8|11|18)/.test(String(price ?? "")) ? "an" : "a";

// ── The board ─────────────────────────────────────────────────────────────

// Serving sizes as stored, tolerant of the free-text they are typed in. A row
// with no usable size is dropped rather than priced at zero ounces, which would
// divide every per-ounce figure by nothing.
export function servingsOf(settings) {
  const c = costInputs(settings);
  return (c.servings || [])
    .map((s, i) => ({
      key: s?.key || `serving${i}`,
      label: s?.label || "",
      oz: parseNum(s?.oz),
      // Null, never 0: a size with no price is not on the board yet.
      price: parseNum(s?.price),
    }))
    .filter((s) => s.oz != null && s.oz > 0);
}

// The size a given beer pours at.
//
// ⚠️ The override lives on the RECIPE (`process.pourOz`), not in settings. Red
// Panda pours 8 oz because Red Panda is a 9% tripel — that is a fact about the
// beer, and putting it anywhere else makes it a special case the pricing code
// has to remember. `process` is free-form JSONB (migration 0005) precisely so a
// field like this needs no migration.
export function pourFor(recipe, settings) {
  const c = costInputs(settings);
  const sizes = servingsOf(settings);
  const own = parseNum(recipe?.process?.pourOz);
  if (own != null && own > 0) {
    const match = sizes.find((s) => s.oz === own);
    return { oz: own, label: match?.label || `${own} oz`, serving: match || null, fromRecipe: true };
  }
  const house = sizes.find((s) => s.key === c.defaultServing) || sizes.find((s) => s.oz === OZ_PER_PINT) || sizes[0] || null;
  return {
    oz: house?.oz ?? OZ_PER_PINT,
    label: house?.label || `${OZ_PER_PINT} oz`,
    serving: house,
    fromRecipe: false,
  };
}

// ── Deductions ────────────────────────────────────────────────────────────

// Every deduction as a coefficient on the menu price, plus the one that isn't
// (excise, which is charged per ounce of beer however it is priced).
//
// Two subtleties that are wrong in the obvious version:
//
//   * The tax basis changes what "the price" means. On `included`, an $8.00 pint
//     is $7.39 of beer and $0.61 of the state's money passing through; on
//     `added`, it is $8.00 of beer and the customer is charged $8.66. Getting
//     this backwards moves the answer by more than a pint's whole contribution.
//   * The card fee is charged on the GROSS amount swiped, tax included. The
//     processor does not care which part of the charge the brewery keeps.
export function deductionFactors(settings) {
  const c = costInputs(settings);
  const t = pct(c.salesTaxPct);
  const included = c.taxBasis !== "added";

  // Per $1 of menu price.
  const grossPerPrice = included ? 1 : 1 + t;      // what the card is charged
  const beerPerPrice = included ? 1 / (1 + t) : 1; // what the brewery may keep
  const taxPerPrice = grossPerPrice - beerPerPrice;
  const cardPerPrice = grossPerPrice * pct(c.cardPct);
  // Mixed beverage gross receipts, on the beverage receipts rather than on the
  // tax collected with them. Kept even though Slackers' permit is 'bg' — a
  // permit can change, and the branch costs nothing.
  const grtPerPrice = c.permitType === "mb" ? beerPerPrice * pct(c.mbGrtPct) : 0;

  // ⚠️ Excise is owed on beer PRODUCED, and the beer that foams down a drain
  // was produced. Spreading it over ounces SOLD is the same move the cost stack
  // makes with its denominator, and for the same reason — the sold ounces are
  // the only ones that can carry it.
  const keep = pourKeep(settings);
  const excisePerOz = keep > 0
    ? (c.exciseStateBbl + c.exciseFedBbl) / (OZ_PER_BBL * keep)
    : null;

  return {
    included,
    taxRate: t,
    grossPerPrice,
    beerPerPrice,
    taxPerPrice,
    cardPerPrice,
    grtPerPrice,
    excisePerOz,
    // What one dollar of menu price is actually worth, before excise.
    keepPerPrice: beerPerPrice - cardPerPrice - grtPerPrice,
  };
}

// One serving's price broken into what happens to it. `price` may be null (a
// size not on the board yet), in which case everything derived from it is null
// rather than zero.
export function deductions({ settings, price, oz = OZ_PER_PINT } = {}) {
  const f = deductionFactors(settings);
  const p = parseNum(price);
  const ounces = parseNum(oz) ?? OZ_PER_PINT;

  const excise = f.excisePerOz == null ? null : ceilCents(f.excisePerOz * ounces);

  if (p == null || p < 0) {
    return { price: null, oz: ounces, gross: null, salesTax: null, card: null, grt: null, excise, net: null, factors: f };
  }

  // Deductions ceil, revenue floors: rule 3.
  const gross = ceilCents(p * f.grossPerPrice);
  const salesTax = ceilCents(p * f.taxPerPrice);
  const card = ceilCents(p * f.cardPerPrice);
  const grt = ceilCents(p * f.grtPerPrice);
  const beer = floorCents(p * f.beerPerPrice);
  const net = floorCents(beer - card - grt - (excise || 0));

  return { price: p, oz: ounces, gross, salesTax, card, grt, excise, beer, net, factors: f };
}

// ── One serving, costed and priced ────────────────────────────────────────

// `directPerOz` / `absorbedPerOz` come from `costStack().perPint` divided by 16.
// They are passed in rather than recomputed so this function stays the price
// model and nothing else: there is exactly one place in the app that decides
// what a pint costs, and it is not here.
export function priceServing({ settings, price, oz = OZ_PER_PINT, directPerOz = null, absorbedPerOz = null } = {}) {
  const d = deductions({ settings, price, oz });
  const ounces = d.oz;

  const directCost = directPerOz == null ? null : ceilCents(directPerOz * ounces);
  const absorbedCost = absorbedPerOz == null ? null : ceilCents(absorbedPerOz * ounces);

  // Built from the already-rounded figures, so the column on screen adds up to
  // the number beside it — cogs.js's rule for line items, kept here.
  const sub = (a, b) => (a == null || b == null ? null : Number((a - b).toFixed(2)));
  const contribution = sub(d.net, directCost);
  const profit = sub(d.net, absorbedCost);

  const margin = (n) => (n == null || !(d.net > 0) ? null : (n / d.net) * 100);

  return {
    ...d,
    directCost,
    absorbedCost,
    // What one more pour is worth once it is already brewed.
    contribution,
    // What it is worth once the building is paid for too.
    profit,
    contributionMarginPct: margin(contribution),
    profitMarginPct: margin(profit),
    netPerOz: d.net == null ? null : d.net / ounces,
    pricePerOz: d.price == null ? null : d.price / ounces,
  };
}

// The inverse. Solve for the menu price that leaves `marginPct` of NET revenue
// after `costPerServing`.
//
//   net(P)  = P·k − e            (k = keepPerPrice, e = excise for this size)
//   want    net − cost = m·net
//   so      net = cost / (1 − m)
//   and     P   = (cost / (1 − m) + e) / k
//
// ⚠️ The closed form is the SEED, not the answer, and the difference is a real
// bug that this module's own test caught. The algebra above is exact-arithmetic;
// the forward path rounds AGAINST the brewery at four separate points (tax up,
// card up, excise up, beer down, per rule 3), so the exact solution comes back
// through `priceServing()` about two cents short of the margin it was solved
// for. A recommended price that does not survive its own rounding is not a
// recommendation — so the seed is verified forwards and nudged a cent at a time
// until it actually clears. The loop runs two or three times at most: the whole
// gap is the accumulated rounding, which is bounded by a few cents.
export function recommendedPrice({ settings, costPerServing, oz = OZ_PER_PINT, marginPct = null } = {}) {
  const c = costInputs(settings);
  const f = deductionFactors(settings);
  const cost = parseNum(costPerServing);
  const ounces = parseNum(oz) ?? OZ_PER_PINT;
  const m = pct(parseNum(marginPct) ?? c.targetMarginPct);

  if (cost == null || !(f.keepPerPrice > 0) || m >= 1) return null;

  const excise = (f.excisePerOz || 0) * ounces;
  let price = ceilCents((cost / (1 - m) + excise) / f.keepPerPrice);

  // Clears when what is left of the net after the target margin still covers
  // the cost: net·(1 − m) ≥ cost.
  for (let i = 0; i < 12; i++) {
    const { net } = deductions({ settings, price, oz: ounces });
    if (net != null && net * (1 - m) >= cost - 1e-9) return price;
    price = Number((price + 0.01).toFixed(2));
  }
  return price;
}

// A board price a brewery would actually print. $8.43 is an arithmetic result;
// $8.50 is a price. Rounds UP to the step so the recommendation still clears.
export function roundToBoard(price, step = 0.25) {
  const p = parseNum(price);
  if (p == null || !(step > 0)) return p;
  return Number((Math.ceil(Number((p / step).toFixed(6))) * step).toFixed(2));
}

// ── The whole board ───────────────────────────────────────────────────────

// Every serving size against one cost basis: what it currently makes, and what
// it would have to cost to hit the target margin.
//
// `stack` is a `costStack()` result — passed in, not computed, so the Pricing
// view and the Overhead view beside it are reading the same object.
export function priceBoard({ settings, stack, marginPct = null } = {}) {
  const c = costInputs(settings);
  const target = parseNum(marginPct) ?? c.targetMarginPct;

  const directPerOz = stack?.perPint?.direct == null ? null : stack.perPint.direct / OZ_PER_PINT;
  const absorbedPerOz = stack?.perPint?.absorbed == null ? null : stack.perPint.absorbed / OZ_PER_PINT;

  const rows = servingsOf(settings).map((s) => {
    const e = priceServing({ settings, price: s.price, oz: s.oz, directPerOz, absorbedPerOz });
    const recommended = recommendedPrice({ settings, costPerServing: e.absorbedCost, oz: s.oz, marginPct: target });
    // The price at which the beer exactly pays for itself, overhead included.
    // Below this the pour loses money once the building is counted.
    const breakEven = recommendedPrice({ settings, costPerServing: e.absorbedCost, oz: s.oz, marginPct: 0 });
    return {
      ...s,
      ...e,
      recommended,
      boardPrice: roundToBoard(recommended),
      breakEven,
      // Only meaningful once there is a price to compare against.
      shortfall: e.price != null && breakEven != null ? Number((e.price - breakEven).toFixed(2)) : null,
      // A total that omits an input is a floor — the '+' the rest of the app prints.
      complete: !!stack?.complete,
    };
  });

  return { rows, target, directPerOz, absorbedPerOz, factors: deductionFactors(settings), stack };
}

// ── Per beer ──────────────────────────────────────────────────────────────

// The same board, one beer at a time, each costed on ITS OWN ingredients.
//
// ⚠️ Every beer carries the SAME labor and overhead per pint. Allocating them by
// tank occupancy would be more accurate — a four-week tripel really does hold a
// fermenter twice as long as a two-week Kölsch — and it is deliberately not done
// here, because the input for it does not exist yet. What varies between these
// rows is exactly what the app actually knows: ingredients, yield, and pour size.
//
// `rows` are `costAllRecipes()` rows, so an unpriced recipe arrives already
// marked and is passed through as a floor rather than silently costed short.
// `recs` is the stored recipe list, addressed by each row's own `index` — the
// field analytics.js hands back for exactly this, since the pour size lives on
// the recipe and the costed row is a summary of one.
export function priceBeers({ settings, rows = [], recs = [], marginPct = null } = {}) {
  const c = costInputs(settings);
  const target = parseNum(marginPct) ?? c.targetMarginPct;

  return rows.map((r) => {
    // Its own ingredient cost per bbl, stacked on the shared labor + overhead.
    // Calling costStack() per beer rather than adjusting a shared total means
    // this figure and the Overhead view's cannot drift apart by construction.
    const stack = costStack({ settings, ingredientCostPerBbl: r.costPerBbl });
    const pour = pourFor(recs[r.index], settings);
    const board = priceBoard({ settings, stack, marginPct: target });
    const serving = board.rows.find((s) => s.oz === pour.oz)
      // A recipe may pour a size that is not on the board (an 8 oz beer at a
      // brewery that only lists 12 and 16). Price it anyway, unpriced, rather
      // than drop the beer off the screen.
      || priceServing({ settings, price: null, oz: pour.oz, directPerOz: board.directPerOz, absorbedPerOz: board.absorbedPerOz });

    const recommended = recommendedPrice({ settings, costPerServing: serving.absorbedCost, oz: pour.oz, marginPct: target });

    return {
      ...r,
      pourOz: pour.oz,
      pourLabel: pour.label,
      pourFromRecipe: pour.fromRecipe,
      price: serving.price,
      absorbedCost: serving.absorbedCost,
      directCost: serving.directCost,
      net: serving.net,
      contribution: serving.contribution,
      profit: serving.profit,
      profitMarginPct: serving.profitMarginPct,
      recommended,
      boardPrice: roundToBoard(recommended),
      // The recipe's own figures are a floor when an ingredient is unpriced;
      // the stack adds the overhead view's own gaps on top.
      complete: r.complete && stack.complete,
    };
  });
}

// Sort a priced-beer list. Same shape as analytics.js's `sortRows()` — nulls
// last whichever direction, because "not on the board" is not "cheapest".
export function sortPricedBeers(rows, key, dir = "asc") {
  const sign = dir === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const x = a[key];
    const y = b[key];
    if (typeof x === "string" || typeof y === "string") {
      return sign * String(x ?? "").localeCompare(String(y ?? ""), undefined, { sensitivity: "base", numeric: true });
    }
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    return sign * (x - y);
  });
}
