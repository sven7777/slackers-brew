import { describe, it, expect } from "vitest";
import {
  OZ_PER_BBL, article, deductionFactors, deductions, floorCents, pourFor,
  priceBeers, priceBoard, priceServing, recommendedPrice, roundToBoard,
  servingsOf, sortPricedBeers,
} from "./menuPricing";
import { costStack, defCosts } from "./overhead";

// Slackers' real production basis (Derek, 2026-08-28): 150 gal post-boil,
// 6.5 kegs packaged, 40 batches a year. Overhead figures here are fabricated
// round numbers — the real ones are the brewery's business and, like vendor
// prices, stay out of this repo.
const settings = { postBoilYield: 150, avgKegs: 6.5, lossPct: 33 };
const withCosts = (costs) => ({ ...settings, costs: { ...costs } });

const OVERHEAD = { rent: 6000, electric: 1500, water: 400, insurance: 600, otherFixed: 500, fohPayroll: 1000 };
// The shipped default basis is `added` — Slackers' confirmed answer, the board
// says $8 and Toast adds tax at the register. Tests about the INCLUSIVE path
// therefore say so explicitly rather than leaning on the default.
const complete = (extra = {}) => withCosts({ ...OVERHEAD, ...extra });
const inclusive = (extra = {}) => complete({ taxBasis: "included", ...extra });

const stackOf = (s, perBbl = 120) => costStack({ settings: s, ingredientCostPerBbl: perBbl });

describe("floorCents", () => {
  // The mirror of cogs.js's ceilCents. Money coming IN rounds down, so no
  // rounding in this module can make a marginal beer look like it clears.
  it("rounds revenue down to the cent", () => {
    expect(floorCents(7.3949)).toBe(7.39);
    expect(floorCents(7.399999)).toBe(7.39);
    expect(floorCents(2)).toBe(2);
  });

  // 7.39 is 738.99999… in binary; a naive floor would report $7.38 and the
  // column would stop adding up.
  it("kills float noise before flooring", () => {
    expect(floorCents(8 / (1 + 0.0825) * (1 + 0.0825))).toBe(8);
    expect(floorCents(7.39)).toBe(7.39);
  });

  it("returns null rather than a number for a non-number", () => {
    expect(floorCents(null)).toBeNull();
    expect(floorCents(NaN)).toBeNull();
  });
});

describe("article", () => {
  // "a $8.00 pint" reads as "a eight dollar pint".
  it("takes 'an' before the prices that start with a vowel sound", () => {
    for (const p of ["$8.00", 8, "$11.00", "$18.00", "$8.50", "$85.00"]) {
      expect(article(p)).toBe("an");
    }
  });

  it("takes 'a' before every other price", () => {
    for (const p of ["$7.00", "$12.00", "$1.50", "$64.00", "$9.00"]) {
      expect(article(p)).toBe("a");
    }
  });

  it("falls back to 'a' rather than throwing on nothing", () => {
    expect(article(null)).toBe("a");
    expect(article(undefined)).toBe("a");
  });
});

describe("servingsOf", () => {
  it("ships the brewery's board", () => {
    const sizes = servingsOf(settings);
    expect(sizes.map((s) => s.oz)).toEqual([8, 12, 16, 32, 64]);
    expect(sizes.find((s) => s.oz === 16).price).toBe(8);
  });

  // A size with no price is one that is not sold yet, not one that is free.
  it("keeps an unpriced size as null, never zero", () => {
    expect(servingsOf(settings).find((s) => s.oz === 64).price).toBeNull();
  });

  it("reads free text, and drops a row with no usable size", () => {
    const sizes = servingsOf(withCosts({
      servings: [{ key: "a", oz: "12", price: "$7.00" }, { key: "b", oz: "", price: 5 }],
    }));
    expect(sizes).toHaveLength(1);
    expect(sizes[0]).toMatchObject({ oz: 12, price: 7 });
  });
});

