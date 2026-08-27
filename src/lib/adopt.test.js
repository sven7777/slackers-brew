import { describe, it, expect } from "vitest";
import {
  adoptedRow, derivedCost, findDuplicate, packBase, packLabel, packSiblings,
  suggestName, suggestUnit,
} from "./adopt";

// ⚠️ Fabricated prices only — real vendor prices never enter this repo (BSG
// marks its lists confidential and this repo is public). The NAMES are real:
// every one below is a row that appears on a BSG Houston list, because the
// names are what these rules are about.

const entry = (over = {}) => ({
  sku: "MRAH1190", name: "Rahr North Star Pils™", vendor: "Rahr", category: "malt",
  price: 1, packQty: 1, packUnit: "lb", effective: "2026-08-24", ...over,
});

describe("suggestName", () => {
  it("drops the vendor prefix the SKU already tells us", () => {
    expect(suggestName(entry())).toBe("North Star Pils");
    expect(suggestName(entry({ sku: "MGAM1016", name: "Gambrinus Munich Light", vendor: "Gambrinus" })))
      .toBe("Munich Light");
  });

  it("drops trademark marks, which no brew sheet wants", () => {
    expect(suggestName(entry({ name: "Weyermann® CARAFA® Special Type 3 (Dehusked)", vendor: "Weyermann" })))
      .toBe("CARAFA Special Type 3 (Dehusked)");
  });

  it("drops the pack size, which is a purchase detail and not a name", () => {
    expect(suggestName(entry({ sku: "BZZZ1971", name: "Fermentis SafAle™ K-97 - 500 g", vendor: null })))
      .toBe("Fermentis SafAle K-97");
  });

  // The suggestion saves typing; it must not make judgements. "The Brewer's
  // Standard 2-Row" is what the vendor calls it, and only Slackers knows that
  // what they call it is "2-Row" — so the field it fills is editable.
  it("leaves everything else alone, including a brand inside the name", () => {
    expect(suggestName(entry({ sku: "MRAH1102", name: "Rahr The Brewer's Standard™ 2-Row" })))
      .toBe("The Brewer's Standard 2-Row");
  });

  it("survives a row with no name at all", () => {
    expect(suggestName({})).toBe("");
    expect(suggestName(null)).toBe("");
  });
});

describe("packSiblings", () => {
  // One product, two SKUs, and the difference is the whole reason the dialog
  // asks: a 500 g brick is one pitch and a 100 g one is a fifth of a pitch.
  const k97 = entry({ sku: "BZZZ1971", name: "Fermentis SafAle™ K-97 - 500 g", vendor: null, category: "yeast", packQty: 500, packUnit: "g" });
  const k97small = entry({ sku: "BZZZ2130", name: "Fermentis SafAle™ K-97 - 100 g", vendor: null, category: "yeast", packQty: 100, packUnit: "g" });
  const other = entry({ sku: "BZZZ1972", name: "Fermentis SafAle™ S-04 - 500 g", vendor: null, category: "yeast", packQty: 500, packUnit: "g" });

  it("groups the same product across its pack sizes, smallest first", () => {
    expect(packSiblings([k97, other, k97small], k97).map((e) => e.sku))
      .toEqual(["BZZZ2130", "BZZZ1971"]);
  });

  it("does not group two different products", () => {
    expect(packSiblings([k97, other], other).map((e) => e.sku)).toEqual(["BZZZ1972"]);
  });

  it("sorts a pack it couldn't read last — it's the one to think twice about", () => {
    const unreadable = entry({ sku: "BZZZ9999", name: "Fermentis SafAle™ K-97", vendor: null, packQty: null, packUnit: null });
    expect(packSiblings([unreadable, k97], k97).map((e) => e.sku)).toEqual(["BZZZ1971", "BZZZ9999"]);
  });

  it("ignores trademarks and case when grouping", () => {
    expect(packBase("Weyermann® Sinamar® - 5.9 kg")).toBe(packBase("weyermann sinamar - 25 kg"));
  });
});

describe("packLabel", () => {
  it("never prints an unknown pack as a size", () => {
    expect(packLabel({ packQty: null })).toBe("pack size not listed");
    expect(packLabel({ packQty: 500, packUnit: "g" })).toBe("500 g");
  });
});

