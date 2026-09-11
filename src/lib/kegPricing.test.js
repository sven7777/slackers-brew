import { describe, it, expect } from "vitest";
import {
  accountEconomics, accountPourFor, channelCompare, costPerBbl, kegDeductions, kegPriceFor,
  kegPriceList, kegSizesOf, missingWholesaleInputs, priceKeg, priceKegBeers,
  recommendedKegPrice, roundToKegPrice,
} from "./kegPricing";
import { costStack } from "./overhead";
import { deductions, priceServing } from "./menuPricing";

// A brewery with every input confirmed, so a figure that comes back null is a
// real gap and not an unset field.
const full = (over = {}) => ({
  postBoilYield: "150",
  avgKegs: "6.5",
  costs: {
    rent: 4000, electric: 900, water: 250, insurance: 400, fohPayroll: 6000, otherFixed: 500,
    kegSizes: [
      { key: "sixtel", label: "1/6 BBL", bbl: 1 / 6, price: 95, kegCost: 120 },
      { key: "quarter", label: "1/4 BBL", bbl: 1 / 4, price: 130, kegCost: 130 },
      { key: "halfbbl", label: "1/2 BBL", bbl: 1 / 2, price: 180, kegCost: 150 },
    ],
    kegDeliveryPerKeg: 12,
    kegLossPct: 2,
    ...over,
  },
});

describe("kegSizesOf", () => {
  it("ships the three sizes Slackers sells", () => {
    expect(kegSizesOf({}).map((s) => s.label)).toEqual(["1/6 BBL", "1/4 BBL", "1/2 BBL"]);
  });

  it("carries exact barrel fractions, not rounded gallons", () => {
    const [sixth, quarter, half] = kegSizesOf({});
    expect(sixth.bbl).toBeCloseTo(1 / 6, 10);
    expect(quarter.bbl).toBe(0.25);
    expect(half.bbl).toBe(0.5);
  });

  // The half barrel ships at Slackers' real base-tier price, like the volume and
  // tax-basis defaults. The sizes he does not quote stay unpriced — an unpriced
  // size is one not on the list yet, never a guess.
  it("ships the half barrel priced and the rest unpriced", () => {
    const sizes = kegSizesOf({});
    expect(sizes.find((s) => s.key === "halfbbl").price).toBe(160);
    expect(sizes.find((s) => s.key === "sixtel").price).toBeNull();
    expect(sizes.find((s) => s.key === "quarter").price).toBeNull();
  });

  it("drops a size with no usable volume rather than dividing by zero barrels", () => {
    const rows = kegSizesOf({ costs: { kegSizes: [{ key: "junk", label: "?", bbl: "", price: 100 }] } });
    expect(rows).toEqual([]);
  });
});

describe("kegPriceFor", () => {
  const size = { key: "halfbbl", label: "1/2 BBL", bbl: 0.5, price: 180 };

  it("falls back to the house price", () => {
    expect(kegPriceFor({}, size)).toEqual({ price: 180, fromRecipe: false });
  });

  // Derek prices beers differently from one another; the price is a fact about
  // the beer, so it lives on the recipe like pourOz does.
  it("prefers the beer's own price", () => {
    const r = { process: { kegPrices: { halfbbl: 220 } } };
    expect(kegPriceFor(r, size)).toEqual({ price: 220, fromRecipe: true });
  });

  it("falls back PER SIZE — a beer premium only on half barrels keeps the house sixtel", () => {
    const r = { process: { kegPrices: { halfbbl: 220 } } };
    const sixth = { key: "sixtel", bbl: 1 / 6, price: 95 };
    expect(kegPriceFor(r, sixth)).toEqual({ price: 95, fromRecipe: false });
    expect(kegPriceFor(r, size).price).toBe(220);
  });
});