describe("pourFor", () => {
  it("uses the house default when the recipe says nothing", () => {
    expect(pourFor({ n: "Kolsch" }, settings)).toMatchObject({ oz: 16, fromRecipe: false });
  });

  // Red Panda's 8 oz is a fact about Red Panda, so it lives on the recipe and
  // not as a branch in the pricing code.
  it("lets a beer set its own pour", () => {
    const p = pourFor({ n: "Red Panda", process: { pourOz: "8" } }, settings);
    expect(p).toMatchObject({ oz: 8, fromRecipe: true, label: "Half pour" });
  });

  it("honors a pour that is not on the board at all", () => {
    expect(pourFor({ process: { pourOz: 10 } }, settings)).toMatchObject({ oz: 10, label: "10 oz" });
  });

  it("follows the brewery's chosen default serving", () => {
    expect(pourFor({}, withCosts({ defaultServing: "short" })).oz).toBe(12);
  });
});

describe("deductionFactors", () => {
  // The single biggest lever on this whole screen: on an $8.00 pint at 8.25%
  // the two bases differ by $0.61, which is more than a pint's contribution.
  it("treats a tax-inclusive price as the customer's total", () => {
    const f = deductionFactors(inclusive());
    expect(f.included).toBe(true);
    expect(f.grossPerPrice).toBe(1);
    expect(f.beerPerPrice).toBeCloseTo(1 / 1.0825, 10);
  });

  // Slackers' confirmed basis, and therefore the shipped default: the board
  // says $8 and the register adds tax on top.
  it("adds tax on top when the board price excludes it, which is the default", () => {
    const f = deductionFactors(complete());
    expect(f.included).toBe(false);
    expect(f.beerPerPrice).toBe(1);
    expect(f.grossPerPrice).toBeCloseTo(1.0825, 10);
  });

  // The processor charges on the whole swipe, tax included — it does not care
  // which part of the charge the brewery keeps.
  it("charges the card fee on the gross amount swiped", () => {
    const inc = deductionFactors(inclusive());
    const add = deductionFactors(complete());
    expect(inc.cardPerPrice).toBeCloseTo(0.03, 10);
    expect(add.cardPerPrice).toBeCloseTo(0.03 * 1.0825, 10);
  });

  // Slackers' permit is 'bg' — confirmed 2026-09-03, no gross receipts tax.
  it("charges gross receipts only on a mixed beverage permit", () => {
    expect(deductionFactors(complete()).grtPerPrice).toBe(0);
    // On the added basis the whole menu price is beverage receipts; on the
    // inclusive one the sales tax inside it was never the brewery's money.
    expect(deductionFactors(complete({ permitType: "mb" })).grtPerPrice)
      .toBeCloseTo(0.067, 10);
    expect(deductionFactors(inclusive({ permitType: "mb" })).grtPerPrice)
      .toBeCloseTo(0.067 / 1.0825, 10);
  });

  // Excise is owed on beer produced, and the beer that foamed down a drain was
  // produced. Only the sold ounces are left to carry it.
  it("spreads excise over ounces SOLD, not ounces packaged", () => {
    const f = deductionFactors(complete());
    const naive = (6 + 3.5) / OZ_PER_BBL;
    expect(f.excisePerOz).toBeGreaterThan(naive);
    expect(f.excisePerOz).toBeCloseTo(9.5 / (OZ_PER_BBL * 0.97 * 0.98), 10);
  });

  it("has no excise to spread when nothing is sold", () => {
    expect(deductionFactors(complete({ linePct: 100 })).excisePerOz).toBeNull();
  });
});

