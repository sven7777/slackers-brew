// What a KEG is sold for to an account, against what that barrel costs.
//
// menuPricing.js prices a pint to a customer standing at the bar. This is the
// other channel: a keg invoiced to a bar, who then pours it to their own
// customers. Same question — price, minus what comes off it, against cost — and
// a completely different set of subtractions, which is why it is its own module
// rather than three more rows in `servings`.
//
// ⚠️ A KEG IS NOT A LARGE SERVING SIZE. Putting 1/2 BBL on the board would run
// it through `deductionFactors()`, and every one of those deductions is wrong
// here:
//
//   * SALES TAX does not apply at all. A keg sold to a licensed retailer is a
//     sale for resale; the account collects tax from its customers. The taproom
//     basis question — the single biggest input on the Pricing screen — simply
//     does not arise on this one.
//   * The CARD FEE does not apply. Accounts are invoiced.
//   * POUR LOSS is the taproom's. Line purge, foam and comps happen on our
//     draft lines; a keg leaves the building full and the account eats that
//     foam. This one is a trap in both directions — `pourKeep()` is also what
//     spreads excise per ounce, so a keg priced as a serving carries ~5% more
//     excise than it owes.
//   * EXCISE still applies, and is cleaner here than anywhere else in the app:
//     it is quoted per barrel and a keg IS a fraction of a barrel, so it is a
//     multiplication with no denominator to get wrong.
//
// And two costs exist here that have no taproom equivalent at all: getting the
// keg to the account, and the kegs that never come back.
//
// Slackers SELF-DISTRIBUTES (Derek, 2026-09-11), so there is no distributor
// margin: the invoice price is collected in full. If that ever changes, the
// margin belongs in `kegDeductions()` as a coefficient on price, beside excise.
//
// It keeps the rules the rest of the money code keeps:
//
//   1. An unconfirmed input is not a zero. Delivery and keg shrinkage default
//      null, are named on screen, and left out of the total.
//   2. Costs round UP, revenue rounds DOWN (cogs.js rule 2, menuPricing rule 3).
//   3. ⚠️ An incomplete cost marks a profit as a CEILING, not a floor — the `≤`
//      convention, because a missing cost flatters a margin.
//
// It adds no cost arithmetic of its own: `costStack()` is consumed as published,
// exactly as menuPricing.js consumes it.

import { ceilCents, PINTS_PER_BBL } from "./cogs";
import { costInputs, parseNum, pourKeep } from "./overhead";
import { floorCents, OZ_PER_BBL } from "./menuPricing";

// The wholesale inputs that are costs, in display order, with the label every
// screen prints. Same arrangement as OVERHEAD_FIELDS: Settings collects them and
// the Wholesale view reports them from ONE list, so a line cannot be called one
// thing where it is entered and another where it is totalled.
export const WHOLESALE_FIELDS = [
  ["kegDeliveryPerKeg", "Delivery per keg", "fuel, vehicle and the hour it takes — you self-distribute, so this is yours"],
  ["kegLossPct", "Keg loss %", "share of kegs that never come back, per fill"],
];

export const wholesaleLabel = (key) =>
  WHOLESALE_FIELDS.find(([k]) => k === key)?.[1] || key;

export const wholesaleHint = (key) =>
  WHOLESALE_FIELDS.find(([k]) => k === key)?.[2] || null;

// ── The price list ────────────────────────────────────────────────────────

// Keg sizes as stored, tolerant of the free text they are typed in. A row with
// no usable volume is dropped rather than priced at zero barrels, which would
// divide every per-barrel figure by nothing — the same guard `servingsOf()` has.
export function kegSizesOf(settings) {
  const c = costInputs(settings);
  return (c.kegSizes || [])
    .map((s, i) => ({
      key: s?.key || `keg${i}`,
      label: s?.label || "",
      bbl: parseNum(s?.bbl),
      // Null, never 0: a size with no price is not on the price list yet.
      price: parseNum(s?.price),
      // What the empty keg itself cost. Drives shrinkage, which is why it is
      // per size — a sixtel and a half barrel are not the same asset.
      kegCost: parseNum(s?.kegCost),
    }))
    .filter((s) => s.bbl != null && s.bbl > 0);
}

// The price a given beer goes out at, per size.
//
// ⚠️ The override lives on the RECIPE (`process.kegPrices`), not in settings —
// the same arrangement `pourOz` has, and for the same reason. Derek prices beers
// differently from each other (2026-09-11), and "Beachbomber invoices dearer" is
// a fact about Beachbomber, not an exception list the pricing code has to carry.
// `process` is free-form JSONB (migration 0005), so this needed no migration.
//
// Falls back PER SIZE independently: a beer that is premium only on half barrels
// sets that one field and leaves the other two on the house list.
export function kegPriceFor(recipe, size) {
  const own = parseNum(recipe?.process?.kegPrices?.[size?.key]);
  if (own != null && own > 0) return { price: own, fromRecipe: true };
  return { price: size?.price ?? null, fromRecipe: false };
}