describe("kegDeductions", () => {
  // ⚠️ The whole reason this module exists. A keg run through the taproom's
  // deduction stack collects sales tax and a card fee it does not owe.
  it("takes NO sales tax and NO card fee", () => {
    const s = full();
    const keg = kegDeductions({ settings: s, price: 180, bbl: 0.5, kegCost: 150 });
    const pint = deductions({ settings: s, price: 180, oz: 16 });
    // The taproom would have taken 8.25% + 3% of the same number.
    expect(pint.salesTax).toBeGreaterThan(14);
    expect(pint.card).toBeGreaterThan(5);
    expect(keg).not.toHaveProperty("salesTax");
    expect(keg).not.toHaveProperty("card");
    expect(keg.deducted).toBeLessThan(25);
  });

  it("charges excise on the full barrel fraction, undivided by pour loss", () => {
    const s = full();
    // $6.00 state + $3.50 fed = $9.50/bbl.
    expect(kegDeductions({ settings: s, price: 180, bbl: 0.5, kegCost: 150 }).excise).toBe(4.75);
    expect(kegDeductions({ settings: s, price: 130, bbl: 0.25, kegCost: 130 }).excise).toBe(2.38);
    expect(kegDeductions({ settings: s, price: 95, bbl: 1 / 6, kegCost: 120 }).excise).toBe(1.59);
  });

  // The trap: pourKeep is what spreads excise per ounce in the taproom, so a
  // keg priced as a serving carries ~5% more excise than it owes.
  it("does not inflate excise by the taproom's pour loss", () => {
    const s = full();
    const keg = kegDeductions({ settings: s, price: 180, bbl: 0.5, kegCost: 150 });
    const asServing = deductions({ settings: s, price: 180, oz: 0.5 * 31 * 8 * 16 });
    expect(asServing.excise).toBeGreaterThan(keg.excise);
    expect(asServing.excise / keg.excise).toBeCloseTo(1 / ((1 - 0.03) * (1 - 0.02)), 2);
  });

  it("nets price less excise, delivery and shrinkage", () => {
    const d = kegDeductions({ settings: full(), price: 180, bbl: 0.5, kegCost: 150 });
    // 4.75 excise + 12 delivery + 3.00 shrinkage (2% of $150)
    expect(d.shrinkage).toBe(3);
    expect(d.deducted).toBe(19.75);
    expect(d.net).toBe(160.25);
    expect(d.complete).toBe(true);
  });

  it("leaves an unconfirmed cost OUT rather than zeroing it, and says so", () => {
    const d = kegDeductions({ settings: { costs: {} }, price: 180, bbl: 0.5 });
    expect(d.delivery).toBeNull();
    expect(d.shrinkage).toBeNull();
    expect(d.excise).toBe(4.75);
    expect(d.net).toBe(175.25);
    expect(d.complete).toBe(false);
  });

  it("needs both halves of shrinkage before it charges any", () => {
    const noCost = kegDeductions({ settings: full(), price: 180, bbl: 0.5, kegCost: null });
    expect(noCost.shrinkage).toBeNull();
    const noPct = kegDeductions({ settings: full({ kegLossPct: null }), price: 180, bbl: 0.5, kegCost: 150 });
    expect(noPct.shrinkage).toBeNull();
  });

  it("returns a null net for a size with no price, never a negative one", () => {
    const d = kegDeductions({ settings: full(), price: null, bbl: 0.5, kegCost: 150 });
    expect(d.net).toBeNull();
    expect(d.excise).toBe(4.75);
  });
});