describe("deductions", () => {
  it("splits a tax-inclusive $8.00 pint the way the register does", () => {
    const d = deductions({ settings: inclusive(), price: 8, oz: 16 });
    expect(d.gross).toBe(8);
    expect(d.salesTax).toBe(0.61);   // 8 − 8/1.0825
    expect(d.beer).toBe(7.39);
    expect(d.card).toBe(0.24);
    expect(d.grt).toBe(0);
    expect(d.excise).toBe(0.05);
    expect(d.net).toBe(7.1);
  });

  // ✅ Slackers' real board, on the confirmed basis (Derek, 2026-09-03).
  it("splits an $8.00 pint the way Slackers' register actually does", () => {
    const d = deductions({ settings: complete(), price: 8, oz: 16 });
    expect(d.gross).toBe(8.66);   // what the customer's card is charged
    expect(d.salesTax).toBe(0.66);
    expect(d.beer).toBe(8);       // the brewery keeps the whole board price
    expect(d.card).toBe(0.26);    // 3% of the gross swipe, tax included
    expect(d.excise).toBe(0.05);
    expect(d.net).toBe(7.69);
  });

  // An unsold size is not a $0 sale.
  it("returns nulls, not zeros, for a size with no board price", () => {
    const d = deductions({ settings: complete(), price: null, oz: 64 });
    expect(d.price).toBeNull();
    expect(d.net).toBeNull();
    // Excise is a property of the beer, not of the price, so it still resolves.
    expect(d.excise).toBeGreaterThan(0);
  });

  it("scales with the size poured", () => {
    const half = deductions({ settings: complete(), price: 8, oz: 8 });
    const pint = deductions({ settings: complete(), price: 8, oz: 16 });
    expect(half.excise).toBeLessThan(pint.excise);
    // Same price, less beer: the half pour nets more.
    expect(half.net).toBeGreaterThan(pint.net);
  });
});

describe("priceServing", () => {
  const perOz = (n) => n / 16;

  it("separates what one more pour is worth from what the year is worth", () => {
    const s = priceServing({
      settings: complete(), price: 8, oz: 16,
      directPerOz: perOz(1.26), absorbedPerOz: perOz(7.15),
    });
    expect(s.directCost).toBe(1.26);
    expect(s.absorbedCost).toBe(7.15);
    // Direct margin says pour it; absorbed says whether the year works. One
    // blended number would say neither.
    expect(s.contribution).toBe(6.43);
    expect(s.profit).toBe(0.54);
  });

  // The finding this whole view exists to surface: $0.97 of an $8.66 swipe
  // never reaches the brewery, and none of it appears on a menu. Comparing the
  // $8.00 board price straight against the $7.15 cost would read $0.85 of
  // margin where there is $0.54.
  it("shows what the deductions take before any cost is paid", () => {
    const s = priceServing({ settings: complete(), price: 8, oz: 16, absorbedPerOz: perOz(7.15) });
    expect(s.net).toBe(7.69);
    expect(Number((s.gross - s.net).toFixed(2))).toBe(0.97);
    expect(s.profit).toBe(0.54);
    expect(s.profit).toBeLessThan(8 - 7.15);
  });

  // ⚠️ The same pint on the other basis is a LOSS. The basis is not a detail.
  it("turns the same pint into a loss on the inclusive basis", () => {
    const s = priceServing({ settings: inclusive(), price: 8, oz: 16, absorbedPerOz: perOz(7.15) });
    expect(s.net).toBe(7.1);
    expect(s.profit).toBeLessThan(0);
  });

  it("reports margins against net revenue, not against the menu price", () => {
    const s = priceServing({ settings: complete(), price: 8, oz: 16, absorbedPerOz: perOz(3.55) });
    expect(s.profitMarginPct).toBeCloseTo((s.profit / s.net) * 100, 6);
    expect(s.profitMarginPct).toBeLessThan(((8 - 3.55) / 8) * 100);
  });

  it("has no margin to report when the size is not on the board", () => {
    const s = priceServing({ settings: complete(), price: null, oz: 32, absorbedPerOz: perOz(7.15) });
    expect(s.absorbedCost).toBe(14.3);
    expect(s.profit).toBeNull();
    expect(s.profitMarginPct).toBeNull();
  });

  it("costs nothing it was not given, rather than costing it zero", () => {
    const s = priceServing({ settings: complete(), price: 8, oz: 16 });
    expect(s.absorbedCost).toBeNull();
    expect(s.profit).toBeNull();
  });
});

