import { describe, it, expect, vi } from "vitest";
import { addIngredient, newRow } from "./recipeRows";

describe("newRow", () => {
  it("builds each category's tuple shape", () => {
    expect(newRow("m", "Pils")).toEqual(["Pils", 0]);
    expect(newRow("y", "US-05")).toEqual(["US-05", 0]);
    expect(newRow("h", "Citra")).toEqual(["Citra", 0, "boil", 0]);
    expect(newRow("sa", "CaCl2")).toEqual(["CaCl2", 0, "mash"]);
  });

  it("takes an adjunct's unit from the built-in catalog", () => {
    expect(newRow("a", "Honey")).toEqual(["Honey", 0, "lbs", "boil", 0]);
  });

  // An ingredient adopted from the vendor catalog is in no built-in list, and
  // the brewer already answered this in the adopt dialog. Defaulting it to
  // "each" would put a unit on the recipe row that disagrees with the one on
  // the inventory row the price is stored against.
  it("prefers a unit passed in, for an ingredient adjUnits has never heard of", () => {
    expect(newRow("a", "Clover Honey", "lbs")).toEqual(["Clover Honey", 0, "lbs", "boil", 0]);
    expect(newRow("a", "Clover Honey")).toEqual(["Clover Honey", 0, "each", "boil", 0]);
  });
});

describe("addIngredient", () => {
  const recipes = [{ n: "Pale", m: [["2-Row", 100]] }, { n: "Stout", m: [] }];

  it("appends to the named recipe only", () => {
    const setRecs = vi.fn((fn) => fn(recipes));
    addIngredient(setRecs, 1, "m", "Munich Light");
    expect(setRecs.mock.results[0].value).toEqual([
      { n: "Pale", m: [["2-Row", 100]] },
      { n: "Stout", m: [["Munich Light", 0]] },
    ]);
  });

  it("creates the category array when a stale recipe has none", () => {
    const setRecs = vi.fn((fn) => fn([{ n: "Old" }]));
    addIngredient(setRecs, 0, "h", "Citra");
    expect(setRecs.mock.results[0].value[0].h).toEqual([["Citra", 0, "boil", 0]]);
  });

  it("does nothing without a name", () => {
    const setRecs = vi.fn();
    addIngredient(setRecs, 0, "m", "");
    expect(setRecs).not.toHaveBeenCalled();
  });
});
