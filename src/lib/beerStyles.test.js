import { describe, it, expect } from "vitest";
import { styleNames, stylesByCategory } from "./beerStyles";
import { defRecipes } from "./defaults";

describe("beerStyles catalog", () => {
  it("carries the BeerSmith style export", () => {
    expect(styleNames.length).toBe(148);
    expect(new Set(styleNames).size).toBe(styleNames.length);
    // XML entities in the export must arrive decoded, not as "K&ouml;lsch".
    expect(styleNames).toContain("Kölsch");
    expect(styleNames).toContain("Märzen");
    expect(styleNames.some((n) => n.includes("&"))).toBe(false);
  });

  it("groups every style under exactly one category run", () => {
    const flat = stylesByCategory.flatMap((g) => g.names);
    expect(flat).toEqual(styleNames);
    const cats = stylesByCategory.map((g) => g.category);
    expect(new Set(cats).size).toBe(cats.length); // no category split across runs
  });

  // The preset styles were shorthand ("NEIPA", "American Brown") until
  // migration 0010 put them on the catalog. Keep them there: a preset style the
  // picker can't offer shows up as an odd "On this recipe" entry for every new
  // install, and drifts from what prod now holds.
  it("covers every preset recipe's style", () => {
    const off = defRecipes.map((r) => r.s).filter((s) => s && !styleNames.includes(s));
    expect(off).toEqual([]);
  });
});
