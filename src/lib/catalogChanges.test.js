import { describe, it, expect } from "vitest";
import { catalogChanges } from "./catalogChanges";

// ⚠️ Fabricated prices only. The name and pack-size changes below are real:
// each is a difference between the June 2025 and August 2026 Houston lists.

const entry = (sku, name, packQty = 1, packUnit = "lb", extra = {}) => ({
  sku, name, packQty, packUnit, price: 1, category: null, vendor: null,
  source: "Houston", effective: "2026-08-24", ...extra,
});

describe("catalogChanges", () => {
  it("reports a SKU the stored catalog has never seen as added", () => {
    const { added, unchanged } = catalogChanges([], [entry("MRAH1190", "Rahr North Star Pils™")]);
    expect(added.map((e) => e.sku)).toEqual(["MRAH1190"]);
    expect(unchanged).toEqual([]);
  });

  // Rahr rebranded 2-Row between the two lists. Same sack, same SKU.
  it("reports a vendor rename against the same SKU, not as a new product", () => {
    const stored = [entry("MRAH1102", "Rahr Standard 2-Row")];
    const incoming = [entry("MRAH1102", "Rahr The Brewer’s Standard™ 2-Row")];
    const { added, renamed, next } = catalogChanges(stored, incoming);
    expect(added).toEqual([]);
    expect(renamed).toHaveLength(1);
    expect(renamed[0]).toMatchObject({
      sku: "MRAH1102",
      from: "Rahr Standard 2-Row",
      to: "Rahr The Brewer’s Standard™ 2-Row",
    });
    expect(next).toHaveLength(1);
    expect(next[0].name).toBe("Rahr The Brewer’s Standard™ 2-Row");
  });

  // The mango puree went from 44.1 lb to 44 lb. Pack size is the denominator
  // of the derived price, so this is a cost change wearing a cosmetic disguise.
  it("reports a repack, which moves a price even when the name does not", () => {
    const stored = [entry("AZZZ2901", "Mango Puree - 44.1 lb", 44.1)];
    const incoming = [entry("AZZZ2901", "Mango Puree - 44.1 lb", 44)];
    const { repacked, unchanged } = catalogChanges(stored, incoming);
    expect(unchanged).toEqual([]);
    expect(repacked).toHaveLength(1);
    expect(repacked[0].from).toEqual({ qty: 44.1, unit: "lb" });
    expect(repacked[0].to).toEqual({ qty: 44, unit: "lb" });
  });

  it("reports a row that was both renamed and repacked in both lists", () => {
    const stored = [entry("AZZZ2901", "Mango Puree - 44.1 lb", 44.1)];
    const incoming = [entry("AZZZ2901", "Alphonso Mango Puree - 44 lb", 44)];
    const { renamed, repacked } = catalogChanges(stored, incoming);
    expect(renamed.map((e) => e.sku)).toEqual(["AZZZ2901"]);
    expect(repacked.map((e) => e.sku)).toEqual(["AZZZ2901"]);
  });

  // Real case from the two lists: three honeys went from "- 5 gal" to
  // "- 60 lb Pail", changing both the number and the unit.
  it("reports a repack that changes the unit as well as the number", () => {
    const stored = [entry("AZZZ4101", "Honey - Clover (USA) - 5 gal", 5, "gal")];
    const incoming = [entry("AZZZ4101", "Honey - Clover (USA) - 60 lb Pail", 60, "lb")];
    const { repacked } = catalogChanges(stored, incoming);
    expect(repacked[0].from).toEqual({ qty: 5, unit: "gal" });
    expect(repacked[0].to).toEqual({ qty: 60, unit: "lb" });
  });

  // Learning a pack we previously couldn't read is not a vendor change, and
  // must not carry the "check this, it moves money" warning that a real repack
  // does. Nothing about the product moved; only our reading of it improved.
  it("does not call it a repack when the pack was simply unknown before", () => {
    const stored = [entry("BZZZ1634", "Kerry Biomatex L ALDC - 500 g", null, null)];
    const incoming = [entry("BZZZ1634", "Kerry Biomatex L ALDC - 500 g", 500, "g")];
    const { repacked, unchanged } = catalogChanges(stored, incoming);
    expect(repacked).toEqual([]);
    expect(unchanged.map((e) => e.sku)).toEqual(["BZZZ1634"]);
  });

  it("does not call it a repack when the pack has become unreadable", () => {
    const stored = [entry("BZZZ1634", "Kerry Biomatex L ALDC", 500, "g")];
    const incoming = [entry("BZZZ1634", "Kerry Biomatex L ALDC", null, null)];
    expect(catalogChanges(stored, incoming).repacked).toEqual([]);
  });

  it("says nothing moved when nothing moved", () => {
    const stored = [entry("MWEY1016", "Weyermann® Vienna Malt")];
    const { unchanged, renamed, repacked, added } = catalogChanges(stored, [entry("MWEY1016", "Weyermann® Vienna Malt")]);
    expect(unchanged.map((e) => e.sku)).toEqual(["MWEY1016"]);
    expect([renamed, repacked, added].every((l) => l.length === 0)).toBe(true);
  });

  // The case that cost Slackers a year of stale Pils pricing.
  it("flags a SKU we buy that has fallen off the list", () => {
    const stored = [entry("MRAH1105", "Rahr Premium Pilsner"), entry("MRAH1102", "2-Row")];
    const incoming = [entry("MRAH1102", "2-Row")];
    const { discontinued } = catalogChanges(stored, incoming, ["MRAH1105", "MRAH1102"]);
    expect(discontinued.map((e) => e.sku)).toEqual(["MRAH1105"]);
  });

  // A vendor drops products constantly and almost none of them are ours; an
  // unrestricted list would bury the one line that matters.
  it("does not flag a dropped product the brewery never bought", () => {
    const stored = [entry("MWEY1099", "Some malt we never bought"), entry("MWEY1016", "Vienna")];
    const { discontinued } = catalogChanges(stored, [entry("MWEY1016", "Vienna")], ["MWEY1016"]);
    expect(discontinued).toEqual([]);
  });

  // ⚠️ The Houston list carries no hops. Without scoping, importing it would
  // report every hop in the catalog as discontinued — re-creating, in a louder
  // font, the exact "not on this list" confusion that hid a dead Pils SKU for
  // a year.
  it("does not call a hop discontinued because a malt list omits it", () => {
    const stored = [entry("HOP-CAS", "Cascade Pellet - 11 lb"), entry("MRAH1102", "2-Row")];
    const maltListOnly = [entry("MRAH1102", "2-Row")];
    const { discontinued } = catalogChanges(stored, maltListOnly, ["HOP-CAS", "MRAH1102"]);
    expect(discontinued).toEqual([]);
  });

  // The other half of the same rule: a hop list CAN retire a hop.
  it("does flag a hop the hop list itself has stopped carrying", () => {
    const stored = [entry("HOP-CAS", "Cascade"), entry("HOP-CIT", "Citra")];
    const { discontinued } = catalogChanges(stored, [entry("HOP-CIT", "Citra")], ["HOP-CAS", "HOP-CIT"]);
    expect(discontinued.map((e) => e.sku)).toEqual(["HOP-CAS"]);
  });

  // The hop list carries no malts and the malt list carries no hops. Replacing
  // rather than merging would empty the catalog on every alternate import.
  it("merges a partial list into the catalog instead of replacing it", () => {
    const stored = [entry("MRAH1102", "2-Row"), entry("HOP-CAS", "Cascade Pellet - 11 lb")];
    const { next } = catalogChanges(stored, [entry("HOP-CAS", "Cascade Pellet - 11 lb")]);
    expect(next.map((e) => e.sku).sort()).toEqual(["HOP-CAS", "MRAH1102"]);
  });

  // classify() only ever offers a guess; a human's correction outranks it and
  // must survive the next import.
  it("keeps a category a human corrected when the row is re-ingested", () => {
    const stored = [entry("BZZZ1406", "Rice Hulls - 50 lb", 50, "lb", { category: "adj" })];
    const incoming = [entry("BZZZ1406", "Rice Hulls - 50 lb", 50, "lb", { category: null })];
    const { next } = catalogChanges(stored, incoming);
    expect(next[0].category).toBe("adj");
  });

  it("survives an empty stored catalog and an empty file", () => {
    expect(catalogChanges(null, null).next).toEqual([]);
    expect(catalogChanges(undefined, [entry("X", "x")]).added).toHaveLength(1);
  });
});