describe("missingWholesaleInputs", () => {
  it("names nothing when everything is confirmed", () => {
    expect(missingWholesaleInputs(full())).toEqual([]);
  });

  it("names delivery and loss when unset", () => {
    const m = missingWholesaleInputs({ costs: {} });
    expect(m).toContain("kegDeliveryPerKeg");
    expect(m).toContain("kegLossPct");
    // The shipped half-barrel price means a keg cost is now a real gap too.
    expect(m).toContain("kegCost");
  });

  it("asks for a keg cost only once a size is actually priced", () => {
    const priced = full({ kegSizes: [{ key: "halfbbl", bbl: 0.5, price: 180, kegCost: null }] });
    expect(missingWholesaleInputs(priced)).toContain("kegCost");
    const unpriced = full({ kegSizes: [{ key: "halfbbl", bbl: 0.5, price: null, kegCost: null }] });
    expect(missingWholesaleInputs(unpriced)).not.toContain("kegCost");
  });

  it("does not ask for a keg cost at 0% loss — it could not change the answer", () => {
    const s = full({ kegLossPct: 0, kegSizes: [{ key: "halfbbl", bbl: 0.5, price: 180, kegCost: null }] });
    expect(missingWholesaleInputs(s)).not.toContain("kegCost");
  });
});

describe("costPerBbl", () => {
  const s = full();
  const stack = costStack({ settings: s, ingredientCostPerBbl: 120 });

  // ⚠️ The pour-loss trap in its other form: perPint divides by pints SOLD, and
  // a keg suffers none of that loss.
  it("divides by PACKAGED barrels, not sold pints", () => {
    const per = costPerBbl({ settings: s, stack });
    const naive = stack.perPint.absorbed * 248;
    expect(per.absorbed).toBeLessThan(naive);
    expect(naive / per.absorbed).toBeCloseTo(1 / ((1 - 0.03) * (1 - 0.02)), 2);
  });

  it("scales the overhead layer by the brewery's allocation, leaving direct alone", () => {
    const full100 = costPerBbl({ settings: s, stack });
    const halfShare = costPerBbl({ settings: full({ wholesaleOverheadPct: 50 }), stack });
    expect(halfShare.direct).toBe(full100.direct);
    expect(halfShare.overhead).toBeCloseTo(full100.overhead / 2, 0);
  });

  it("collapses absorbed onto direct when wholesale carries no overhead", () => {
    const none = costPerBbl({ settings: full({ wholesaleOverheadPct: 0 }), stack });
    expect(none.overhead).toBe(0);
    expect(none.absorbed).toBe(none.direct);
  });

  it("defaults to the full share, the allocation that cannot flatter", () => {
    expect(costPerBbl({ settings: full(), stack }).overheadSharePct).toBe(100);
  });
});

describe("priceKeg", () => {
  const s = full();
  const stack = costStack({ settings: s, ingredientCostPerBbl: 120 });
  const per = costPerBbl({ settings: s, stack });

  it("builds profit from the rounded lines so the column adds up", () => {
    const k = priceKeg({ settings: s, price: 180, bbl: 0.5, kegCost: 150, directPerBbl: per.direct, absorbedPerBbl: per.absorbed });
    expect(k.profit).toBeCloseTo(k.net - k.absorbedCost, 10);
    expect(k.contribution).toBeCloseTo(k.net - k.directCost, 10);
  });

  it("is incomplete when either the price side or the cost side is", () => {
    const costGap = priceKeg({ settings: s, price: 180, bbl: 0.5, kegCost: 150, directPerBbl: per.direct, absorbedPerBbl: per.absorbed, complete: false });
    expect(costGap.complete).toBe(false);
    const priceGap = priceKeg({ settings: { costs: {} }, price: 180, bbl: 0.5, directPerBbl: 100, absorbedPerBbl: 200, complete: true });
    expect(priceGap.complete).toBe(false);
  });

  it("reports no margin on a size that is not on the price list", () => {
    const k = priceKeg({ settings: s, price: null, bbl: 0.5, kegCost: 150, directPerBbl: per.direct, absorbedPerBbl: per.absorbed });
    expect(k.profit).toBeNull();
    expect(k.profitMarginPct).toBeNull();
    expect(k.absorbedCost).toBeGreaterThan(0);
  });
});