describe("recommendedPrice", () => {
  // The property that matters, and the one that caught the seed-only version:
  // the price this returns, fed back through priceServing(), reports AT LEAST
  // the margin it was asked for. Exact algebra alone came back two cents short,
  // because the forward path rounds against the brewery four times over.
  it("round-trips through priceServing at the margin it was asked for", () => {
    for (const margin of [0, 10, 20, 35]) {
      for (const oz of [8, 12, 16]) {
        const cost = 0.44 * oz;
        const p = recommendedPrice({ settings: complete(), costPerServing: cost, oz, marginPct: margin });
        const back = priceServing({ settings: complete(), price: p, oz, absorbedPerOz: 0.44 });
        expect(back.profitMarginPct).toBeGreaterThanOrEqual(margin - 1e-6);
      }
    }
  });

  // A recommended price is the floor of what clears the target, so it rounds up.
  it("never recommends a price that misses the target", () => {
    const p = recommendedPrice({ settings: complete(), costPerServing: 7.15, oz: 16, marginPct: 0 });
    const back = priceServing({ settings: complete(), price: p, oz: 16, absorbedPerOz: 7.15 / 16 });
    expect(back.profit).toBeGreaterThanOrEqual(0);
  });

  // ✅ On Slackers' confirmed basis a $7.15 pint breaks even at $7.45, under the
  // $8.00 on the board — so the pint clears. On the inclusive basis the same
  // cost needs more than $8.00 and the board price does not.
  it("prices break-even under the current board price at Slackers' costs", () => {
    const breakEven = recommendedPrice({ settings: complete(), costPerServing: 7.15, oz: 16, marginPct: 0 });
    expect(breakEven).toBe(7.45);
    expect(breakEven).toBeLessThan(8);
    expect(recommendedPrice({ settings: inclusive(), costPerServing: 7.15, oz: 16, marginPct: 0 }))
      .toBeGreaterThan(8);
  });

  it("wants more when tax comes out of the price than when it is added on", () => {
    const inc = recommendedPrice({ settings: inclusive(), costPerServing: 5, oz: 16, marginPct: 20 });
    const add = recommendedPrice({ settings: complete(), costPerServing: 5, oz: 16, marginPct: 20 });
    expect(inc).toBeGreaterThan(add);
  });

  it("falls back to the brewery's target margin", () => {
    const a = recommendedPrice({ settings: complete(), costPerServing: 5, oz: 16 });
    const b = recommendedPrice({ settings: complete(), costPerServing: 5, oz: 16, marginPct: defCosts.targetMarginPct });
    expect(a).toBe(b);
  });

  it("has no answer for an unknown cost or an impossible margin", () => {
    expect(recommendedPrice({ settings: complete(), costPerServing: null, oz: 16 })).toBeNull();
    expect(recommendedPrice({ settings: complete(), costPerServing: 5, oz: 16, marginPct: 100 })).toBeNull();
  });
});

describe("roundToBoard", () => {
  it("rounds up to a price a brewery would print", () => {
    expect(roundToBoard(8.43)).toBe(8.5);
    expect(roundToBoard(8.51)).toBe(8.75);
    expect(roundToBoard(8.5)).toBe(8.5);
  });

  it("never rounds a recommendation down below what it has to clear", () => {
    expect(roundToBoard(8.01)).toBeGreaterThanOrEqual(8.01);
  });
});

describe("priceBoard", () => {
  it("prices every size on the board against one cost basis", () => {
    const board = priceBoard({ settings: complete(), stack: stackOf(complete()) });
    expect(board.rows.map((r) => r.oz)).toEqual([8, 12, 16, 32, 64]);
    expect(board.rows.every((r) => r.absorbedCost > 0)).toBe(true);
  });

  // Per ounce, an 8 oz pour at the pint price is the brewery's best product and
  // the 16 oz its cheapest — the comparison a flat board hides.
  it("makes the per-ounce comparison across sizes", () => {
    const board = priceBoard({ settings: complete(), stack: stackOf(complete()) });
    const half = board.rows.find((r) => r.oz === 8);
    const pint = board.rows.find((r) => r.oz === 16);
    expect(half.pricePerOz).toBeGreaterThan(pint.pricePerOz);
    expect(half.profit).toBeGreaterThan(pint.profit);
  });

  it("recommends rather than scores a size with no price on it", () => {
    const growler = priceBoard({ settings: complete(), stack: stackOf(complete()) }).rows.find((r) => r.oz === 64);
    expect(growler.price).toBeNull();
    expect(growler.profit).toBeNull();
    expect(growler.recommended).toBeGreaterThan(0);
  });

  it("reports the gap to break-even on the sizes that are priced", () => {
    const rows = priceBoard({ settings: complete(), stack: stackOf(complete()) }).rows;
    for (const r of rows.filter((x) => x.price != null)) {
      expect(r.shortfall).toBeCloseTo(Number((r.price - r.breakEven).toFixed(2)), 6);
    }
  });

  // An unconfirmed rent is not free rent: the cost is a floor, so the price
  // built on it is a floor too and the view has to say so.
  it("carries the cost stack's incompleteness onto every row", () => {
    const partial = withCosts({ rent: 6000 });
    const board = priceBoard({ settings: partial, stack: stackOf(partial) });
    expect(board.rows.every((r) => r.complete === false)).toBe(true);
    expect(priceBoard({ settings: complete(), stack: stackOf(complete()) }).rows[0].complete).toBe(true);
  });
});