// ── Deductions ────────────────────────────────────────────────────────────

// Which wholesale cost inputs are still unset, so the UI can name them rather
// than print a net that silently omits them. `kegCost` is per size, so it is
// reported only when a size that HAS a price is missing it — an unpriced size
// is not yet a gap.
export function missingWholesaleInputs(settings) {
  const stored = settings?.costs || {};
  const missing = WHOLESALE_FIELDS.map(([k]) => k).filter((k) => parseNum(stored[k]) == null);
  const needsKegCost = kegSizesOf(settings).some((s) => s.price != null && s.kegCost == null);
  if (needsKegCost && parseNum(stored.kegLossPct) !== 0) missing.push("kegCost");
  return missing;
}

// One keg's price broken into what happens to it. `price` may be null (a size
// not on the price list yet), in which case everything derived from it is null
// rather than zero.
//
// Note how much SHORTER this is than `deductions()` next door: no tax basis, no
// gross-versus-net, no coefficient on price at all. Every line here is a flat
// per-keg amount. That is the actual difference between the two channels, and
// it is why one price model could not have served both.
export function kegDeductions({ settings, price, bbl, kegCost = null } = {}) {
  const c = costInputs(settings);
  const p = parseNum(price);
  const barrels = parseNum(bbl);

  // ⚠️ Excise on the FULL barrel fraction. No pour-loss division: the beer in
  // this keg is all sold, and the account's foam is the account's problem.
  const excise = barrels == null ? null : ceilCents((c.exciseStateBbl + c.exciseFedBbl) * barrels);
  const delivery = c.kegDeliveryPerKeg == null ? null : ceilCents(c.kegDeliveryPerKeg);
  // A keg that does not come back is a keg bought again. Needs both halves —
  // what one costs and how often it happens — and is null unless both are known.
  const shrinkage = c.kegLossPct == null || kegCost == null
    ? null
    : ceilCents(kegCost * (c.kegLossPct / 100));

  const known = [excise, delivery, shrinkage].filter((n) => n != null);
  const deducted = known.reduce((s, n) => s + n, 0);
  const complete = excise != null && delivery != null && shrinkage != null;

  if (p == null || p < 0) {
    return { price: null, bbl: barrels, excise, delivery, shrinkage, deducted, net: null, complete };
  }

  return {
    price: p,
    bbl: barrels,
    excise,
    delivery,
    shrinkage,
    deducted: ceilCents(deducted),
    // Revenue floors: rule 2.
    net: floorCents(p - deducted),
    complete,
  };
}

// ── Cost, per barrel rather than per pint ─────────────────────────────────

// ⚠️ THE DENOMINATOR IS PACKAGED BARRELS, NOT SOLD PINTS, and that is not a
// rounding preference — it is the same pour-loss trap as above wearing a
// different coat.
//
// `costStack().perPint` divides the annual cost by pints SOLD, which is correct
// for a pint: the beer lost to foam has to be carried by the beer that wasn't.
// A keg suffers none of that loss, so multiplying a per-pint figure by 248 would
// charge the account's foam to the brewery twice over. These come off
// `stack.annual` divided by `packagedBbl` instead.
//
// Deriving from the annual totals also avoids amplifying a rounded per-pint
// figure by 248, which is worth up to $2.48/bbl on its own.
export function costPerBbl({ settings, stack } = {}) {
  const c = costInputs(settings);
  const packagedBbl = stack?.packagedBbl;
  if (!(packagedBbl > 0)) return { direct: null, overhead: null, absorbed: null, overheadSharePct: c.wholesaleOverheadPct };

  const direct = ceilCents(stack.annual.direct / packagedBbl);
  // The judgement call, made by the brewery rather than by this module.
  const overhead = ceilCents((stack.annual.overhead / packagedBbl) * (c.wholesaleOverheadPct / 100));
  return {
    direct,
    overhead,
    absorbed: ceilCents(direct + overhead),
    overheadSharePct: c.wholesaleOverheadPct,
  };
}

// ── One keg, costed and priced ────────────────────────────────────────────