describe("recommendedKegPrice", () => {
  const s = full();

  // The same lesson menuPricing's own test caught: the closed form is a seed.
  it("returns a price that actually clears its target once rounded", () => {
    for (const m of [0, 10, 20, 35]) {
      const price = recommendedKegPrice({ settings: s, costPerKeg: 88.5, bbl: 0.5, kegCost: 150, marginPct: m });
      const { net } = kegDeductions({ settings: s, price, bbl: 0.5, kegCost: 150 });
      expect(net * (1 - m / 100)).toBeGreaterThanOrEqual(88.5 - 1e-9);
    }
  });

  it("covers every deduction, not just the cost", () => {
    const price = recommendedKegPrice({ settings: s, costPerKeg: 100, bbl: 0.5, kegCost: 150, marginPct: 0 });
    // 100 of cost + 4.75 excise + 12 delivery + 3 shrinkage
    expect(price).toBeGreaterThanOrEqual(119.75);
    expect(price).toBeLessThan(121);
  });

  it("is null when there is no cost to solve against", () => {
    expect(recommendedKegPrice({ settings: s, costPerKeg: null, bbl: 0.5 })).toBeNull();
  });
});

describe("roundToKegPrice", () => {
  it("rounds UP to a price a brewery would invoice", () => {
    expect(roundToKegPrice(137.5)).toBe(140);
    expect(roundToKegPrice(140.01)).toBe(145);
    expect(roundToKegPrice(140)).toBe(140);
  });

  it("passes a null through rather than inventing a price", () => {
    expect(roundToKegPrice(null)).toBeNull();
  });
});

describe("kegPriceList", () => {
  const s = full();
  const stack = costStack({ settings: s, ingredientCostPerBbl: 120 });

  it("prices all three sizes against one cost basis", () => {
    const { rows } = kegPriceList({ settings: s, stack });
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.label)).toEqual(["1/6 BBL", "1/4 BBL", "1/2 BBL"]);
    expect(rows.every((r) => r.absorbedCost > 0)).toBe(true);
  });

  it("prices a beer at its own price where it has one", () => {
    const recipe = { process: { kegPrices: { halfbbl: 220 } } };
    const { rows } = kegPriceList({ settings: s, stack, recipe });
    const half = rows.find((r) => r.key === "halfbbl");
    expect(half.price).toBe(220);
    expect(half.priceFromRecipe).toBe(true);
    expect(rows.find((r) => r.key === "sixtel").priceFromRecipe).toBe(false);
  });

  it("gives a direct floor below the break-even, since overhead sits between them", () => {
    const { rows } = kegPriceList({ settings: s, stack });
    for (const r of rows) expect(r.directFloor).toBeLessThanOrEqual(r.breakEven);
  });

  it("carries the missing-input list so the panel can name the gaps", () => {
    expect(kegPriceList({ settings: { costs: {} }, stack }).missing).toContain("kegDeliveryPerKeg");
  });
});

describe("channelCompare", () => {
  const s = full();
  const stack = costStack({ settings: s, ingredientCostPerBbl: 120 });

  // The asymmetry IS the honesty: a barrel poured at the bar does not yield a
  // barrel of paid-for beer, and a barrel sold as kegs yields exactly itself.
  it("discounts the taproom barrel by pour loss and the keg barrel by nothing", () => {
    const pint = priceServing({ settings: s, price: 8, oz: 16 });
    const { rows } = kegPriceList({ settings: s, stack });
    const half = rows.find((r) => r.key === "halfbbl");
    const cmp = channelCompare({ settings: s, taproomServing: pint, kegRow: half });

    const undiscounted = pint.netPerOz * 31 * 8 * 16;
    expect(cmp.taproomNetPerBbl).toBeLessThan(undiscounted);
    expect(cmp.taproomNetPerBbl).toBeCloseTo(undiscounted * (1 - 0.03) * (1 - 0.02), 0);
    expect(cmp.wholesaleNetPerBbl).toBeCloseTo(half.net / 0.5, 1);
  });

  it("shows the taproom clearing wholesale by several times on the same barrel", () => {
    const pint = priceServing({ settings: s, price: 8, oz: 16 });
    const { rows } = kegPriceList({ settings: s, stack });
    const cmp = channelCompare({ settings: s, taproomServing: pint, kegRow: rows.find((r) => r.key === "halfbbl") });
    expect(cmp.ratio).toBeGreaterThan(3);
    expect(cmp.difference).toBeGreaterThan(0);
  });

  it("reports nulls rather than a ratio when a side is unpriced", () => {
    const cmp = channelCompare({ settings: s, taproomServing: null, kegRow: null });
    expect(cmp.taproomNetPerBbl).toBeNull();
    expect(cmp.ratio).toBeNull();
  });
});

