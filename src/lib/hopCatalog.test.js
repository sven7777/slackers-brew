import { describe, it, expect } from "vitest";
import { buildHopCatalog, hopSku, newVarieties, orderPackOf, varietyOf } from "./hopCatalog";

// ⚠️ Fabricated prices only — real vendor prices never enter this repo. The
// LABELS are real: every one below is a row that appears on the April 2026 BSG
// spot hop list, because the labels are what these rules are about.

const row = (label, prices, over = {}) => ({
  label, variety: label.toLowerCase(), prices, ambiguous: false, ...over,
});

describe("varietyOf", () => {
  // Four different shapes on one list. The rule cuts at the product form or the
  // pack, which is the only thing they have in common.
  it("cuts at the product form", () => {
    expect(varietyOf("Cascade Pellet - 11lb")).toBe("Cascade");
    expect(varietyOf("Bravo™ Hop Pellet 44 lb")).toBe("Bravo");
    expect(varietyOf("Simcoe® Pellet 11 lb")).toBe("Simcoe");
  });

  it("cuts at the pack when there is no form word", () => {
    expect(varietyOf("Strata® - 11lb")).toBe("Strata");
    expect(varietyOf("Czech Saaz 11 lb/5 kg")).toBe("Czech Saaz");
    expect(varietyOf("Helios™ 11 lb/5 kg")).toBe("Helios");
  });

  // The ORIGIN column bleeds into some labels; it trails the pack, so cutting
  // at the pack takes it with it.
  it("drops the origin that trails some rows", () => {
    expect(varietyOf("Nelson Sauvin™ Pellet - 11lb New Zealand")).toBe("Nelson Sauvin");
    expect(varietyOf("Amarillo® Pellet - 11lb* American/German")).toBe("Amarillo");
  });

  // ⚠️ Case is preserved. normalizeVariety() folds it because it exists to
  // MATCH; this name gets stored, shown in the Add picker and printed on a brew
  // sheet, and "cascade" is not what anyone calls it.
  it("keeps the variety spelled the way the list spells it", () => {
    expect(varietyOf("CTZ Pellet - 11lb")).toBe("CTZ");
    expect(varietyOf("US Saaz 11 lb/5 kg")).toBe("US Saaz");
    expect(varietyOf("Hallertau Mittelfrüh Pellet - 11lb")).toBe("Hallertau Mittelfrüh");
    expect(varietyOf("Wai-iti™ Pellet - 11lb New Zealand")).toBe("Wai-iti");
  });

  // Better to skip a row than to invent an ingredient from it.
  it("declines a label with nothing to cut at", () => {
    expect(varietyOf("HOP VARIETY")).toBeNull();
    expect(varietyOf("")).toBeNull();
    expect(varietyOf(null)).toBeNull();
  });
});

describe("hopSku", () => {
  // ⚠️ The identity rule. A generated HOP-CASCADE beside the existing HOP-CAS
  // would be two catalog identities for one hop, and every rename / repack /
  // discontinued check in catalogChanges.js is keyed on exactly that identity.
  it("reuses the SKU products.js already assigned a hop we buy", () => {
    expect(hopSku("Cascade")).toBe("HOP-CAS");
    expect(hopSku("CTZ")).toBe("HOP-CTZ");
    expect(hopSku("Idaho 7")).toBe("HOP-IDA7");
  });

  it("matches that hop however the list punctuates it", () => {
    expect(hopSku("cascade")).toBe("HOP-CAS");
    expect(hopSku("Idaho  7")).toBe("HOP-IDA7");
  });

  it("synthesises a stable SKU for a variety nobody has bought", () => {
    expect(hopSku("Nelson Sauvin")).toBe("HOP-NELSONSAUVIN");
    expect(hopSku("Nelson Sauvin")).toBe(hopSku("nelson  sauvin"));
    // Accents fold rather than landing in a SKU.
    expect(hopSku("Hallertau Mittelfrüh")).toBe("HOP-HALLERTAUMITTELFRUH");
  });

  // "Idaho Gem" is a different hop from "Idaho 7", and the list carries both
  // across different months. They must never collapse onto one identity.
  it("keeps two similarly named varieties apart", () => {
    expect(hopSku("Idaho Gem")).not.toBe(hopSku("Idaho 7"));
  });
});

