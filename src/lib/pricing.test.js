import { describe, it, expect } from "vitest";
import { convert, normalizeUnit, unitsPerPack, costPerUnit, PACK_GRAMS } from "./pricing";

// Prices here are FABRICATED round numbers, never real vendor prices: BSG marks
// its price lists confidential and this repo is public. What is under test is the
// unit conversion, not any particular dollar figure — round inputs make the
// expected values checkable by eye.

describe("normalizeUnit", () => {
  it("folds the spellings that actually appear in recipe + catalog data", () => {
    expect(normalizeUnit("lbs")).toBe("lb");
    expect(normalizeUnit("L")).toBe("l");
    expect(normalizeUnit(" Each ")).toBe("each");
    expect(normalizeUnit("packs")).toBe("pack");
  });
  it("returns null for absent units", () => {
    expect(normalizeUnit(null)).toBeNull();
    expect(normalizeUnit("")).toBeNull();
  });
});

describe("convert", () => {
  it("converts within mass", () => {
    expect(convert(1, "lb", "oz")).toBeCloseTo(16, 10);
    expect(convert(1, "kg", "g")).toBe(1000);
    expect(convert(25, "kg", "lb")).toBeCloseTo(55.1156, 3);
  });

  it("converts within volume", () => {
    expect(convert(1, "L", "ml")).toBe(1000);
    expect(convert(1, "gal", "ml")).toBeCloseTo(3785.41, 1);
  });

  it("treats a yeast pack as 500 g", () => {
    expect(convert(1, "pack", "g")).toBe(PACK_GRAMS);
    expect(convert(500, "g", "pack")).toBe(1);
  });

  // The guard that keeps a nonsense conversion from becoming a plausible price.
  it("returns null across dimensions and for countable units", () => {
    expect(convert(1, "lb", "ml")).toBeNull();
    expect(convert(1, "each", "g")).toBeNull();
  });
});

describe("unitsPerPack", () => {
  it("counts recipe units in a vendor pack", () => {
    // 55 lb sack of malt, recipe measures lbs
    expect(unitsPerPack({ packQty: 55, packUnit: "lb" }, "lb")).toBe(55);
    // 11 lb box of hops, recipe measures oz
    expect(unitsPerPack({ packQty: 11, packUnit: "lb" }, "oz")).toBeCloseTo(176, 10);
    // 500 g brick of yeast is exactly one pitch
    expect(unitsPerPack({ packQty: 500, packUnit: "g" }, "pack")).toBe(1);
  });

  it("counts tablets when the product says what one weighs", () => {
    // Whirlfloc T: 5 lb tub of 2.5 g tablets
    const whirlfloc = { packQty: 5, packUnit: "lb", unitMass: { qty: 2.5, unit: "g" } };
    expect(unitsPerPack(whirlfloc, "each")).toBeCloseTo(907.18, 1);
  });

  // Ghost peppers: bought and used as a pack, never weighed. A pack already
  // counted in "each" needs no mass — only a pack sold by weight does.
  it("passes through a pack already counted in each", () => {
    expect(unitsPerPack({ packQty: 1, packUnit: "each" }, "each")).toBe(1);
  });

  it("refuses to invent a count without a unit mass", () => {
    expect(unitsPerPack({ packQty: 5, packUnit: "lb" }, "each")).toBeNull();
  });
});

describe("costPerUnit", () => {
  it("prices a per-lb product straight through", () => {
    const malt = { packQty: 1, packUnit: "lb", price: 2 };
    expect(costPerUnit(malt, "lb")).toBe(2);
  });

  it("prices per oz from a per-lb price", () => {
    const hop = { packQty: 1, packUnit: "lb", price: 16 };
    expect(costPerUnit(hop, "oz")).toBe(1);
  });

  it("prices a 55 lb sack sold by the pack", () => {
    const sack = { packQty: 55, packUnit: "lb", price: 110 };
    expect(costPerUnit(sack, "lb")).toBe(2);
  });

  it("crosses the metric boundary (kg pack, lb recipe)", () => {
    const syrup = { packQty: 25, packUnit: "kg", price: 100 };
    expect(costPerUnit(syrup, "lb")).toBeCloseTo(1.81437, 4);
  });

  it("prices a 500 g brick as one pack", () => {
    const yeast = { packQty: 500, packUnit: "g", price: 80 };
    expect(costPerUnit(yeast, "pack")).toBe(80);
  });

  it("prices per ml from a 1 L pack", () => {
    const enzyme = { packQty: 1, packUnit: "L", price: 50 };
    expect(costPerUnit(enzyme, "ml")).toBeCloseTo(0.05, 8);
  });

  it("prices a tub of tablets per tablet", () => {
    const tablets = { packQty: 5, packUnit: "lb", price: 90.0, unitMass: { qty: 2.5, unit: "g" } };
    expect(costPerUnit(tablets, "each")).toBeCloseTo(0.09921, 5);
  });

  // The whole point of the null contract: an unpriced ingredient must stay
  // unpriced, so the UI can flag it instead of quietly costing it at $0.
  it("returns null rather than zero when there is no price", () => {
    expect(costPerUnit({ packQty: 1, packUnit: "lb", price: null }, "lb")).toBeNull();
    expect(costPerUnit(null, "lb")).toBeNull();
  });

  it("returns null when the units cannot reconcile", () => {
    expect(costPerUnit({ packQty: 5, packUnit: "lb", price: 20 }, "ml")).toBeNull();
    expect(costPerUnit({ packQty: 5, packUnit: "lb", price: 20 }, "each")).toBeNull();
  });
});
