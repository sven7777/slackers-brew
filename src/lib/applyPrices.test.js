import { describe, it, expect } from "vitest";
import { readPriceFile, priceRows, applyPrices } from "./applyPrices";
import { defaultProductMap } from "./products";

// Fabricated prices keyed by the real SKUs the catalog maps to. Round numbers
// so the expected cost per unit is checkable by eye; real vendor pricing stays
// out of this repo.
const SKU_2ROW = defaultProductMap.malt["2-Row"];
const SKU_CITRA = defaultProductMap.hop["Citra"];
const SKU_K97 = defaultProductMap.yeast["K97"];
const SKU_CLARITY = defaultProductMap.adj["Clarity Ferm"];

describe("readPriceFile", () => {
  it("reads the wrapped form the seed generator writes", () => {
    const got = readPriceFile({ _note: "ignored", prices: { ABC: { price: 2, effective: "2025-06-19" } } });
    expect(got).toEqual({ ABC: { price: 2, effective: "2025-06-19" } });
  });

  it("reads a bare sku → price map", () => {
    expect(readPriceFile({ ABC: 2 })).toEqual({ ABC: { price: 2, effective: null } });
  });

  it("drops entries with no usable price", () => {
    const got = readPriceFile({ A: { price: null }, B: "free", C: {}, D: { price: 3 } });
    expect(Object.keys(got)).toEqual(["D"]);
  });

  it("survives junk input", () => {
    expect(readPriceFile(null)).toEqual({});
    expect(readPriceFile("nope")).toEqual({});
    expect(readPriceFile([])).toEqual({});
  });
});

describe("priceRows", () => {
  // Prices are stored to the cent so the UI can show two decimals without the
  // displayed price disagreeing with the cost computed from it.
  it("rounds the derived price to the cent", () => {
    const [row] = priceRows("hop", [{ n: "Citra", q: 0 }], { [SKU_CITRA]: { price: 13.99 } });
    expect(row.cpu).toBe(0.87);        // 13.99/16 = 0.874375
    const [malt] = priceRows("malt", [{ n: "2-Row", q: 0 }], { [SKU_2ROW]: { price: 0.724 } });
    expect(malt.cpu).toBe(0.72);
  });

  it("derives cost per recipe unit through the product's pack size", () => {
    const [row] = priceRows("hop", [{ n: "Citra", q: 0 }], { [SKU_CITRA]: { price: 16, effective: "2025-07-01" } });
    expect(row.cpu).toBe(1);           // $16/lb ÷ 16 oz
    expect(row.sku).toBe(SKU_CITRA);
    expect(row.pricedAt).toBe("2025-07-01");
    expect(row.q).toBe(0);             // quantity untouched
  });

  it("prices a 500 g yeast brick as one pack", () => {
    const [row] = priceRows("yeast", [{ n: "K97", q: 2 }], { [SKU_K97]: { price: 80 } });
    expect(row.cpu).toBe(80);
  });

  it("uses the adjunct's own unit", () => {
    const [row] = priceRows("adj", [{ n: "Clarity Ferm", q: 0, u: "ml" }], { [SKU_CLARITY]: { price: 50 } });
    expect(row.cpu).toBeCloseTo(0.05, 8); // $50 per 1 L
  });

  // A partial price list is the normal case — hops and malts arrive on separate
  // lists. Importing one must not blank out what the other already set.
  it("leaves rows alone when the file has no price for them", () => {
    const existing = { n: "Cascade", q: 3, cpu: 0.56, sku: "OLD", pricedAt: "2025-01-01" };
    const [row] = priceRows("hop", [existing], { [SKU_CITRA]: { price: 16 } });
    expect(row).toBe(existing);
  });

  it("leaves unmapped ingredients alone", () => {
    const row = { n: "Something New", q: 1 };
    expect(priceRows("malt", [row], { [SKU_2ROW]: { price: 1 } })[0]).toBe(row);
  });

  it("does not mutate the rows it is given", () => {
    const rows = [{ n: "2-Row", q: 5 }];
    priceRows("malt", rows, { [SKU_2ROW]: { price: 1 } });
    expect(rows[0]).toEqual({ n: "2-Row", q: 5 });
  });
});

describe("applyPrices", () => {
  const inv = {
    malts: [{ n: "2-Row", q: 0 }, { n: "Pils", q: 0 }],
    hops: [{ n: "Citra", q: 0 }],
    yeast: [{ n: "K97", q: 0 }],
    adj: [{ n: "Clarity Ferm", q: 0, u: "ml" }],
  };

  it("prices every category and reports the tally", () => {
    const res = applyPrices(inv, {
      [SKU_2ROW]: { price: 1 },
      [SKU_CITRA]: { price: 16 },
      [SKU_K97]: { price: 80 },
      [SKU_CLARITY]: { price: 50 },
    });
    expect(res.priced).toBe(4);
    expect(res.skipped).toBe(1); // Pils had no price in this file
    expect(res.malts[0].cpu).toBe(1);
    expect(res.hops[0].cpu).toBe(1);
    expect(res.yeast[0].cpu).toBe(80);
    expect(res.adj[0].cpu).toBeCloseTo(0.05, 8);
  });

  it("reports nothing priced for an empty file rather than throwing", () => {
    const res = applyPrices(inv, {});
    expect(res.priced).toBe(0);
    expect(res.skipped).toBe(5);
  });
});