describe("priceBeers", () => {
  const recs = [
    { n: "Kolsch" },
    { n: "Red Panda", process: { pourOz: 8 } },
  ];
  const rows = [
    { index: 0, name: "Kolsch", costPerBbl: 90, complete: true },
    { index: 1, name: "Red Panda", costPerBbl: 210, complete: true },
  ];

  it("costs each beer on its own ingredients", () => {
    const [kolsch, panda] = priceBeers({ settings: complete(), rows, recs });
    // Same labor and overhead per pint; only the ingredient layer differs.
    expect(panda.absorbedCost).toBeGreaterThan(kolsch.absorbedCost / 2);
    expect(kolsch.pourOz).toBe(16);
  });

  // The per-beer pour is why a tripel at the pint price is the best thing on
  // the board rather than the worst.
  it("prices a beer at its own pour size", () => {
    const [, panda] = priceBeers({ settings: complete(), rows, recs });
    expect(panda.pourOz).toBe(8);
    expect(panda.pourFromRecipe).toBe(true);
    expect(panda.price).toBe(8);
    // Half the beer at the same price: it out-earns the pint by a wide margin.
    expect(panda.profit).toBeGreaterThan(priceBeers({ settings: complete(), rows, recs })[0].profit);
  });

  it("prices a beer whose pour is not a size on the board", () => {
    const odd = priceBeers({ settings: complete(), rows: [rows[0]], recs: [{ process: { pourOz: 10 } }] })[0];
    expect(odd.pourOz).toBe(10);
    expect(odd.price).toBeNull();
    expect(odd.recommended).toBeGreaterThan(0);
  });

  // A recipe with an unpriced ingredient is a floor, and so is any price built
  // on it — cogs.js's rule, two levels up.
  it("carries a recipe's own incompleteness through", () => {
    const out = priceBeers({
      settings: complete(),
      rows: [{ index: 0, name: "Kolsch", costPerBbl: 90, complete: false }],
      recs,
    });
    expect(out[0].complete).toBe(false);
  });

  it("survives a row with no matching recipe", () => {
    const out = priceBeers({ settings: complete(), rows, recs: [] });
    expect(out).toHaveLength(2);
    expect(out.every((r) => r.pourOz === 16)).toBe(true);
  });
});

describe("sortPricedBeers", () => {
  const rows = [
    { name: "Crystal 8", profit: 2 },
    { name: "Cascade", profit: null },
    { name: "CTZ", profit: -1 },
  ];

  it("sorts names the way a brewer scans them", () => {
    expect(sortPricedBeers(rows, "name", "asc").map((r) => r.name))
      .toEqual(["Cascade", "Crystal 8", "CTZ"]);
  });

  // "Not on the board" is not "cheapest": a null sorts last either way, or the
  // dearest-first sort would open on the beers with no price at all.
  it("keeps nulls last in both directions", () => {
    expect(sortPricedBeers(rows, "profit", "asc").map((r) => r.profit)).toEqual([-1, 2, null]);
    expect(sortPricedBeers(rows, "profit", "desc").map((r) => r.profit)).toEqual([2, -1, null]);
  });

  it("does not mutate its input", () => {
    const before = [...rows];
    sortPricedBeers(rows, "profit", "desc");
    expect(rows).toEqual(before);
  });
});
