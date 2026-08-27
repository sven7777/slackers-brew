import { describe, it, expect } from "vitest";
import { buildCatalog, catalogEntry, classify, parsePack, stripPack, vendorFromSku } from "./catalog";

// ⚠️ Fabricated prices only — real vendor prices never enter this repo. The
// NAMES here are real, because the names are what the parsing rules are about:
// every one below is a row that appears on a BSG list, and several are rows an
// earlier draft of these rules got wrong.

describe("vendorFromSku", () => {
  it("reads the vendor code out of a branded SKU", () => {
    expect(vendorFromSku("MWEY1067")).toBe("Weyermann");
    expect(vendorFromSku("MRAH1102")).toBe("Rahr");
    expect(vendorFromSku("MSIM1051")).toBe("Simpsons");
  });

  it("leaves the generic buckets unattributed rather than guessing", () => {
    // BZZZ alone holds 185 rows from a dozen suppliers; the SKU says nothing.
    expect(vendorFromSku("BZZZ1971")).toBeNull();
    expect(vendorFromSku("AZZZ1304")).toBeNull();
  });

  it("survives junk", () => {
    expect(vendorFromSku(null)).toBeNull();
    expect(vendorFromSku("")).toBeNull();
  });
});

describe("classify", () => {
  it("calls the whole M range malt", () => {
    expect(classify({ sku: "MRAH1173", name: "Rahr To Thee! Pils™" })).toBe("malt");
    expect(classify({ sku: "MWEY1072", name: "Weyermann® Acidulated Malt" })).toBe("malt");
  });

  it("recognises dry yeast by brand", () => {
    expect(classify({ sku: "BZZZ1984", name: "Fermentis SafAle™ BE-134 - 500 g" })).toBe("yeast");
    expect(classify({ sku: "BZZ9804Z", name: "Red Star Distillers' Yeast (DADY) - 10 kg" })).toBe("yeast");
  });

  // The two rules that were wrong in an earlier draft. Both are named like
  // yeast and filed beside it, and both are nutrients: classifying them as
  // yeast would offer a nutrient as a pitchable strain.
  it("does NOT call a yeast nutrient yeast", () => {
    expect(classify({ sku: "BZZZ1901", name: "Yeastex® 61 - 5 lb" })).toBeNull();
    expect(classify({ sku: "BZZ8151B", name: "Pathfinder N-Pure Seltzer Nutrient 1kg" })).toBeNull();
    expect(classify({ sku: "BZZ8148B", name: "Pathfinder TY 48 - 1 kg" })).toBeNull();
  });

  it("fences equipment and merchandise off from every ingredient picker", () => {
    expect(classify({ sku: "EZZZ9176", name: "Grainfather G70" })).toBe("other");
    expect(classify({ sku: "XABM0001", name: 'Xtratuf 15" Legacy Mens Boots' })).toBe("other");
  });

  it("declines to classify what the list does not make obvious", () => {
    expect(classify({ sku: "BZZZ1406", name: "Rice Hulls - 50 lb" })).toBeNull();
    expect(classify({ sku: "AZZZ1301", name: "OiO Flaked Barley - 55 lb" })).toBeNull();
  });
});

describe("parsePack", () => {
  it("reads a per-pound quote as a one-pound pack", () => {
    expect(parsePack({ name: "Rahr White Wheat", unit: "price / lb" })).toEqual({ qty: 1, unit: "lb" });
  });

  it("takes the pack size out of the name when the price buys a pack", () => {
    expect(parsePack({ name: "Fermentis SafAle™ BE-134 - 500 g", unit: "each" })).toEqual({ qty: 500, unit: "g" });
    expect(parsePack({ name: "Weyermann® Sinamar® - 5.9 kg", unit: "each" })).toEqual({ qty: 5.9, unit: "kg" });
    expect(parsePack({ name: "Lactose - 55 lb", unit: "each" })).toEqual({ qty: 55, unit: "lb" });
  });

  it("copes with the vendor's spacing and casing", () => {
    expect(parsePack({ name: "Cinnamon (Saigon) 2lb", unit: "each" })).toEqual({ qty: 2, unit: "lb" });
    expect(parsePack({ name: "Elderflower 2Lb", unit: "each" })).toEqual({ qty: 2, unit: "lb" });
    expect(parsePack({ name: "Saniclean PAA Pro - 5 gallon", unit: "each" })).toEqual({ qty: 5, unit: "gal" });
  });

  it("reads through the container the pack ships in", () => {
    expect(parsePack({ name: "Honey - Clover (USA) - 60 lb Pail", unit: "each" })).toEqual({ qty: 60, unit: "lb" });
    expect(parsePack({ name: "Blackstrap Molasses - 3000 lb (Tote)", unit: "each" })).toEqual({ qty: 3000, unit: "lb" });
    expect(parsePack({ name: 'Sugar Maple Medium Toast 1.5"x 9" - 6-pack', unit: "each" })).toEqual({ qty: 6, unit: "each" });
  });

  it("counts a per-100 quote as a hundred-unit pack", () => {
    expect(parsePack({ name: "38mm Polyseal Caps/100", unit: "per 100" })).toEqual({ qty: 100, unit: "each" });
  });

  // The anchor at the end of the name is what makes this work: these rows end
  // in dimensions, not pack sizes, and reading 8" as eight of something would
  // put a nonsense denominator under a price.
  it("returns null rather than mistake dimensions for a pack size", () => {
    expect(parsePack({ name: '1 lb Nylon Bag 11" x 8"', unit: "each" })).toBeNull();
    expect(parsePack({ name: 'Hop Pellet Bag (Fine) 12" x 9"', unit: "each" })).toBeNull();
    expect(parsePack({ name: "Keystone Bung - Plastic", unit: "each" })).toBeNull();
  });
});