describe("priceKegBeers", () => {
  const s = full();
  const stackFor = (perBbl) => costStack({ settings: s, ingredientCostPerBbl: perBbl });
  const rows = [
    { index: 0, name: "Kolsch", costPerBbl: 90, complete: true },
    { index: 1, name: "Beachbomber", costPerBbl: 210, complete: true },
    { index: 2, name: "Unpriced", costPerBbl: 100, complete: false },
  ];
  const recs = [
    { n: "Kolsch" },
    { n: "Beachbomber", process: { kegPrices: { halfbbl: 220 } } },
    { n: "Unpriced" },
  ];

  it("prices each beer at its own price and its own ingredient cost", () => {
    const out = priceKegBeers({ settings: s, rows, recs, stackFor, sizeKey: "halfbbl" });
    expect(out[0].price).toBe(180);
    expect(out[0].priceFromRecipe).toBe(false);
    expect(out[1].price).toBe(220);
    expect(out[1].priceFromRecipe).toBe(true);
    // The dearer beer costs more per keg, on its own ingredients.
    expect(out[1].absorbedCost).toBeGreaterThan(out[0].absorbedCost);
  });

  it("carries a recipe's own incompleteness through to its margin", () => {
    const out = priceKegBeers({ settings: s, rows, recs, stackFor, sizeKey: "halfbbl" });
    expect(out[2].complete).toBe(false);
    expect(out[0].complete).toBe(true);
  });

  it("defaults to the largest size and honours a size choice", () => {
    const dflt = priceKegBeers({ settings: s, rows, recs, stackFor });
    expect(dflt[0].sizeLabel).toBe("1/2 BBL");
    const sixth = priceKegBeers({ settings: s, rows, recs, stackFor, sizeKey: "sixtel" });
    expect(sixth[0].sizeLabel).toBe("1/6 BBL");
    expect(sixth[0].absorbedCost).toBeLessThan(dflt[0].absorbedCost);
  });

  // An EMPTY list means "unset" and falls back to the shipped sizes, the same
  // way `servings` does — so the real no-size case is a list whose rows carry no
  // usable volume, which kegSizesOf drops rather than divide by zero barrels.
  it("returns nothing rather than guessing when no size has a usable volume", () => {
    const none = { ...s, costs: { ...s.costs, kegSizes: [{ key: "junk", label: "?", bbl: "" }] } };
    expect(priceKegBeers({ settings: none, rows, recs, stackFor })).toEqual([]);
  });
});

