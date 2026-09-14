import { describe, it, expect } from "vitest";
import {
  buildOrderEstimate,
  orderEmailText,
  orderFees,
  orderPackFor,
  parseOrderPack,
  recipeUnitFor,
} from "./orderCost";

// ⚠️ Every price here is fabricated. Real vendor prices must never be
// committed, fixtures included — see products.js.

const inv = (rows) => rows.map((r) => ({ q: 0, ...r }));

describe("parseOrderPack", () => {
  it("reads the sizes products.js actually carries", () => {
    expect(parseOrderPack("55 lb")).toEqual({ qty: 55, unit: "lb" });
    expect(parseOrderPack("44.1 lb")).toEqual({ qty: 44.1, unit: "lb" });
    expect(parseOrderPack("500 g")).toEqual({ qty: 500, unit: "g" });
    expect(parseOrderPack("25 kg")).toEqual({ qty: 25, unit: "kg" });
    expect(parseOrderPack("1 L")).toEqual({ qty: 1, unit: "l" });
  });

  it("reads a bare unit as one of it (honey is bought by the pound)", () => {
    expect(parseOrderPack("lb")).toEqual({ qty: 1, unit: "lb" });
  });

  it("declines prose rather than guessing a size", () => {
    expect(parseOrderPack("pack of 10")).toBeNull();
    expect(parseOrderPack("")).toBeNull();
    expect(parseOrderPack(null)).toBeNull();
  });
});

describe("orderPackFor", () => {
  // ⚠️ The whole point of the module. A malt is QUOTED per pound and SHIPS in a
  // 55 lb sack; costing wants the first and ordering wants the second.
  it("prefers the shipped pack over the priced one", () => {
    expect(orderPackFor({ packQty: 1, packUnit: "lb", orderPack: "55 lb" }))
      .toEqual({ qty: 55, unit: "lb", label: "55lb" });
  });

  it("falls back to the product's own pack, which is all an adopted row has", () => {
    expect(orderPackFor({ packQty: 9, packUnit: "lb" }))
      .toEqual({ qty: 9, unit: "lb", label: "9lb" });
  });

  it("falls back when orderPack is prose", () => {
    expect(orderPackFor({ packQty: 1, packUnit: "each", orderPack: "pack of 10" }))
      .toEqual({ qty: 1, unit: "each", label: "1each" });
  });

  it("returns null rather than assuming a pound", () => {
    expect(orderPackFor({ packQty: null, packUnit: null })).toBeNull();
    expect(orderPackFor(null)).toBeNull();
  });
});

describe("recipeUnitFor", () => {
  it("takes the row's own unit for an adjunct and the category's otherwise", () => {
    expect(recipeUnitFor("malt", { n: "Pils" })).toBe("lb");
    expect(recipeUnitFor("hop", { n: "Saaz" })).toBe("oz");
    expect(recipeUnitFor("yeast", { n: "K97" })).toBe("pack");
    expect(recipeUnitFor("adj", { n: "Clarity Ferm", u: "ml" })).toBe("ml");
    // No unit on the row: fall back to the adjunct catalog's.
    expect(recipeUnitFor("adj", { n: "Lactose" })).toBe("lbs");
  });
});

