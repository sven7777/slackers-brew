import { describe, it, expect } from "vitest";
import { products, productsBySku, defaultProductMap, categoryUnit, UNPRICEABLE } from "./products";
import { unitsPerPack } from "./pricing";
import { defMalts, defHops, defYeast, defAdj, adjUnits } from "./defaults";

// This file guards the catalog's *shape*, not any dollar figure — real vendor
// prices are deliberately absent from the repo (see the note in products.js) and
// live only in the private database.

describe("catalog integrity", () => {
  const catalogNames = {
    malt: defMalts.map(m => m[0]),
    hop: defHops.map(h => h[0]),
    yeast: defYeast.map(y => y[0]),
    adj: defAdj.map(a => a[0]),
  };

  it.each(Object.keys(catalogNames))("maps every %s in the ingredient catalog", (cat) => {
    expect(new Set(Object.keys(defaultProductMap[cat]))).toEqual(new Set(catalogNames[cat]));
  });

  it("only points at products that exist", () => {
    for (const [cat, map] of Object.entries(defaultProductMap)) {
      for (const [name, sku] of Object.entries(map)) {
        if (sku === null) continue;
        expect(productsBySku[sku], `${cat}/${name} → ${sku}`).toBeDefined();
      }
    }
  });

  it("has no duplicate SKUs", () => {
    const skus = products.map(p => p.sku);
    expect(skus.length).toBe(new Set(skus).size);
  });

  it("gives every product a usable pack size", () => {
    for (const p of products) {
      expect(p.packQty, p.name).toBeGreaterThan(0);
      expect(p.packUnit, p.name).toBeTruthy();
    }
  });

  // Committing a price would leak confidential vendor pricing to a public repo.
  // This is the tripwire for that, in case a future edit adds one back.
  it("carries no prices", () => {
    for (const p of products) {
      expect(p, p.name).not.toHaveProperty("price");
    }
  });
});

// A mapping is only useful if the vendor pack can actually be divided into the
// unit the recipe counts in. This catches a bad pairing (a tub of tablets with
// no tablet weight, a litre priced against pounds) at build time rather than as
// a mysteriously missing cost line later.
describe("every mapping resolves to a countable unit", () => {
  const unitFor = (cat, name) => cat === "adj" ? adjUnits[name] : categoryUnit[cat];

  it("converts each mapped product into its recipe unit", () => {
    const unresolved = [];
    for (const [cat, map] of Object.entries(defaultProductMap)) {
      for (const [name, sku] of Object.entries(map)) {
        if (sku === null) { unresolved.push(`${cat}/${name}`); continue; }
        const per = unitsPerPack(productsBySku[sku], unitFor(cat, name));
        expect(per, `${cat}/${name}`).not.toBeNull();
        expect(per, `${cat}/${name}`).toBeGreaterThan(0);
      }
    }
    // Pinning the list means adding a fifth unsourced ingredient — or quietly
    // dropping a mapping — fails here instead of showing up as a low COGS.
    expect(unresolved.sort()).toEqual(UNPRICEABLE);
  });

  it("divides a tub of Whirlfloc into tablets", () => {
    const whirlfloc = productsBySku[defaultProductMap.adj["Whirlfloc"]];
    expect(unitsPerPack(whirlfloc, "each")).toBeCloseTo(907.18, 1);
  });

  it("points Midnight Wheat and Carafa Special III at the same sack", () => {
    expect(defaultProductMap.malt["Midnight Wheat"])
      .toBe(defaultProductMap.malt["Carafa Special III"]);
  });
});