describe("accountEconomics", () => {
  const s = full();

  // Cross-checked against a published Texas draft-pricing guide: a half barrel
  // is 1,984 oz, a bar loses ~20% to tapping/line/foam/buybacks, leaving ~1,587
  // oz — about 99 sixteen-ounce pints.
  it("counts the pours the ACCOUNT actually sells, not the keg's volume", () => {
    const a = accountEconomics({ settings: s, price: 180, bbl: 0.5 });
    expect(a.pints).toBe(99);
    // The nominal count a naive calculation would use.
    expect(1984 / 16).toBe(124);
  });

  // ⚠️ The account's loss is the industry's ~20%, NOT the brewery's ~5%
  // pourKeep. Using the brewery's would overstate what the bar gets by fifteen
  // points and make every price look cheaper to them than it is.
  it("uses the account's loss, which is far larger than the brewery's", () => {
    const a = accountEconomics({ settings: s, price: 180, bbl: 0.5 });
    const atBreweryLoss = Math.floor((1984 * (1 - 0.03)) * (1 - 0.02) / 16);
    expect(atBreweryLoss).toBeGreaterThan(a.pints);
    expect(atBreweryLoss - a.pints).toBeGreaterThan(15);
  });

  it("reports what our price costs the account as a pour cost", () => {
    const a = accountEconomics({ settings: s, price: 180, bbl: 0.5 });
    // 99 pints x $7.00 = $693 of revenue for the bar.
    expect(a.revenue).toBe(693);
    expect(a.pourCostPct).toBeCloseTo(25.97, 1);
  });

  it("back-solves the most the account could pay at their target pour cost", () => {
    const a = accountEconomics({ settings: s, price: 180, bbl: 0.5 });
    // 25% of $693.
    expect(a.ceiling).toBe(173.25);
  });

  it("moves the ceiling with what the account can retail it for", () => {
    const cheap = accountEconomics({ settings: full({ accountRetailPint: 6 }), price: 180, bbl: 0.5 });
    const dear = accountEconomics({ settings: full({ accountRetailPint: 8 }), price: 180, bbl: 0.5 });
    expect(cheap.ceiling).toBeLessThan(dear.ceiling);
    // A $6 pint cannot support a $180 keg at a 25% pour cost.
    expect(cheap.ceiling).toBeLessThan(180);
  });

  it("scales with keg size", () => {
    const half = accountEconomics({ settings: s, price: 180, bbl: 0.5 });
    const sixth = accountEconomics({ settings: s, price: 95, bbl: 1 / 6 });
    expect(sixth.pints).toBe(Math.floor(half.pints / 3));
  });

  it("returns nulls rather than dividing by a keg with no volume", () => {
    expect(accountEconomics({ settings: s, price: 180, bbl: null }).ceiling).toBeNull();
  });
});

describe("kegPriceList — price guidance", () => {
  const s = full();
  const stack = costStack({ settings: s, ingredientCostPerBbl: 120 });

  it("suggests a cost-plus price on DIRECT cost, not absorbed", () => {
    const { rows } = kegPriceList({ settings: s, stack });
    const half = rows.find((r) => r.key === "halfbbl");
    expect(half.suggested).toBeGreaterThan(half.directCost);
    // Absorbed is an order of magnitude away and must not be the basis.
    expect(half.suggested).toBeLessThan(half.absorbedCost);
  });

  it("carries the account ceiling beside it", () => {
    const { rows } = kegPriceList({ settings: s, stack });
    expect(rows.find((r) => r.key === "halfbbl").ceiling).toBe(173.25);
  });

  // ⚠️ The finding this column exists for. At a 3.5 BBL brewhouse's cost per
  // barrel, the industry's own draft margin benchmark solves to a price no
  // account would pay — and a cost-plus column alone could never say so.
  it("flags a suggestion that has risen above what the account can pay", () => {
    const { rows } = kegPriceList({ settings: s, stack });
    const half = rows.find((r) => r.key === "halfbbl");
    expect(half.squeezed).toBe(true);
    expect(half.suggested).toBeGreaterThan(half.ceiling);
  });

  it("does not flag a squeeze when the margin is achievable", () => {
    const cheap = costStack({ settings: s, ingredientCostPerBbl: 20 });
    const lowTarget = full({ wholesaleTargetMarginPct: 5, accountRetailPint: 12 });
    const { rows } = kegPriceList({ settings: lowTarget, stack: cheap });
    expect(rows.find((r) => r.key === "halfbbl").squeezed).toBe(false);
  });
});