describe("buildOrderEstimate", () => {
  it("buys whole sacks: 40 lbs of Munich is one 55 lb bag at a bag's price", () => {
    const est = buildOrderEstimate({
      order: { malts: [{ n: "Munich", need: 40, have: 0, order: 40 }], hops: [], yeast: [], adj: [] },
      inventory: { malts: inv([{ n: "Munich", cpu: 1 }]) },
    });
    const [line] = est.sections[0].lines;
    expect(line.packs).toBe(1);
    expect(line.packLabel).toBe("55lb");
    expect(line.packPrice).toBe(55);
    expect(line.cost).toBe(55);
    // NOT 40 × $1: the estimate must not come in under the invoice.
    expect(est.subtotal).toBe(55);
    expect(est.floor).toBe(false);
  });

  it("rounds a part-bag up", () => {
    const est = buildOrderEstimate({
      order: { malts: [{ n: "Munich", order: 56 }], hops: [], yeast: [], adj: [] },
      inventory: { malts: inv([{ n: "Munich", cpu: 1 }]) },
    });
    expect(est.sections[0].lines[0].packs).toBe(2);
    expect(est.subtotal).toBe(110);
  });

  // ⚠️ The SKU is what you order. Midnight Wheat and Carafa Special III are one
  // sack (MWEY1067), so 30 lbs of each is TWO bags of one thing — not one bag
  // of each, which is what aggregating by name would buy.
  it("merges two ingredient names that are one product", () => {
    const est = buildOrderEstimate({
      order: {
        malts: [
          { n: "Midnight Wheat", order: 30 },
          { n: "Carafa Special III", order: 30 },
        ],
        hops: [], yeast: [], adj: [],
      },
      inventory: { malts: inv([{ n: "Midnight Wheat", cpu: 1 }, { n: "Carafa Special III", cpu: 1 }]) },
    });
    expect(est.sections[0].lines).toHaveLength(1);
    const [line] = est.sections[0].lines;
    expect(line.sku).toBe("MWEY1067");
    expect(line.qty).toBe(60);
    expect(line.packs).toBe(2);
    expect(line.name).toBe("Carafa Special III / Midnight Wheat");
  });

  it("crosses units: hops ordered in oz arrive in 11 lb boxes", () => {
    const est = buildOrderEstimate({
      order: { malts: [], hops: [{ n: "Saaz", order: 20 }], yeast: [], adj: [] },
      inventory: { hops: inv([{ n: "Saaz", cpu: 1 }]) },
    });
    const [line] = est.sections[0].lines;
    expect(line.packs).toBe(1); // 11 lb = 176 oz
    expect(line.packLabel).toBe("11lb");
    expect(line.packPrice).toBe(176);
  });

  it("counts yeast in 500 g bricks, one pitch each", () => {
    const est = buildOrderEstimate({
      order: { malts: [], hops: [], yeast: [{ n: "BE-256", order: 2 }], adj: [] },
      inventory: { yeast: inv([{ n: "BE-256", cpu: 30 }]) },
    });
    const [line] = est.sections[0].lines;
    expect(line.packs).toBe(2);
    expect(line.packLabel).toBe("500g");
    expect(line.cost).toBe(60);
  });

  it("crosses a metric pack: 60 lbs of Candi Syrup is two 25 kg boxes", () => {
    const est = buildOrderEstimate({
      order: { malts: [], hops: [], yeast: [], adj: [{ n: "Candi Syrup", order: 60, u: "lbs" }] },
      inventory: { adj: inv([{ n: "Candi Syrup", cpu: 2, u: "lbs" }]) },
    });
    const [line] = est.sections[0].lines;
    expect(line.packs).toBe(2); // 25 kg = 55.12 lb
  });

  // cogs.js's rule, one layer up: an unpriced ingredient is never $0.
  it("leaves an unpriced line out of the subtotal and marks it a floor", () => {
    const est = buildOrderEstimate({
      order: { malts: [{ n: "Munich", order: 40 }, { n: "Pils", order: 40 }], hops: [], yeast: [], adj: [] },
      inventory: { malts: inv([{ n: "Munich", cpu: 1 }, { n: "Pils" }]) },
    });
    expect(est.subtotal).toBe(55);
    expect(est.unpriced).toEqual(["Pils"]);
    expect(est.floor).toBe(true);
    // It still prints, with its pack count — you have to buy it either way.
    expect(est.sections[0].lines.find((l) => l.name === "Pils")).toMatchObject({
      packs: 1, cost: null, reason: "unpriced",
    });
  });

  it("names a row with no product rather than dropping it", () => {
    const est = buildOrderEstimate({
      order: { malts: [], hops: [], yeast: [], adj: [{ n: "Brewzyme D", order: 3, u: "oz" }] },
      inventory: { adj: inv([{ n: "Brewzyme D", u: "oz" }]) },
    });
    const [line] = est.sections[0].lines;
    expect(line.reason).toBe("unmapped");
    expect(line.packs).toBeNull();
    expect(est.nopack).toEqual(["Brewzyme D"]);
    expect(est.floor).toBe(true);
  });

  // ⚠️ The curated-map blind spot: products.js is a shortlist, so anything that
  // enumerates from it drops every adopted ingredient. An adopted row carries
  // its own SKU and the catalog carries its pack.
  it("prices an adopted ingredient through its own sku and the catalog", () => {
    const est = buildOrderEstimate({
      order: { malts: [{ n: "Vienna Malt", order: 30 }], hops: [], yeast: [], adj: [] },
      inventory: { malts: inv([{ n: "Vienna Malt", sku: "MWEY9999", cpu: 1 }]) },
      catalog: { MWEY9999: { sku: "MWEY9999", name: "Weyermann Vienna - 55 lb", packQty: 1, packUnit: "lb" } },
    });
    const [line] = est.sections[0].lines;
    // The catalog only knows the PRICED pack (1 lb), so it orders in pounds and
    // says so — honest, and fixable by giving the product an orderPack.
    expect(line.sku).toBe("MWEY9999");
    expect(line.packs).toBe(30);
    expect(line.cost).toBe(30);
  });

  it("skips ingredients already in stock", () => {
    const est = buildOrderEstimate({
      order: { malts: [{ n: "Munich", need: 40, have: 60, order: 0 }], hops: [], yeast: [], adj: [] },
      inventory: { malts: inv([{ n: "Munich", q: 60, cpu: 1 }]) },
    });
    expect(est.sections).toEqual([]);
    expect(est.subtotal).toBe(0);
  });
});

