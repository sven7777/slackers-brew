import { describe, it, expect } from "vitest";
import { archivedCount, isArchived, totalArchived, visibleInventory, visibleItems } from "./archive";

const row = (n, extra = {}) => ({ n, q: 0, ...extra });

describe("isArchived", () => {
  it("is true only for the explicit flag", () => {
    expect(isArchived(row("Idaho 7", { archived: true }))).toBe(true);
    expect(isArchived(row("Cascade"))).toBe(false);
    expect(isArchived(row("Cascade", { archived: false }))).toBe(false);
  });

  // Every inventory row predates this field, so absent must mean "stocked".
  it("treats a row with no flag at all as stocked", () => {
    expect(isArchived({ n: "2-Row", q: 5 })).toBe(false);
    expect(isArchived(null)).toBe(false);
  });
});

describe("visibleItems", () => {
  const items = [row("Cascade"), row("Idaho 7", { archived: true }), row("Citra")];

  it("hides archived rows by default", () => {
    expect(visibleItems(items).map((i) => i.n)).toEqual(["Cascade", "Citra"]);
  });

  it("shows them when asked", () => {
    expect(visibleItems(items, true).map((i) => i.n)).toEqual(["Cascade", "Idaho 7", "Citra"]);
  });

  it("does not mutate or reorder what it is given", () => {
    const before = [...items];
    visibleItems(items, false);
    expect(items).toEqual(before);
  });

  it("survives an empty or missing list", () => {
    expect(visibleItems()).toEqual([]);
    expect(visibleItems([], true)).toEqual([]);
  });
});

describe("counts", () => {
  it("counts what is hidden, so the tab can say so", () => {
    expect(archivedCount([row("a"), row("b", { archived: true })])).toBe(1);
  });

  it("totals across all four categories", () => {
    const inv = {
      malts: [row("2-Row")],
      hops: [row("Idaho 7", { archived: true }), row("Lemondrop", { archived: true })],
      yeast: [row("US-05")],
      adj: [row("Honey", { archived: true })],
    };
    expect(totalArchived(inv)).toBe(3);
    const shown = visibleInventory(inv);
    expect(shown.hops).toEqual([]);
    expect(shown.malts.map((i) => i.n)).toEqual(["2-Row"]);
    expect(visibleInventory(inv, true).hops).toHaveLength(2);
  });

  it("handles a partial inventory object", () => {
    expect(totalArchived({})).toBe(0);
    expect(visibleInventory()).toEqual({ malts: [], hops: [], yeast: [], adj: [] });
  });
});