describe("catalogEntry", () => {
  it("carries the list's identity onto every row", () => {
    const e = catalogEntry(
      { sku: "MWEY1016", name: "Weyermann® Vienna Malt", unit: "price / lb", price: 1 },
      { source: "Houston", effective: "2026-08-24" },
    );
    expect(e).toEqual({
      sku: "MWEY1016",
      name: "Weyermann® Vienna Malt",
      vendor: "Weyermann",
      category: "malt",
      price: 1,
      packQty: 1,
      packUnit: "lb",
      source: "Houston",
      effective: "2026-08-24",
    });
  });

  it("keeps a row it cannot classify or size, rather than dropping it", () => {
    const e = catalogEntry({ sku: "BZZZ1105", name: "Keystone Bung - Plastic", unit: "each", price: 2 });
    expect(e.category).toBeNull();
    expect(e.packQty).toBeNull();
    expect(e.sku).toBe("BZZZ1105");
  });
});

describe("buildCatalog", () => {
  const rows = [
    { sku: "MRAH1102", name: "Rahr The Brewer’s Standard™ 2-Row", unit: "price / lb", price: 1 },
    { sku: "BZZZ1984", name: "Fermentis SafAle™ BE-134 - 500 g", unit: "each", price: 80 },
    { sku: "EZZZ9176", name: "Grainfather G70", unit: "each", price: 5000 },
    { sku: "BZZZ1105", name: "Keystone Bung - Plastic", unit: "each", price: 2 },
  ];

  it("counts what it classified and what it did not", () => {
    const { entries, counts } = buildCatalog(rows, { source: "Houston" });
    expect(entries).toHaveLength(4);
    expect(counts.total).toBe(4);
    expect(counts.byCategory).toEqual({ malt: 1, yeast: 1, other: 1 });
    expect(counts.unclassified).toBe(1);
    // The bung AND the Grainfather: neither name carries a pack size.
    expect(counts.unpacked).toBe(2);
  });

  it("handles an empty file without inventing anything", () => {
    expect(buildCatalog([]).counts).toEqual({ total: 0, byCategory: {}, unclassified: 0, unpacked: 0 });
    expect(buildCatalog(null).entries).toEqual([]);
  });
});

// Same regex as parsePack, so the suffix read as a pack is always the suffix
// removed. Two things depend on that agreeing: the name suggested by the adopt
// dialog, and the key that groups one product's pack sizes together.
describe("stripPack", () => {
  it("removes the pack the vendor wrote into the name", () => {
    expect(stripPack("Fermentis SafAle™ K-97 - 500 g")).toBe("Fermentis SafAle™ K-97 -");
    expect(stripPack("Alphonso Mango Puree - 44 lb")).toBe("Alphonso Mango Puree -");
    expect(stripPack("Blackstrap Molasses - 3000 lb (Tote)")).toBe("Blackstrap Molasses -");
  });

  it("leaves a name that ends in dimensions alone, exactly as parsePack does", () => {
    expect(stripPack('1 lb Nylon Bag 11" x 8"')).toBe('1 lb Nylon Bag 11" x 8"');
  });

  it("leaves a name with no pack in it alone", () => {
    expect(stripPack("Rahr North Star Pils™")).toBe("Rahr North Star Pils™");
    expect(stripPack(null)).toBe("");
  });
});