export function priceKeg({ settings, price, bbl, kegCost = null, directPerBbl = null, absorbedPerBbl = null, complete = true } = {}) {
  const d = kegDeductions({ settings, price, bbl, kegCost });
  const barrels = d.bbl;

  const directCost = directPerBbl == null || barrels == null ? null : ceilCents(directPerBbl * barrels);
  const absorbedCost = absorbedPerBbl == null || barrels == null ? null : ceilCents(absorbedPerBbl * barrels);

  // Built from the already-rounded figures, so the column adds up to the number
  // beside it — cogs.js's rule for line items.
  const sub = (a, b) => (a == null || b == null ? null : Number((a - b).toFixed(2)));
  const contribution = sub(d.net, directCost);
  const profit = sub(d.net, absorbedCost);
  const margin = (n) => (n == null || !(d.net > 0) ? null : (n / d.net) * 100);

  return {
    ...d,
    directCost,
    absorbedCost,
    // What one more keg is worth once the beer is already brewed. ⚠️ On this
    // channel it is the figure that matters, not an afterthought — see
    // `channelCompare()`.
    contribution,
    profit,
    contributionMarginPct: margin(contribution),
    profitMarginPct: margin(profit),
    netPerBbl: d.net == null || !(barrels > 0) ? null : d.net / barrels,
    pricePerBbl: d.price == null || !(barrels > 0) ? null : d.price / barrels,
    // Complete only when the price side AND the cost side are both whole.
    complete: d.complete && complete,
  };
}

// The inverse: the invoice price that leaves `marginPct` of net after `cost`.
//
//   net(P) = P − e − d − s        (flat, no coefficient — see kegDeductions)
//   want   net − cost = m·net
//   so     P = cost/(1 − m) + e + d + s
//
// The algebra is exact and the rounding still is not, for the same reason
// `recommendedPrice()` documents next door: deductions ceil and net floors, so
// the closed form can come back a cent or two short of the margin it solved for.
// Seed, verify forwards, nudge. `basis` selects which cost the price has to
// clear — absorbed by default, direct when the brewery is pricing to keep tanks
// turning rather than to carry the building.
export function recommendedKegPrice({ settings, costPerKeg, bbl, kegCost = null, marginPct = null } = {}) {
  const c = costInputs(settings);
  const cost = parseNum(costPerKeg);
  const barrels = parseNum(bbl);
  const m = (parseNum(marginPct) ?? c.targetMarginPct) / 100;

  if (cost == null || barrels == null || m >= 1) return null;

  const d = kegDeductions({ settings, price: 0, bbl: barrels, kegCost });
  let price = ceilCents(cost / (1 - m) + d.deducted);

  for (let i = 0; i < 12; i++) {
    const { net } = kegDeductions({ settings, price, bbl: barrels, kegCost });
    if (net != null && net * (1 - m) >= cost - 1e-9) return price;
    price = Number((price + 0.01).toFixed(2));
  }
  return price;
}

// A price a brewery would actually invoice. Kegs are quoted in whole dollars,
// not to the quarter like a board price — $137.50 is an arithmetic result,
// $140 is a keg price. Rounds UP so the recommendation still clears.
export function roundToKegPrice(price, step = 5) {
  const p = parseNum(price);
  if (p == null || !(step > 0)) return p;
  return Number((Math.ceil(Number((p / step).toFixed(6))) * step).toFixed(2));
}

// ── The whole price list ──────────────────────────────────────────────────

// Every keg size against one cost basis. `stack` is a `costStack()` result,
// passed in rather than computed, so this view and the two beside it are reading
// one object.
export function kegPriceList({ settings, stack, marginPct = null, recipe = null } = {}) {
  const c = costInputs(settings);
  const target = parseNum(marginPct) ?? c.targetMarginPct;
  const per = costPerBbl({ settings, stack });
  const complete = !!stack?.complete;

  const rows = kegSizesOf(settings).map((s) => {
    // A recipe's own price where there is one, the house price otherwise.
    const { price, fromRecipe } = recipe ? kegPriceFor(recipe, s) : { price: s.price, fromRecipe: false };
    const e = priceKeg({
      settings, price, bbl: s.bbl, kegCost: s.kegCost,
      directPerBbl: per.direct, absorbedPerBbl: per.absorbed, complete,
    });
    const recommended = recommendedKegPrice({
      settings, costPerKeg: e.absorbedCost, bbl: s.bbl, kegCost: s.kegCost, marginPct: target,
    });
    // The price at which the keg exactly pays for itself, overhead included.
    const breakEven = recommendedKegPrice({
      settings, costPerKeg: e.absorbedCost, bbl: s.bbl, kegCost: s.kegCost, marginPct: 0,
    });
    // And the floor below which it is not worth filling at all — direct cost
    // only. ⚠️ On this channel that is the operative number: see below.
    const directFloor = recommendedKegPrice({
      settings, costPerKeg: e.directCost, bbl: s.bbl, kegCost: s.kegCost, marginPct: 0,
    });
    return {
      ...s,
      ...e,
      price,
      priceFromRecipe: fromRecipe,
      recommended,
      listPrice: roundToKegPrice(recommended),
      breakEven,
      directFloor,
      shortfall: price != null && breakEven != null ? Number((price - breakEven).toFixed(2)) : null,
    };
  });

  return { rows, target, perBbl: per, stack, missing: missingWholesaleInputs(settings) };
}

