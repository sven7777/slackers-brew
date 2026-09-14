// What a pint costs BEYOND its ingredients: production labor, packaging, and
// the allocated overhead of running a taproom — rent, utilities, insurance,
// front-of-house payroll.
//
// cogs.js deliberately stopped at ingredients, and said so on screen in three
// places. That was the right scope for costing a recipe and the wrong scope for
// pricing a beer: ingredients are about 6% of a $8.00 pint, so a price set off
// them alone is set off a rounding error. This module is the layer above.
//
// It keeps cogs.js's rules, because they are the reason those numbers are
// trustworthy:
//
//   1. An UNCONFIRMED input is never treated as zero. A brewery whose rent has
//      not been entered does not have free rent, so the figure goes to
//      `missing`, is left out of the total, and the UI says which inputs are
//      absent. An absorbed cost computed with rent = 0 is a confidently wrong
//      number of exactly the kind cogs.js exists to avoid.
//   2. Money rounds UP to the cent (`ceilCents`), for the same reason: costing
//      should never come in under what things actually cost.
//
// ⚠️ `defCosts` below is the schema for everything under `settings.costs`, and
// that now includes the PRICE side — serving sizes, the board price on each, the
// tax basis. Those are consumed by menuPricing.js, not here, and they live in
// this object anyway for the reason the next paragraph gives: one nested object
// is one entry in `SETTINGS_PREFS` forever. Splitting the price inputs into a
// second settings key to keep this module tidy would buy tidiness with exactly
// the failure mode that has already cost this app two silent data losses.
//
// ⚠️ Every cost input lives under ONE key, `settings.costs`. That is deliberate.
// A settings field can fall through two gaps — the default-merge on read and
// `SETTINGS_PREFS` in supabaseBackend.js on write — and it has, twice, silently
// (see the batch-volume incident behind PR #65/#75). One nested object means one
// entry in that list forever: adding a cost input later needs no backend change
// and cannot repeat that failure. `costInputs()` below is the single resolver,
// the same shape `batchVolume()` has in cogs.js, so no caller ever reads a raw
// field and invents its own fallback.

import { ceilCents, GAL_PER_BBL, GAL_PER_KEG, PINTS_PER_BBL, parseVolume, parseKegs } from "./cogs";
import { defSettings } from "./defaults";

const WEEKS_PER_YEAR = 52;
const MONTHS_PER_YEAR = 12;

// Employer-side FICA. The ONLY employer cost arising from tips: the tip income
// itself is the customer's money passing through, and putting it in COGS would
// invent an expense the brewery never pays.
export const FICA_PCT = 7.65;

// The monthly overhead lines, in display order, with the label every screen
// prints for each and — where the name alone is not enough — what the line
// means. Settings collects them and the Overhead view reports them, and both
// read this one list: a line named "Austin Energy" where it is entered and
// "electric" where it is totalled is the same drift the single `costs` object
// exists to prevent, and a line that means one thing on one screen and another
// on the next is that same failure wearing a different coat.
//
// ⚠️ `fohPayroll` is the ONLY input here whose meaning is not obvious from its
// name, and the gap has already cost real money. Derek's first figure included
// the brewer and cellar hours — which `annualLabor()` charges separately as
// production labor — so the stack billed them twice, ~$2,000/mo, and the model
// read a pint as costing $7.94 when it cost $7.15. He caught it; the app did
// not. Hence the hint, and hence the hint living HERE rather than in the
// Settings markup, so the Overhead view's own row carries it too.
export const OVERHEAD_FIELDS = [
  ["rent", "Rent + NNN"],
  ["electric", "Austin Energy"],
  ["water", "Austin Water"],
  ["insurance", "Insurance"],
  ["fohPayroll", "FOH payroll (burdened)", "front of house ONLY — brewer and cellar hours are charged separately as production labor"],
  ["otherFixed", "Other fixed"],
];

// Inputs the brewery has not confirmed yet. They default to null rather than to
// a plausible-looking number, so an unset rent reads as "we don't know" instead
// of quietly costing the beer as if the building were free.
const UNCONFIRMED = OVERHEAD_FIELDS.map(([k]) => k);

export const overheadLabel = (key) =>
  OVERHEAD_FIELDS.find(([k]) => k === key)?.[1] || key;

