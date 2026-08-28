import { describe, it, expect } from "vitest";
import { blockers, costAllRecipes, sortRows, summarize } from "./analytics";

// Fabricated round prices (real vendor pricing stays out of this repo), picked
// so every expected total is checkable by hand.
const inv = {
  malts: [
    { n: "2-Row", q: 0, cpu: 1 },
    { n: "White Wheat", q: 0, cpu: 2 },
    { n: "Munich", q: 0, cpu: 3, archived: true },
    { n: "Unpriced Malt", q: 0 },
  ],
  hops: [{ n: "Cascade", q: 0, cpu: 0.5 }],
  yeast: [{ n: "K97", q: 0, cpu: 80 }],
  adj: [],
};

// 150 gal less 33% loss = 100.5 gal = 3.2419 bbl.
const settings = { postBoilYield: 150, lossPct: 33 };

// $100 malt + $10 hop + $80 yeast = $190
const cheap = { n: "Table Beer", s: "Bitter", m: [["2-Row", 100]], h: [["Cascade", 20, "boil", 60]], y: [["K97", 1]], a: [] };
// $200 + $100 malt + $80 = $380
const dear = { n: "Big Wheat", s: "Weizen", m: [["2-Row", 200], ["White Wheat", 50]], h: [], y: [["K97", 1]], a: [] };
const gappy = { n: "Gappy IPA", s: "IPA", m: [["2-Row", 100], ["Unpriced Malt", 50]], h: [], y: [], a: [] };
const shell = { n: "Just An Idea", s: "", m: [], h: [], y: [], a: [] };

const run = (recs) => costAllRecipes({ recs, ...inv, settings });

describe("costAllRecipes", () => {
  it("costs every recipe and defaults to alphabetical order", () => {
    const { rows } = run([cheap, dear, gappy]);
    expect(rows.map((r) => r.name)).toEqual(["Big Wheat", "Gappy IPA", "Table Beer"]);
  });

  it("reports the same figures the recipe's own Cost panel would", () => {
    const { rows } = run([cheap]);
    const [row] = rows;
    expect(row.total).toBe(190);
    // 190 / 3.2419 bbl = 58.60, rounded up
    expect(row.costPerBbl).toBe(58.61);
    expect(row.costPerKeg).toBe(29.31);
    expect(row.costPerPint).toBe(0.24);
    expect(row.kegs).toBeCloseTo(6.4839, 3);
  });

  it("keeps each row's stored index, so a caller can open that recipe", () => {
    const { rows } = run([dear, cheap]);
    expect(rows.find((r) => r.name === "Big Wheat").index).toBe(0);
    expect(rows.find((r) => r.name === "Table Beer").index).toBe(1);
  });

  it("costs each recipe against its own yield, not one shared volume", () => {
    // 5 kegs off the same 150 gal kettle is a bigger loss, so a dearer bbl.
    const lowYield = { ...cheap, n: "Low Yield", process: { avgKegs: "5" } };
    const { rows } = run([cheap, lowYield]);
    const base = rows.find((r) => r.name === "Table Beer");
    const low = rows.find((r) => r.name === "Low Yield");
    expect(low.kegs).toBeCloseTo(5, 6);
    expect(low.total).toBe(base.total);
    expect(low.costPerBbl).toBeGreaterThan(base.costPerBbl);
  });

  it("marks a recipe with an unpriced ingredient incomplete, and still shows the floor", () => {
    const { rows } = run([gappy]);
    const [row] = rows;
    expect(row.complete).toBe(false);
    expect(row.missingCount).toBe(1);
    expect(row.missing[0].name).toBe("Unpriced Malt");
    // The priced half is still reported — it is a floor, not a blank.
    expect(row.total).toBe(100);
  });

  it("flags an empty recipe rather than calling it a beer that costs nothing", () => {
    const { rows } = run([shell]);
    expect(rows[0].empty).toBe(true);
    expect(rows[0].complete).toBe(false);
    expect(rows[0].total).toBe(0);
  });

  it("names an untitled recipe the way the picker does", () => {
    const { rows } = run([{ ...cheap, n: "   " }]);
    expect(rows[0].name).toBe("(untitled)");
  });

  // Archiving says "we stopped buying it", not "it was free" — same rule
  // computeOrder() keeps.
  it("prices an archived ingredient like any other", () => {
    const withArchived = { n: "Old Stock", m: [["Munich", 10]], h: [], y: [], a: [] };
    const { rows } = run([withArchived]);
    expect(rows[0].complete).toBe(true);
    expect(rows[0].total).toBe(30);
  });

  it("survives a recipe missing its ingredient arrays entirely", () => {
    const { rows } = run([{ n: "Sparse" }]);
    expect(rows[0].empty).toBe(true);
  });
});

