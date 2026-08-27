import { describe, it, expect } from "vitest";
import { bucketOf, catalogCounts, matchesQuery, searchCatalog } from "./catalogSearch";

// Real names, fabricated prices — same rule as every other file that touches a
// vendor list. (These rows carry no price at all; search doesn't read one.)
const CATALOG = [
  { sku: "MRAH1190", name: "Rahr North Star Pils™", vendor: "Rahr", category: "malt" },
  { sku: "MGAM1016", name: "Gambrinus Munich Light", vendor: "Gambrinus", category: "malt" },
  { sku: "BZZZ1971", name: "Fermentis SafAle™ K-97 - 500 g", vendor: null, category: "yeast" },
  { sku: "AZZZ4101", name: "Honey - Clover (USA) - 60 lb", vendor: null, category: null },
  { sku: "XZZZ0100", name: "Xtratuf Boots", vendor: null, category: "other" },
];

describe("matchesQuery", () => {
  it("searches the name, the vendor and the SKU — a brewer arrives with any one", () => {
    expect(matchesQuery(CATALOG[0], "north star")).toBe(true);
    expect(matchesQuery(CATALOG[0], "rahr")).toBe(true);
    expect(matchesQuery(CATALOG[0], "MRAH1190")).toBe(true);
  });

  it("takes the terms in any order", () => {
    expect(matchesQuery(CATALOG[0], "pils rahr")).toBe(true);
    expect(matchesQuery(CATALOG[0], "rahr pils")).toBe(true);
  });

  it("needs every term to match, so a second word narrows", () => {
    expect(matchesQuery(CATALOG[0], "rahr munich")).toBe(false);
  });

  it("matches everything when nothing is typed", () => {
    expect(matchesQuery(CATALOG[0], "")).toBe(true);
    expect(matchesQuery(CATALOG[0], "   ")).toBe(true);
  });
});

describe("bucketOf", () => {
  // The ~311 rows classify() declined to guess at are a bucket of their own,
  // not an absence: leaving them cautious is the point, and hiding them would
  // make that caution look like data loss.
  it("browses an unclassified row as `unsorted`", () => {
    expect(bucketOf(CATALOG[3])).toBe("unsorted");
    expect(bucketOf(CATALOG[0])).toBe("malt");
  });
});

describe("catalogCounts", () => {
  it("counts every bucket over the whole catalog, for the chips", () => {
    expect(catalogCounts(CATALOG)).toEqual({ malt: 2, yeast: 1, unsorted: 1, other: 1, total: 5 });
  });
});

describe("searchCatalog", () => {
  it("hides equipment and merchandise until asked for everything", () => {
    expect(searchCatalog(CATALOG, { query: "boots" })).toEqual([]);
    expect(searchCatalog(CATALOG, { query: "boots", showAll: true }).map((e) => e.sku)).toEqual(["XZZZ0100"]);
  });

  it("still reaches `other` when that bucket is asked for by name", () => {
    expect(searchCatalog(CATALOG, { category: "other" }).map((e) => e.sku)).toEqual(["XZZZ0100"]);
  });

  it("filters to one bucket, unsorted included", () => {
    expect(searchCatalog(CATALOG, { category: "malt" }).map((e) => e.sku)).toEqual(["MGAM1016", "MRAH1190"]);
    expect(searchCatalog(CATALOG, { category: "unsorted" }).map((e) => e.sku)).toEqual(["AZZZ4101"]);
  });

  // The same comparator every list in this app sorts by, so scanning the
  // catalog reads like scanning the shelf.
  it("reads alphabetically", () => {
    expect(searchCatalog(CATALOG, {}).map((e) => e.name)).toEqual([
      "Fermentis SafAle™ K-97 - 500 g",
      "Gambrinus Munich Light",
      "Honey - Clover (USA) - 60 lb",
      "Rahr North Star Pils™",
    ]);
  });

  // ⚠️ Found by opening the browser from the Adjuncts table and seeing NOTHING.
  // classify() only ever names malt, yeast and `other`, so every hop and
  // adjunct on a BSG list sits in `unsorted` — 311 of the 563 rows, including
  // the mango purée and the honey. A locked browser that showed only its own
  // bucket would be permanently empty for two of the four tables.
  it("takes the unsorted pile along when locked to one table", () => {
    expect(searchCatalog(CATALOG, { lockedTo: "adj" }).map((e) => e.sku)).toEqual(["AZZZ4101"]);
    expect(searchCatalog(CATALOG, { lockedTo: "malt" }).map((e) => e.sku))
      .toEqual(["MGAM1016", "AZZZ4101", "MRAH1190"]);
  });

  it("still lets a chip narrow a locked browser to one bucket", () => {
    expect(searchCatalog(CATALOG, { lockedTo: "malt", category: "malt" }).map((e) => e.sku))
      .toEqual(["MGAM1016", "MRAH1190"]);
  });

  it("never lets equipment into a locked browser", () => {
    expect(searchCatalog(CATALOG, { lockedTo: "adj", query: "boots", showAll: true })).toEqual([]);
  });

  it("survives an empty or missing catalog", () => {
    expect(searchCatalog(undefined, { query: "pils" })).toEqual([]);
  });
});