describe("suggestUnit", () => {
  it("uses each category's one unit", () => {
    expect(suggestUnit("malt", entry())).toBe("lb");
    expect(suggestUnit("hop", entry())).toBe("oz");
    expect(suggestUnit("yeast", entry())).toBe("pack");
  });

  it("reads an adjunct's unit off its pack, since adjuncts carry their own", () => {
    expect(suggestUnit("adj", { packUnit: "lb" })).toBe("lbs");
    expect(suggestUnit("adj", { packUnit: "kg" })).toBe("lbs");
    expect(suggestUnit("adj", { packUnit: "L" })).toBe("ml");
    expect(suggestUnit("adj", { packUnit: "gal" })).toBe("ml");
    expect(suggestUnit("adj", { packUnit: "each" })).toBe("each");
  });
});

describe("derivedCost", () => {
  it("converts a vendor pack to the unit the recipe counts in", () => {
    // 500 g brick at a fabricated $80 is one pitch pack; the 100 g one is a
    // fifth of a pitch, so it costs five times as much per pitch.
    expect(derivedCost({ price: 80, packQty: 500, packUnit: "g" }, "pack").cpu).toBe(80);
    expect(derivedCost({ price: 25, packQty: 100, packUnit: "g" }, "pack").cpu).toBe(125);
  });

  it("rounds to the cent, nearest — a price is a quote, not a cost", () => {
    expect(derivedCost({ price: 100, packQty: 3, packUnit: "lb" }, "lb").cpu).toBe(33.33);
  });

  // Each of these must say WHY on screen, before anything is stored. A null
  // discovered later surfaces as an unpriced ingredient in a COGS total, with
  // nothing to say what went wrong.
  it("says why it can't price something rather than costing it at zero", () => {
    expect(derivedCost({ price: null, packQty: 1, packUnit: "lb" }, "lb")).toEqual({ cpu: null, why: "unpriced" });
    expect(derivedCost({ price: 10, packQty: null, packUnit: null }, "lb")).toEqual({ cpu: null, why: "nopack" });
    expect(derivedCost({ price: 10, packQty: 5, packUnit: "gal" }, "lb")).toEqual({ cpu: null, why: "unconvertible" });
  });
});

describe("findDuplicate", () => {
  const inventory = { malts: [{ n: "Carafa Special III", q: 0 }], hops: [], yeast: [], adj: [{ n: "Honey", q: 2, u: "lbs" }] };

  // ⚠️ The Carafa lesson: one sack ended up as three inventory rows because
  // nothing ever asked whether the brewery already stocked it.
  it("finds a name already on the shelf, whatever the case or padding", () => {
    expect(findDuplicate(inventory, "  carafa special iii ")?.category).toBe("malt");
    expect(findDuplicate(inventory, "Honey")?.category).toBe("adj");
  });

  it("looks across every category, not just the one being adopted into", () => {
    expect(findDuplicate(inventory, "Honey")?.item.n).toBe("Honey");
  });

  it("is quiet about a name nobody stocks", () => {
    expect(findDuplicate(inventory, "North Star Pils")).toBeNull();
    expect(findDuplicate(inventory, "  ")).toBeNull();
  });
});

describe("adoptedRow", () => {
  it("lands at quantity zero — adopting says we buy it, not that we have it", () => {
    expect(adoptedRow(entry(), { name: "Pils", category: "malt" }).q).toBe(0);
  });

  it("carries the SKU, which is what makes the next import reprice it", () => {
    const row = adoptedRow(entry(), { name: "Pils", category: "malt" });
    expect(row).toMatchObject({ n: "Pils", sku: "MRAH1190", vendor: "Rahr", cpu: 1, pricedAt: "2026-08-24" });
  });

  it("stores a unit for an adjunct only — every other category has just one", () => {
    expect(adoptedRow(entry({ category: "adj", packQty: 60, packUnit: "lb", price: 120 }),
      { name: "Clover Honey", category: "adj", unit: "lbs" })).toMatchObject({ u: "lbs", cpu: 2 });
    expect(adoptedRow(entry(), { name: "Pils", category: "malt" }).u).toBeUndefined();
  });

  it("falls back to the suggested name rather than storing a blank one", () => {
    expect(adoptedRow(entry(), { name: "   ", category: "malt" }).n).toBe("North Star Pils");
  });

  it("keeps an unpriceable row adoptable, with no price rather than a wrong one", () => {
    expect(adoptedRow(entry({ packQty: null, packUnit: null }), { name: "Nylon Bag", category: "adj" }).cpu).toBeNull();
  });
});
