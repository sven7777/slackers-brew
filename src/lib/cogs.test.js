import { describe, it, expect } from "vitest";
import { computeRecipeCost, parseVolume, priceMapFrom } from "./cogs";

// Prices here are fabricated round numbers (real vendor pricing stays out of
// this repo), chosen so every expected total is checkable by hand.
const priceMap = {
  malt: { "2-Row": 1, "White Wheat": 2, "Unpriced Malt": null },
  hop: { Cascade: 0.5, Citra: 1 },
  yeast: { K97: 80 },
  adj: { Lactose: 4, Whirlfloc: 0.1 },
};

const recipe = {
  m: [["2-Row", 100], ["White Wheat", 50]],
  h: [["Cascade", 10, "boil", 60], ["Cascade", 30, "dryhop", 0], ["Citra", 20, "dryhop", 0]],
  y: [["K97", 1]],
  a: [["Lactose", 5, "lbs", "boil", 5], ["Whirlfloc", 10, "each", "boil", 15]],
  sa: [["CaCl2", 100, "mash"]],
};

// 100×1 + 50×2 = 200 malt; (10+30)×0.5 + 20×1 = 40 hop; 80 yeast;
// 5×4 + 10×0.1 = 21 adj  →  341 total
const TOTAL = 341;

describe("parseVolume", () => {
  it("reads the shapes a free-text yield field actually holds", () => {
    expect(parseVolume("150")).toBe(150);
    expect(parseVolume("150 gal")).toBe(150);
    expect(parseVolume("150gal")).toBe(150);
    expect(parseVolume(" 4.8 bbl ")).toBeCloseTo(148.8, 6);
    expect(parseVolume("5 barrels")).toBe(155);
    expect(parseVolume(150)).toBe(150);
  });

  it("returns null rather than guessing when there is no number", () => {
    expect(parseVolume("")).toBeNull();
    expect(parseVolume("about a full kettle")).toBeNull();
    expect(parseVolume(null)).toBeNull();
    expect(parseVolume(undefined)).toBeNull();
    expect(parseVolume("0")).toBeNull();
    expect(parseVolume("-5 gal")).toBeNull();
  });
});

describe("priceMapFrom", () => {
  it("lifts cost-per-unit off inventory rows", () => {
    const map = priceMapFrom({
      malts: [{ n: "2-Row", q: 5, cpu: 0.72 }],
      hops: [{ n: "Citra", q: 3, cpu: 0.87 }],
      yeast: [{ n: "K97", q: 1 }],       // no cpu yet
      adj: [{ n: "Lactose", q: 0, cpu: 1.33, u: "lbs" }],
    });
    expect(map.malt["2-Row"]).toBe(0.72);
    expect(map.hop.Citra).toBe(0.87);
    expect(map.yeast.K97).toBeNull();
    expect(map.adj.Lactose).toBe(1.33);
  });
});

describe("computeRecipeCost", () => {
  const run = (over = {}) =>
    computeRecipeCost({ recipe, priceMap, postBoilGal: 150, lossPct: 33, ...over });

  it("totals a batch and splits it by category", () => {
    const r = run();
    expect(r.byCategory).toEqual({ malt: 200, hop: 40, yeast: 80, adj: 21 });
    expect(r.total).toBe(TOTAL);
    expect(r.missing).toEqual([]);
  });

  it("folds an ingredient used at several stages into one line", () => {
    const cascade = run().lines.filter(l => l.name === "Cascade");
    expect(cascade).toHaveLength(1);
    expect(cascade[0].qty).toBe(40); // 10 boil + 30 dry hop
    expect(cascade[0].cost).toBe(20);
  });

  it("carries each line's own unit", () => {
    const by = Object.fromEntries(run().lines.map(l => [l.name, l.unit]));
    expect(by).toMatchObject({ "2-Row": "lb", Cascade: "oz", K97: "pack", Lactose: "lbs", Whirlfloc: "each" });
  });

  it("excludes water salts", () => {
    expect(run().lines.some(l => l.name === "CaCl2")).toBe(false);
  });

  it("derives packaged volume, kegs, and per-unit costs", () => {
    const r = run();
    expect(r.packagedGal).toBeCloseTo(100.5, 6);   // 150 × 0.67
    expect(r.packagedBbl).toBeCloseTo(3.2419, 4);
    expect(r.kegs).toBeCloseTo(6.484, 3);          // matches the measured ~6.5
    expect(r.costPerBbl).toBeCloseTo(TOTAL / 3.24193, 3);
    expect(r.costPerKeg).toBeCloseTo(r.costPerBbl / 2, 10);
  });

  it("doubles the total for a double batch but leaves cost per bbl alone", () => {
    const single = run();
    const double = run({ dbl: true });
    expect(double.total).toBe(single.total * 2);
    expect(double.kegs).toBeCloseTo(single.kegs * 2, 10);
    expect(double.costPerBbl).toBeCloseTo(single.costPerBbl, 10);
  });

  // The core contract: an unpriced ingredient must not be costed at $0.
  describe("unpriced ingredients", () => {
    const withUnpriced = {
      ...recipe,
      m: [...recipe.m, ["Unpriced Malt", 25], ["Never Heard Of It", 10]],
    };

    it("reports them instead of silently costing them at zero", () => {
      const r = run({ recipe: withUnpriced });
      expect(r.missing.map(m => m.name)).toEqual(["Unpriced Malt", "Never Heard Of It"]);
      expect(r.total).toBe(TOTAL); // unchanged — they are excluded, not zeroed
    });

    it("still lists them so the UI can show the gap", () => {
      const line = run({ recipe: withUnpriced }).lines.find(l => l.name === "Unpriced Malt");
      expect(line).toMatchObject({ qty: 25, unit: "lb", costPerUnit: null, cost: null });
    });

    it("scales an unpriced quantity with a double batch", () => {
      const r = run({ recipe: withUnpriced, dbl: true });
      expect(r.missing.find(m => m.name === "Unpriced Malt").qty).toBe(50);
    });
  });

  describe("without a usable volume", () => {
    it("still totals, but reports no per-bbl figure", () => {
      for (const postBoilGal of [null, undefined, 0, -10, NaN]) {
        const r = run({ postBoilGal });
        expect(r.total).toBe(TOTAL);
        expect(r.costPerBbl).toBeNull();
        expect(r.costPerKeg).toBeNull();
        expect(r.kegs).toBeNull();
      }
    });

    it("treats a 100% loss as no packaged beer rather than a divide by zero", () => {
      const r = run({ lossPct: 100 });
      expect(r.costPerBbl).toBeNull();
      expect(Number.isNaN(r.costPerBbl)).toBe(false);
    });
  });

  it("survives an empty or malformed recipe", () => {
    expect(computeRecipeCost({ recipe: {}, priceMap, postBoilGal: 150 }).total).toBe(0);
    expect(computeRecipeCost({ recipe: null, priceMap, postBoilGal: 150 }).total).toBe(0);
    const junk = { m: [null, ["Ghost", "not a number"], ["2-Row", 10]] };
    expect(computeRecipeCost({ recipe: junk, priceMap, postBoilGal: 150 }).total).toBe(10);
  });
});