describe("orderPackOf", () => {
  it("reads the box the variety ships in", () => {
    expect(orderPackOf("Cascade Pellet - 11lb")).toBe("11 lb");
    expect(orderPackOf("Lemondrop™ Hop Pellet 44lb")).toBe("44 lb");
    expect(orderPackOf("Czech Saaz 11 lb/5 kg")).toBe("11 lb");
  });
});

describe("buildHopCatalog", () => {
  const rows = [
    row("Cascade Pellet - 11lb", [{ year: 2024, price: 8 }, { year: 2025, price: 9 }]),
    row("Nelson Sauvin™ Pellet - 11lb New Zealand", [{ year: 2025, price: 14 }]),
    row("Cryo Cascade Hops® - 11 lb", [{ year: 2025, price: 30 }]),
    row("Cascade - CO2 Hop Extract (150GMA)", [{ year: 2025, price: 44 }]),
  ];

  it("makes one entry per variety, priced at the newest crop the list carries", () => {
    const { entries } = buildHopCatalog(rows);
    expect(entries.map((e) => [e.name, e.price, e.cropYear])).toEqual([
      ["Cascade", 9, 2025],
      ["Nelson Sauvin", 14, 2025],
    ]);
  });

  // ⚠️ Cryo is a concentrated product at its own money and extract is quoted
  // per CAN, not per pound. Carrying either as a per-pound price for "Cascade"
  // would cost a batch off the wrong product — so they are dropped, and the
  // count says so rather than the exclusion being silent.
  it("drops Cryo and extract rows, and reports how many", () => {
    const { entries, counts } = buildHopCatalog(rows);
    expect(entries).toHaveLength(2);
    expect(counts).toMatchObject({ rows: 4, varieties: 2, priced: 2, skippedVariants: 2 });
  });

  // A 44 lb box IS kept, unlike in the pricing path: it is a real product
  // quoted per pound like every other row, and on the April 2026 list it is the
  // only way Lemondrop appears at all.
  it("keeps a 44 lb box and records it as the order pack", () => {
    const { entries } = buildHopCatalog([row("Lemondrop™ Hop Pellet 44lb", [{ year: 2025, price: 12 }])]);
    expect(entries[0]).toMatchObject({ sku: "HOP-LEM", name: "Lemondrop", orderPack: "44 lb", packQty: 1, packUnit: "lb" });
  });

  it("prices every entry per pound, which is how the list quotes", () => {
    const { entries } = buildHopCatalog(rows);
    expect(entries.every((e) => e.packQty === 1 && e.packUnit === "lb")).toBe(true);
  });

  // Pooled across every row for the variety, exactly as the review screen pools
  // them — two rows disagreeing on the newest crop year prefill nothing there,
  // and must store nothing here.
  it("leaves the price null when the newest crop year is contested", () => {
    const { entries, counts } = buildHopCatalog([
      row("Amarillo® Pellet - 11lb", [{ year: 2025, price: 11 }]),
      row("Amarillo® Pellet - 11lb", [{ year: 2025, price: 4 }]),
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0].price).toBeNull();
    expect(counts.unpriced).toBe(1);
  });

  it("carries the list's own date and name onto every entry", () => {
    const { entries } = buildHopCatalog(rows, { source: "spot.pdf", effective: "2026-04-29" });
    expect(entries[0]).toMatchObject({ source: "spot.pdf", effective: "2026-04-29", category: "hop" });
  });

  it("survives an empty parse", () => {
    expect(buildHopCatalog([]).entries).toEqual([]);
    expect(buildHopCatalog(undefined).counts.varieties).toBe(0);
  });
});

describe("newVarieties", () => {
  it("counts what the brewery has never bought — the point of the ingest", () => {
    const { entries } = buildHopCatalog([
      row("Cascade Pellet - 11lb", [{ year: 2025, price: 9 }]),
      row("Nelson Sauvin™ Pellet - 11lb", [{ year: 2025, price: 14 }]),
    ]);
    expect(newVarieties(entries).map((e) => e.name)).toEqual(["Nelson Sauvin"]);
  });
});