// What the line means, for the one line whose name does not say. Null for the
// rest, so a caller renders a hint only where there is one to render.
export const overheadHint = (key) =>
  OVERHEAD_FIELDS.find(([k]) => k === key)?.[2] || null;

// Defaults. Confirmed figures are Slackers' real numbers (Derek, 2026-08-28);
// anything in UNCONFIRMED above ships null and must be entered.
//
// ⚠️ Vessel volumes are ACTUAL WORKING VOLUME, never the nameplate rating the
// vessel was sold as. Slackers' brewhouse is sold as a 3.5 BBL and its
// fermenters as 3.5 and 7 BBL, but they are filled to real headroom: the boil
// is 150 gal (4.84 BBL) and a "3.5 BBL" fermenter takes 125 gal (4.03 BBL).
// Deriving anything from "3.5" understates the brewery by a third. The
// nameplate is kept only as a label, so the tanks are recognisable on screen.
export const defCosts = {
  // ── Production ──
  batchesPerYear: 40,
  // Gallons knocked out of the kettle INTO a fermenter, on average. This is a
  // third volume, distinct from the 150 gal boil and the 100.75 gal packaged,
  // and capacity math needs it specifically: a tank holds beer that has already
  // paid the kettle loss, so costing tank volume at the kettle→packaged ratio
  // charges that loss twice and understates the brewery by ~17%.
  intoFermenterGal: 125,

  // ── Vessels (capacity work; see the warning above) ──
  fermenters: [
    { label: "3.5 BBL #1", gal: 125 },
    { label: "3.5 BBL #2", gal: 125 },
    { label: "3.5 BBL #3", gal: 125 },
    // Takes a double batch — two brews knocked out into one tank.
    { label: "7 BBL", gal: 250 },
  ],
  turnWeeks: 3, // average fermenter turn: 2 wk ales, 3 wk IPA/stout, 4 wk tripel

  // ── Losses AFTER packaging: the step cogs.js does not model. ──
  // Packaged beer is not sold beer. These make the denominator pints SOLD.
  linePct: 3,  // draft line + foam
  compsPct: 2, // comps, staff pours, tasters

  // Gallons sold to OUTSIDE ACCOUNTS in a year. The taproom share is the
  // remainder, and the split is derived rather than entered as a percentage —
  // the `avgKegs` principle: ask for the measurement, back-solve the ratio.
  //
  // ⚠️ It asks for the WHOLESALE side, not the taproom side, because that is the
  // number a brewery knows exactly: it is invoiced, keg by keg, and sits on the
  // books. Taproom volume is a POS report about pours. Slackers is ~1,000 gal to
  // accounts (Derek, 2026-09-11) — about 64 half barrels a year across five
  // accounts, or one a month each. ⚠️ The first version of this field asked for
  // the taproom figure and I read his 1,000 gal as that, which inverted the
  // whole split and made 40 batches/yr look impossible; ask for the side the
  // brewery invoices.
  //
  // It exists because POUR LOSS IS THE TAPROOM'S ALONE. Line purge, foam and
  // comps happen on our own draft lines; a keg leaves the building full and the
  // account eats that loss. Applying `pourKeep()` to all packaged beer — which
  // is what happened before this field — charges the taproom's foam to beer that
  // never touched a tap, and shrinks the denominator every fixed cost is spread
  // over. Null means "assume it all goes through the taps", the old behaviour,
  // so an unset value changes nothing.
  wholesaleGalPerYear: null,

  // ── Production labor (direct) ──
  brewerRate: 12.0,
  brewerHrsWeek: 20, // stated 18–22
  cellarRate: 8.5,
  cellarHrsWeek: 11, // stated 10–12
  burdenPct: 12,     // FUTA/SUTA/workers comp on base wages
  // Brewery staff share the tip pool at $8–10/hr on top of base. This is NOT an
  // employer cost and is NOT in COGS — only the employer FICA on it is.
  tipShareRate: 9.0,

  // ── Monthly overhead (allocated) ──
  rent: null,
  electric: null,
  water: null,
  insurance: null,
  otherFixed: null,
  fohPayroll: null,

  // ── What the vendor adds to an ingredient order ──
  //
  // ⚠️ Blank on purpose, and blank means UNKNOWN, not free. These are real
  // amounts off a real BSG invoice and must never be committed (public repo,
  // same rule as vendor prices) — they are entered in Settings ▸ Order Fees and
  // live only in the private database. See ORDER_FEE_FIELDS in orderCost.js for
  // why each is a flat per-order amount rather than a rate.
  liftgateFee: null,
  palletFee: null,
  fuelSurcharge: null,
  freightFee: null,
  orderSalesTax: null,

  // ── Deductions from retail price ──
  cardPct: 3.0,
  exciseStateBbl: 6.0,
  exciseFedBbl: 3.5,
  // 'bg' = wine & beer retailer / on-premise: sales tax only.
  // 'mb' = mixed beverage: the brewery ALSO owes 6.7% gross receipts.
  permitType: "bg",
  mbGrtPct: 6.7,
  salesTaxPct: 8.25,

  // ⚠️ Does the price on the board already have sales tax in it, or is tax
  // added at the register? On an $8.00 pint at 8.25% the answer is worth $0.61
  // — which is most of a pint's entire contribution, so it cannot be left
  // implicit in the arithmetic the way it was in the old preview string. It is
  // a two-option question with no honest default, so it is asked outright.
  //   'included' — the customer pays $8.00 and the brewery keeps $7.39.
  //   'added'    — the customer pays $8.66 and the brewery keeps $8.00.
  // ✅ CONFIRMED 'added' (Derek, 2026-09-03): the board says $8 and Toast adds
  // tax at the register. Like the 150 gal / 33% volume defaults, this default is
  // Slackers' actual answer rather than a generic one. #98 shipped it as
  // 'included' on the guess that round board prices usually are, which cost the
  // brewery $0.61 a pint on paper and made an $8.00 pint read as a five-cent
  // LOSS against its $7.15 absorbed cost; on the confirmed basis it clears
  // $0.54. The Pricing view prints which basis it is using above every figure
  // that depends on it, which is how the wrong guess was visible enough to fix.
  taxBasis: "added",

  // ── The board ──
  // What a beer is actually sold as. Sizes are brewery-wide; WHICH size a given
  // beer pours at is a property of that beer (`recipe.process.pourOz`), because
  // Red Panda pouring 8 oz is a fact about Red Panda and not a special case in
  // the pricing code.
  //
  // A `price` of null means "not on the board yet" — an unsold size, not a free
  // one. It is reported as unpriced and gets a recommendation rather than a
  // margin, the same way an unconfirmed rent is named instead of zeroed.
  servings: [
    { key: "half", label: "Half pour", oz: 8, price: 8.0 },
    { key: "short", label: "12 oz", oz: 12, price: 7.0 },
    { key: "pint", label: "16 oz pint", oz: 16, price: 8.0 },
    { key: "crowler", label: "32 oz crowler", oz: 32, price: null },
    { key: "growler", label: "64 oz growler", oz: 64, price: null },
  ],
  // The size a beer pours at unless its own recipe says otherwise.
  defaultServing: "pint",

  // ── Wholesale: kegs sold to accounts ──
  //
  // ⚠️ A keg is NOT a large serving size, which is why these live in their own
  // list rather than in `servings` above. Four things differ, and all four are
  // in the taproom arithmetic that `servings` feeds:
  //
  //   * Sales tax does not apply. A keg to a licensed account is a sale for
  //     RESALE — the bar collects tax from its own customers. Running a $180
  //     keg through `deductionFactors()` would print $14.85 of tax nobody owes.
  //   * Neither does the card fee. Accounts pay on invoice, not a swipe.
  //   * `pourKeep()` is the TAPROOM's loss. Line purge and comps happen on our
  //     draft lines; a keg leaves the building full and the account eats that
  //     foam. Since pourKeep is what spreads excise per ounce, a keg priced as a
  //     serving would carry ~5% more excise than it actually owes.
  //   * `pourFor()` reads `servings` as candidate POUR sizes — a beer could end
  //     up "pouring" a half barrel.
  //
  // Slackers self-distributes (Derek, 2026-09-11), so there is no distributor
  // margin line: the price entered here is the price the account is invoiced
  // and the brewery collects all of it.
  //
  // `price` is the HOUSE price list — what a beer sells for unless that beer
  // says otherwise. A beer's own price lives on `recipe.process.kegPrices`,
  // the same way its pour size lives on `process.pourOz`: Beachbomber going out
  // dearer than the Kölsch is a fact about Beachbomber, not an exception list
  // inside the pricing code.
  //
  // `bbl` is exact, not a rounded gallon figure — it is the denominator of every
  // per-barrel number on the screen.
  // ✅ The 1/2 BBL price is Slackers' real base-tier price (Derek, 2026-09-11:
  // $160 for the lightest beers, $220-250 for IPAs and specialty), the same way
  // the 150 gal / 33% volume figures and `taxBasis: "added"` are his real
  // numbers rather than generic ones. The house list is the BASE tier; the
  // dearer beers carry their own price on their own row.
  //
  // The sixtel and quarter stay null because he sells mostly half barrels and
  // has not quoted them — an unpriced size is one not on the list yet, and
  // guessing one would be inventing a price the brewery never set.
  kegSizes: [
    { key: "sixtel", label: "1/6 BBL", bbl: 1 / 6, price: null, kegCost: null },
    { key: "quarter", label: "1/4 BBL", bbl: 1 / 4, price: null, kegCost: null },
    { key: "halfbbl", label: "1/2 BBL", bbl: 1 / 2, price: 160, kegCost: null },
  ],
  // What it costs to get one keg to an account. Null until confirmed: a
  // brewery that has not entered it does not deliver for free, so it is named
  // and left out rather than silently zeroed.
  kegDeliveryPerKeg: null,
  // Share of kegs that never come back, per fill. With `kegCost` above this is
  // the shrinkage charged against each keg sold — a real cost of the channel
  // that has no taproom equivalent at all.
  kegLossPct: null,
  // A deposit is the account's money held against the keg's return. It is a
  // LIABILITY, not revenue, and is excluded from every margin on the screen; it
  // is stored only so the printed price list can carry it.
  kegDepositPerKeg: null,
  // How much of the taproom's overhead a wholesale barrel should absorb.
  //
  // ⚠️ Defaults to 100 — charging wholesale its full share — because the
  // conservative allocation is the one that cannot flatter. Whether rent on a
  // taproom belongs on a keg going out the door is a real judgement and it is
  // the brewery's to make, so it is a field rather than an assumption. At 0 the
  // absorbed figure collapses onto the direct one and the screen says so.
  wholesaleOverheadPct: 100,

  // Gross margin to solve a suggested keg price for, on NET revenue against
  // DIRECT cost.
  //
  // ⚠️ A DIFFERENT BASIS from `targetMarginPct` above, which the taproom board
  // solves against ABSORBED cost — do not read the two numbers as comparable.
  // The basis here is the one the industry benchmark is quoted on: craft
  // breweries run roughly 40–60% gross margin on draft/keg against COGS, versus
  // ~75% on taproom, and COGS in that figure is ingredients plus direct
  // production labor. Absorbed would be meaningless here, since no keg price
  // clears it.
  //
  // ⚠️ 45 is the LOW end of that band on purpose, and it is still optimistic at
  // Slackers' scale. The 40–60% benchmark comes from breweries with enough
  // volume to spread production labor thin; on a 3.5 BBL brewhouse at ~40
  // batches a year, labor alone is over $150/bbl and direct cost lands near
  // $270/bbl where a regional brewery's is under $110. Solving for 50% against
  // that produces a price no account in Texas would pay. The suggested-price
  // column is therefore printed BESIDE the account ceiling rather than on its
  // own, and the panel says outright when the two have crossed.
  wholesaleTargetMarginPct: 45,

  // ── What the ACCOUNT sees ──
  //
  // The real ceiling on a keg price is not the brewery's cost at all — it is
  // whether the bar can retail the beer and still hit its own pour cost. These
  // four inputs are the bar's side of the deal, and they are the only reason
  // the app can say a price is too HIGH rather than only too low.
  //
  // Defaults are the published craft-bar norms: a ~20% keg yield loss at the
  // account (foam, line purge, the cloudy first pours, buybacks — larger than a
  // brewery's own pour loss because it includes tapping and cleaning waste), a
  // 20–26% target pour cost for a craft bar, and a $7.00 Texas craft pint.
  //
  // ⚠️ `accountPourOz` is the BREWERY-WIDE default only. Which size a given beer
  // is poured at by an account is a property of THAT BEER — Derek's high-ABV
  // IPAs and specialty beers go into smaller glasses (2026-09-11) — and it lives
  // on `recipe.process.accountPourOz`, exactly as the taproom's `pourOz` does.
  // It is load-bearing, not a detail: a $250 half barrel poured at 16 oz puts an
  // account at ~32% pour cost, which no bar accepts, and at 12 oz it is ~24%,
  // which is fine. Without the per-beer override the app would flag every
  // specialty keg as priced above the ceiling when it is not. It is also most of
  // why a published list like Reformation's can charge $225 for its 12 oz series
  // against $175 for its 16 oz one.
  accountRetailPint: 7.0,
  accountPourOz: 16,
  accountLossPct: 20,
  accountPourCostPct: 25,
  // Target margin on NET revenue, absorbed basis — what the recommended price
  // is solved for.
  targetMarginPct: 20,
};