describe("summarize", () => {
  it("averages only the fully priced recipes and says how many that was", () => {
    const { summary } = run([cheap, dear, gappy, shell]);
    expect(summary.recipes).toBe(4);
    expect(summary.counted).toBe(2);
    expect(summary.incomplete).toBe(1);
    expect(summary.empty).toBe(1);
    expect(summary.avgBatch).toBe(285); // (190 + 380) / 2
  });

  it("names the cheapest and priciest beer per bbl", () => {
    const { summary } = run([cheap, dear, gappy]);
    expect(summary.cheapest.name).toBe("Table Beer");
    expect(summary.priciest.name).toBe("Big Wheat");
  });

  it("returns nulls rather than zeros when nothing is costable", () => {
    const { summary } = run([gappy, shell]);
    expect(summary.counted).toBe(0);
    expect(summary.avgCostPerBbl).toBeNull();
    expect(summary.cheapest).toBeNull();
    expect(summary.priciest).toBeNull();
  });

  it("handles an empty book", () => {
    expect(summarize([])).toMatchObject({ recipes: 0, counted: 0, avgBatch: null });
  });
});

describe("blockers", () => {
  it("ranks unpriced ingredients by how many beers they block", () => {
    const other = { ...gappy, n: "Second Gap" };
    const one = { n: "Lone Gap", m: [], h: [], y: [], a: [["Mystery", 1, "each", "boil", 0]] };
    const { blockers: b } = run([gappy, other, one]);
    expect(b[0]).toMatchObject({ name: "Unpriced Malt", category: "malt" });
    expect(b[0].recipes).toEqual(["Gappy IPA", "Second Gap"]);
    expect(b[1]).toMatchObject({ name: "Mystery", category: "adj" });
  });

  it("counts a recipe once for an ingredient used at several stages", () => {
    const twice = {
      n: "Double Dose",
      m: [], y: [], a: [],
      h: [["Mystery Hop", 2, "boil", 60], ["Mystery Hop", 4, "dryhop1", 0]],
    };
    const { blockers: b } = run([twice]);
    expect(b).toHaveLength(1);
    expect(b[0].recipes).toEqual(["Double Dose"]);
  });

  it("is empty when everything prices", () => {
    expect(blockers(run([cheap, dear]).rows)).toEqual([]);
  });
});

describe("sortRows", () => {
  const rows = [
    { name: "Alpha", total: 200, costPerBbl: 60 },
    { name: "Bravo", total: 100, costPerBbl: null },
    { name: "Charlie", total: 300, costPerBbl: 40 },
  ];

  it("sorts by a money column in both directions", () => {
    expect(sortRows(rows, "total", "asc").map((r) => r.name)).toEqual(["Bravo", "Alpha", "Charlie"]);
    expect(sortRows(rows, "total", "desc").map((r) => r.name)).toEqual(["Charlie", "Alpha", "Bravo"]);
  });

  // A recipe with no volume has no cost per bbl. Floating it to the top of an
  // ascending sort would read as the cheapest beer in the book.
  it("keeps unknown figures last whichever way the column is sorted", () => {
    expect(sortRows(rows, "costPerBbl", "asc").map((r) => r.name)).toEqual(["Charlie", "Alpha", "Bravo"]);
    expect(sortRows(rows, "costPerBbl", "desc").map((r) => r.name)).toEqual(["Alpha", "Charlie", "Bravo"]);
  });

  it("breaks ties by name rather than arbitrarily", () => {
    const tied = [{ name: "Zulu", total: 10 }, { name: "Alpha", total: 10 }];
    expect(sortRows(tied, "total", "desc").map((r) => r.name)).toEqual(["Alpha", "Zulu"]);
  });

  it("does not mutate the rows it was given", () => {
    const before = rows.map((r) => r.name);
    sortRows(rows, "total", "desc");
    expect(rows.map((r) => r.name)).toEqual(before);
  });
});