// ⚠️ Fabricated fee amounts, like every price here. The real ones are off a BSG
// invoice and live only in the private database.
const FEES = {
  costs: { liftgateFee: 20, palletFee: 10, fuelSurcharge: 5, freightFee: 100, orderSalesTax: 1 },
};

describe("orderFees", () => {
  it("totals the five lines in invoice order", () => {
    const f = orderFees(FEES);
    expect(f.lines.map((l) => l.key)).toEqual([
      "liftgateFee", "palletFee", "fuelSurcharge", "freightFee", "orderSalesTax",
    ]);
    expect(f.total).toBe(136);
    expect(f.missing).toEqual([]);
  });

  // ⚠️ The rule that matters. On the real invoice the fees are 15% of the goods,
  // so "not entered yet" silently meaning "not charged" would quote an order
  // well under its bill.
  it("treats a blank fee as unknown, not zero", () => {
    const f = orderFees({ costs: { liftgateFee: 20, freightFee: 100 } });
    expect(f.total).toBe(120);
    expect(f.missing).toEqual(["palletFee", "fuelSurcharge", "orderSalesTax"]);
  });

  it("treats an explicit 0 as a confirmed answer", () => {
    const f = orderFees({ ...FEES, costs: { ...FEES.costs, liftgateFee: 0 } });
    expect(f.missing).toEqual([]);
    expect(f.total).toBe(116);
  });

  it("reports every line missing when nothing is set", () => {
    expect(orderFees(null).missing).toHaveLength(5);
    expect(orderFees(null).total).toBe(0);
  });
});

describe("buildOrderEstimate with fees", () => {
  const order = { malts: [{ n: "Munich", order: 40 }], hops: [], yeast: [], adj: [] };
  const inventory = { malts: inv([{ n: "Munich", cpu: 1 }]) };

  it("adds the fees to the goods subtotal", () => {
    const est = buildOrderEstimate({ order, inventory, settings: FEES });
    expect(est.subtotal).toBe(55);
    expect(est.total).toBe(191); // 55 + 136
    expect(est.floor).toBe(false);
    expect(est.totalFloor).toBe(false);
  });

  // ⚠️ Two gaps, two fixes, two different screens: an unpriced ingredient is an
  // import that hasn't run, an unentered fee is a Settings field. The goods
  // subtotal must not be marked a floor because a FEE is missing.
  it("keeps the ingredient floor separate from the fee floor", () => {
    const est = buildOrderEstimate({ order, inventory, settings: { costs: { liftgateFee: 20 } } });
    expect(est.floor).toBe(false);
    expect(est.totalFloor).toBe(true);
    expect(est.total).toBe(75);
    expect(est.fees.missing).toHaveLength(4);
  });

  it("is ingredients-only when no settings are passed at all", () => {
    const est = buildOrderEstimate({ order, inventory });
    expect(est.total).toBe(est.subtotal);
    expect(est.totalFloor).toBe(true);
  });
});

describe("orderEmailText", () => {
  it("writes the sections in the order the email wants them", () => {
    const est = buildOrderEstimate({
      order: {
        malts: [{ n: "Pils", order: 40 }, { n: "Munich", order: 60 }],
        hops: [{ n: "Saaz", order: 20 }],
        yeast: [{ n: "BE-256", order: 2 }, { n: "K97", order: 1 }],
        adj: [{ n: "Lactose", order: 10, u: "lbs" }],
      },
      inventory: {
        malts: inv([{ n: "Pils", cpu: 1 }, { n: "Munich", cpu: 1 }]),
        hops: inv([{ n: "Saaz", cpu: 1 }]),
        yeast: inv([{ n: "BE-256", cpu: 1 }, { n: "K97", cpu: 1 }]),
        adj: inv([{ n: "Lactose", cpu: 1, u: "lbs" }]),
      },
    });
    expect(orderEmailText(est)).toBe(
      [
        "Malts",
        "2 Munich (55lb)",
        "1 Pils (55lb)",
        "",
        "Yeast",
        "2 BE-256 (500g)",
        "1 K97 (500g)",
        "",
        "Hops",
        "1 Saaz (11lb)",
        "",
        "Adjuncts",
        "1 Lactose (55lb)",
      ].join("\n")
    );
  });

  it("prints a line it cannot pack rather than dropping it from the order", () => {
    const est = buildOrderEstimate({
      order: { malts: [], hops: [], yeast: [], adj: [{ n: "Brewzyme D", order: 3, u: "oz" }] },
      inventory: { adj: inv([{ n: "Brewzyme D", u: "oz" }]) },
    });
    expect(orderEmailText(est)).toBe("Adjuncts\nBrewzyme D — 3 oz");
  });

  it("is empty when nothing needs ordering", () => {
    expect(orderEmailText({ sections: [] })).toBe("");
    expect(orderEmailText(null)).toBe("");
  });
});