// Tolerant number parse, because these are free-text fields like the yield ones
// ("$1,200", "1200", " 1200 "). Null — never 0, never a guess — when there is
// no usable number, so an empty field means "unconfirmed" and not "free".
export function parseNum(text) {
  if (typeof text === "number") return Number.isFinite(text) ? text : null;
  if (typeof text !== "string") return null;
  const m = text.replace(/,/g, "").match(/-?\d*\.?\d+/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? n : null;
}

// The one resolver. Every read of a cost input goes through here, so a field
// cannot pick up a different fallback in two places — the failure that made
// Settings and the Cost panel disagree by a third of the cost per barrel.
export function costInputs(settings) {
  const stored = settings?.costs || {};
  const out = {};
  for (const [k, v] of Object.entries(defCosts)) {
    if (Array.isArray(v)) {
      out[k] = Array.isArray(stored[k]) && stored[k].length ? stored[k] : v;
      continue;
    }
    if (typeof v === "string") {
      out[k] = stored[k] || v;
      continue;
    }
    const parsed = parseNum(stored[k]);
    // An explicit 0 is honored (0% card fee is a real answer); empty falls back.
    out[k] = parsed != null ? parsed : v;
  }
  return out;
}

// Which unconfirmed inputs are still unset, so the UI can name them rather than
// print a total that silently omits them.
export function missingInputs(settings) {
  const stored = settings?.costs || {};
  return UNCONFIRMED.filter((k) => parseNum(stored[k]) == null);
}

// The share of packaged beer that actually gets sold — what survives line loss
// and foam, then comps and staff pours.
//
// Losses compound in sequence, each on what survived the last: they are
// successive events, not two slices of the original volume.
//
// It is one exported function because THREE things divide by pints sold — the
// annual volume, the cost stack, and (through menuPricing.js) the excise a
// serving has to carry. A brewery that pours 5% of its beer down a drain pays
// excise on that beer too, so a second copy of this expression that drifted by
// a point would quietly move every price on the board.
export function pourKeep(settings) {
  const c = costInputs(settings);
  return (1 - c.linePct / 100) * (1 - c.compsPct / 100);
}

// ── Volume ────────────────────────────────────────────────────────────────

// A year of production, from the kettle all the way to pints actually sold.
//
// Three denominators, and using the wrong one is the classic way to understate
// a per-pint cost: beer BREWED, beer PACKAGED, and beer SOLD. Cost per pint has
// to divide by the last one — foam, line purge and comps are beer you paid to
// make and were never paid for.
export function annualVolume({ settings } = {}) {
  const c = costInputs(settings);
  const kettleGal = parseVolume(settings?.postBoilYield) ?? parseVolume(defSettings.postBoilYield);
  const kegs = parseKegs(settings?.avgKegs);
  // Same basis the rest of the app uses: kegs per batch when measured, else the
  // stored loss %. Kept consistent with batchVolume() rather than re-derived.
  const packagedGalPerBatch = kegs != null
    ? kegs * GAL_PER_KEG
    : kettleGal * (1 - (Number.isFinite(settings?.lossPct) ? settings.lossPct : defSettings.lossPct) / 100);

  const batches = c.batchesPerYear;
  const brewedGal = kettleGal * batches;
  const packagedGal = packagedGalPerBatch * batches;
  const packagedBbl = packagedGal / GAL_PER_BBL;
  const pintsPackaged = packagedBbl * PINTS_PER_BBL;

  const keep = pourKeep(settings);

  // ⚠️ THE DENOMINATOR IS SPLIT BY CHANNEL. Retail gallons suffer pour loss;
  // wholesale gallons do not. `channelKeep` is the blended survival rate over
  // ALL packaged beer, and it is what every fixed cost is spread over.
  //
  // A retail figure larger than everything packaged is a typo, not a channel
  // mix — rejected back to all-retail with a flag, the same way `batchVolume()`
  // rejects a yield larger than the boil. Costing must never divide by beer the
  // brewery did not make.
  const wholesaleGal = c.wholesaleGalPerYear;
  const wholesaleOverflow = wholesaleGal != null && packagedGal > 0 && wholesaleGal > packagedGal;
  const splitKnown = wholesaleGal != null && packagedGal > 0 && !wholesaleOverflow;
  const retailGal = splitKnown ? packagedGal - wholesaleGal : null;
  const channelKeep = splitKnown
    ? (retailGal * keep + wholesaleGal) / packagedGal
    : keep;

  const pintsSold = pintsPackaged * channelKeep;

  return {
    batches,
    kettleGal,
    intoFermenterGal: c.intoFermenterGal,
    // The loss splits in two, and they are different problems: wort left behind
    // in the kettle (trub, whirlpool, deadspace) versus beer lost in the cellar
    // (yeast, dry-hop absorption, transfer).
    kettleLossPct: kettleGal > 0 ? (1 - c.intoFermenterGal / kettleGal) * 100 : null,
    cellarLossPct: c.intoFermenterGal > 0 ? (1 - packagedGalPerBatch / c.intoFermenterGal) * 100 : null,
    packagedGalPerBatch,
    brewedGal,
    packagedGal,
    packagedBbl,
    pintsPackaged,
    pintsSold,
    soldBbl: pintsSold / PINTS_PER_BBL,
    lossToPourPct: (1 - keep) * 100,
    // The channel split, for the panels that print it.
    retailGal,
    wholesaleGal: splitKnown ? wholesaleGal : null,
    retailSharePct: splitKnown ? (retailGal / packagedGal) * 100 : null,
    wholesaleSharePct: splitKnown ? (wholesaleGal / packagedGal) * 100 : null,
    // Blended over both channels; equals pourKeep when the split is unknown.
    channelKeep,
    // The wholesale figure exceeds everything packaged — reported so the panel
    // can say so rather than silently ignoring the input.
    wholesaleOverflow,
  };
}

// Theoretical annual capacity, in packaged bbl, from the tanks and their turn
// time. This is the number that makes underutilization visible: a fixed cost
// spread over 130 bbl is a very different cost per pint than the same cost
// spread over the 280 the tanks could carry.
//
// The fermenters are the constraint, not the brewhouse — 87 brews a year is
// under two a week.
export function annualCapacity({ settings } = {}) {
  const c = costInputs(settings);
  const v = annualVolume({ settings });
  const turns = c.turnWeeks > 0 ? WEEKS_PER_YEAR / c.turnWeeks : 0;

  // ⚠️ The ratio here is fermenter→packaged, NOT kettle→packaged. What sits in
  // a tank has already paid the kettle loss; charging it the full 33% again
  // would price 625 gal of tank as though it were 625 gal of wort still in the
  // kettle, and reads a 282 bbl brewery as a 235 bbl one.
  const tankGal = c.fermenters.reduce((s, f) => s + (parseNum(f?.gal) || 0), 0);
  const yieldRatio = v.intoFermenterGal > 0 ? v.packagedGalPerBatch / v.intoFermenterGal : 0;

  const packagedGalPerTurn = tankGal * yieldRatio;
  const capacityBbl = (packagedGalPerTurn * turns) / GAL_PER_BBL;

  return {
    tankGal,
    turns,
    capacityBbl,
    // A 250 gal tank holding a double batch counts as two brews, which falls
    // out of dividing by the per-batch fermenter volume rather than by tanks.
    capacityBatches: v.intoFermenterGal > 0 ? (tankGal / v.intoFermenterGal) * turns : 0,
    utilizationPct: capacityBbl > 0 ? (v.packagedBbl / capacityBbl) * 100 : null,
  };
}

// ── Costs ─────────────────────────────────────────────────────────────────

// Production labor for a year. Weekly hours, not per-batch: the brewer works
// roughly the same week whether it holds one brew or two, which is exactly why
// spreading that cost over more batches is where the money is.
//
// Tips are the customer's money and never enter COGS. The employer's only cost
// from them is FICA on the shared amount, returned as its own line so it can be
// seen and argued with rather than buried in a wage total.
export function annualLabor({ settings } = {}) {
  const c = costInputs(settings);
  const brewerBase = c.brewerRate * c.brewerHrsWeek * WEEKS_PER_YEAR;
  const cellarBase = c.cellarRate * c.cellarHrsWeek * WEEKS_PER_YEAR;
  const base = brewerBase + cellarBase;
  const burden = base * (c.burdenPct / 100);

  const tipHours = (c.brewerHrsWeek + c.cellarHrsWeek) * WEEKS_PER_YEAR;
  const tipFica = c.tipShareRate * tipHours * (FICA_PCT / 100);

  return {
    brewerBase: ceilCents(brewerBase),
    cellarBase: ceilCents(cellarBase),
    base: ceilCents(base),
    burden: ceilCents(burden),
    tipFica: ceilCents(tipFica),
    total: ceilCents(base + burden + tipFica),
  };
}

// Allocated overhead for a year: the costs of being open, which do not care how
// much beer got brewed. Anything not yet entered is reported, never zeroed.
export function annualOverhead({ settings } = {}) {
  const c = costInputs(settings);
  const missing = missingInputs(settings);
  const lines = UNCONFIRMED.map((k) => ({
    key: k,
    monthly: c[k],
    annual: c[k] == null ? null : ceilCents(c[k] * MONTHS_PER_YEAR),
    known: c[k] != null,
  }));
  const total = ceilCents(lines.reduce((s, l) => s + (l.annual || 0), 0));
  return { lines, total, missing, complete: missing.length === 0 };
}

// The whole stack, per pint sold.
//
//   ingredientCostPerBbl — from the recipes themselves (Analytics computes it
//     off real vendor prices). Null when nothing is priced, in which case
//     ingredients join `missing` rather than counting as zero.
//   volumeBbl — override the modelled annual volume, which is how the capacity
//     curve re-runs the same arithmetic at 100…300 bbl.
//
// Returns DIRECT (ingredients + production labor) separately from ABSORBED
// (direct + overhead), because they answer different questions: direct margin
// says whether one more pint is worth pouring, absorbed says whether the
// business works at this volume.
export function costStack({ settings, ingredientCostPerBbl = null, volumeBbl = null } = {}) {
  const v = annualVolume({ settings });

  // Scale to an arbitrary volume for the capacity curve, keeping the same pour
  // losses so pints SOLD stays the denominator at every point on it.
  const packagedBbl = volumeBbl != null ? volumeBbl : v.packagedBbl;
  // ⚠️ `channelKeep`, not `pourKeep` — wholesale barrels suffer no pour loss.
  // Held constant when `volumeBbl` overrides the modelled volume, so the
  // capacity curve scales at today's channel mix rather than silently becoming
  // all-taproom at 300 bbl.
  const pintsSold = packagedBbl * PINTS_PER_BBL * v.channelKeep;

  const labor = annualLabor({ settings });
  const overhead = annualOverhead({ settings });

  const ingredients = ingredientCostPerBbl != null ? ceilCents(ingredientCostPerBbl * packagedBbl) : null;

  const missing = [...overhead.missing];
  if (ingredients == null) missing.push("ingredients");

  const direct = ceilCents((ingredients || 0) + labor.total);
  const absorbed = ceilCents(direct + overhead.total);

  const per = (n) => (n == null || !(pintsSold > 0) ? null : ceilCents(n / pintsSold));

  return {
    pintsSold,
    packagedBbl,
    annual: {
      ingredients,
      labor: labor.total,
      overhead: overhead.total,
      direct,
      absorbed,
    },
    perPint: {
      ingredients: per(ingredients),
      labor: per(labor.total),
      overhead: per(overhead.total),
      direct: per(direct),
      absorbed: per(absorbed),
    },
    labor,
    overhead,
    missing,
    // A total that omits an input is a floor, not a cost — same word the
    // Analytics tab uses for a recipe with an unpriced ingredient.
    complete: missing.length === 0,
  };
}