// ── Taproom versus wholesale, on one barrel ───────────────────────────────

// The comparison the channel toggle exists for, and the one no spreadsheet
// gives easily: ONE packaged barrel, either poured at the bar or sold as kegs.
//
// ⚠️ The taproom side is multiplied by `pourKeep()` and the wholesale side is
// not, and that asymmetry is the honest part. A barrel poured at the bar does
// not yield a barrel of paid-for beer — foam, line purge and comps come out of
// it first. A barrel sold as kegs yields exactly itself. Comparing gross
// per-barrel prices without that would overstate the taproom by the loss rate.
//
// The answer is never close, and that is the point. It is not "which channel is
// better" — the taproom wins by roughly 5× on the same barrel and always will.
// It is "wholesale is a contribution business": the question a keg price has to
// answer is whether it clears DIRECT cost and whether the tap handle is worth
// the barrel, not whether it carries its share of the rent. Which is exactly why
// `wholesaleOverheadPct` is a field.
export function channelCompare({ settings, taproomServing = null, kegRow = null } = {}) {
  const keep = pourKeep(settings);
  const taproomNetPerBbl = taproomServing?.netPerOz == null
    ? null
    : floorCents(taproomServing.netPerOz * OZ_PER_BBL * keep);
  const wholesaleNetPerBbl = kegRow?.netPerBbl == null ? null : floorCents(kegRow.netPerBbl);

  const ratio = taproomNetPerBbl != null && wholesaleNetPerBbl > 0
    ? taproomNetPerBbl / wholesaleNetPerBbl
    : null;

  return {
    taproomNetPerBbl,
    wholesaleNetPerBbl,
    // What the taproom gives up by sending the barrel out the door instead.
    difference: taproomNetPerBbl == null || wholesaleNetPerBbl == null
      ? null
      : Number((taproomNetPerBbl - wholesaleNetPerBbl).toFixed(2)),
    ratio,
    pourKeepPct: keep * 100,
    pintsPerBbl: PINTS_PER_BBL,
  };
}

// ── Per beer ──────────────────────────────────────────────────────────────

// The price list, one beer at a time, each costed on ITS OWN ingredients and
// priced at ITS OWN invoice price.
//
// ⚠️ Every beer carries the same labor and overhead per barrel — the same
// simplification `priceBeers()` documents, and for the same reason: allocating
// by tank occupancy would be more accurate and the input for it does not exist.
// What varies here is what the app actually knows: ingredients, yield, and the
// price this particular beer goes out at.
//
// `rows` are `costAllRecipes()` rows and `recs` the stored recipe list, indexed
// by each row's own `index` — the field analytics.js hands back for exactly
// this, since the price lives on the recipe and the costed row is a summary.
export function priceKegBeers({ settings, rows = [], recs = [], stackFor, sizeKey = null, marginPct = null } = {}) {
  const c = costInputs(settings);
  const target = parseNum(marginPct) ?? c.targetMarginPct;
  const sizes = kegSizesOf(settings);
  const size = sizes.find((s) => s.key === sizeKey) || sizes[sizes.length - 1] || null;
  if (!size) return [];

  return rows.map((r) => {
    // Its own ingredient cost per bbl on the shared labor + overhead. Calling
    // the stack per beer rather than adjusting a shared total means this figure
    // and the Overhead view's cannot drift apart by construction.
    const stack = stackFor(r.costPerBbl);
    const per = costPerBbl({ settings, stack });
    const recipe = recs[r.index];
    const { price, fromRecipe } = kegPriceFor(recipe, size);

    const keg = priceKeg({
      settings, price, bbl: size.bbl, kegCost: size.kegCost,
      directPerBbl: per.direct, absorbedPerBbl: per.absorbed,
      complete: r.complete && stack.complete,
    });
    const recommended = recommendedKegPrice({
      settings, costPerKeg: keg.absorbedCost, bbl: size.bbl, kegCost: size.kegCost, marginPct: target,
    });
    const directFloor = recommendedKegPrice({
      settings, costPerKeg: keg.directCost, bbl: size.bbl, kegCost: size.kegCost, marginPct: 0,
    });

    return {
      ...r,
      sizeKey: size.key,
      sizeLabel: size.label,
      bbl: size.bbl,
      price: keg.price,
      priceFromRecipe: fromRecipe,
      directCost: keg.directCost,
      absorbedCost: keg.absorbedCost,
      net: keg.net,
      contribution: keg.contribution,
      profit: keg.profit,
      contributionMarginPct: keg.contributionMarginPct,
      profitMarginPct: keg.profitMarginPct,
      recommended,
      listPrice: roundToKegPrice(recommended),
      directFloor,
      complete: keg.complete,
    };
  });
}