describe("accountPourFor", () => {
  it("falls back to the brewery-wide default", () => {
    expect(accountPourFor({}, full())).toEqual({ oz: 16, fromRecipe: false });
  });

  it("prefers the beer's own — a high-ABV beer goes in a smaller glass", () => {
    expect(accountPourFor({ process: { accountPourOz: 12 } }, full()))
      .toEqual({ oz: 12, fromRecipe: true });
  });

  // ⚠️ Distinct from pourFor(), which is the size WE pour it at. A beer can be a
  // 16 oz pour in our taproom and a 12 oz pour at an account.
  it("is independent of our own taproom pour", () => {
    const r = { process: { pourOz: 8, accountPourOz: 12 } };
    expect(accountPourFor(r, full()).oz).toBe(12);
  });
});

describe("the account pour moves the ceiling", () => {
  const s = full();

  // ⚠️ The finding this exists for. Derek's specialty kegs invoice at $220-250,
  // which reads as unsellable at a 16 oz pour and is perfectly normal at 12 oz.
  it("makes a dear keg workable at a smaller pour", () => {
    const at16 = accountEconomics({ settings: s, price: 250, bbl: 0.5, pourOz: 16 });
    const at12 = accountEconomics({ settings: s, price: 250, bbl: 0.5, pourOz: 12 });

    // A third more pours out of the same keg.
    expect(at12.pints).toBe(132);
    expect(at16.pints).toBe(99);
    // At 16 oz the bar is over 30% and refuses it outright.
    expect(at16.pourCostPct).toBeGreaterThan(30);
    expect(at16.ceiling).toBeLessThan(250);

    // ⚠️ But the smaller pour ALONE does not rescue it: against a $7 pint it is
    // still 27%, over the 25% target. The pour is only half the ceiling.
    expect(at12.pourCostPct).toBeCloseTo(27.06, 1);
    expect(at12.ceiling).toBeLessThan(250);

    // It clears at $8 — what a bar actually charges for a 9% beer. Both halves
    // are needed, which is why both are per-beer.
    const real = accountEconomics({ settings: s, price: 250, bbl: 0.5, pourOz: 12, retailPint: 8 });
    expect(real.pourCostPct).toBeLessThan(25);
    expect(real.ceiling).toBeGreaterThan(250);
  });
});

describe("priceKegBeers — account ceiling per beer", () => {
  const s = full();
  const stackFor = (perBbl) => costStack({ settings: s, ingredientCostPerBbl: perBbl });
  const rows = [
    { index: 0, name: "Light", costPerBbl: 80, complete: true },
    { index: 1, name: "Specialty", costPerBbl: 210, complete: true },
  ];
  const recs = [
    { n: "Light" },
    { n: "Specialty", process: { kegPrices: { halfbbl: 250 }, accountPourOz: 12, accountRetailPint: 8 } },
  ];

  it("resolves each beer's own account pour", () => {
    const out = priceKegBeers({ settings: s, rows, recs, stackFor, sizeKey: "halfbbl" });
    expect(out[0].accountPourOz).toBe(16);
    expect(out[0].accountPourFromRecipe).toBe(false);
    expect(out[1].accountPourOz).toBe(12);
    expect(out[1].accountPourFromRecipe).toBe(true);
    expect(out[0].accountRetailPint).toBe(7);
    expect(out[1].accountRetailPint).toBe(8);
    expect(out[1].accountRetailFromRecipe).toBe(true);
  });

  // Without the per-beer pour this beer would be flagged as overpriced when it
  // is not — the app telling the brewery to cut a price that works fine.
  it("does not flag a dear specialty keg that the account pours smaller", () => {
    const out = priceKegBeers({ settings: s, rows, recs, stackFor, sizeKey: "halfbbl" });
    const specialty = out.find((b) => b.name === "Specialty");
    expect(specialty.price).toBe(250);
    expect(specialty.overCeiling).toBe(false);

    // The same beer on the house pour and house retail price would be flagged —
    // the app telling the brewery to cut a price that works perfectly well.
    const flat = priceKegBeers({
      settings: s, rows, stackFor, sizeKey: "halfbbl",
      recs: [recs[0], { ...recs[1], process: { kegPrices: { halfbbl: 250 } } }],
    });
    expect(flat.find((b) => b.name === "Specialty").overCeiling).toBe(true);
  });
});

