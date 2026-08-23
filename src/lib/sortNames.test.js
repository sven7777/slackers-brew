import { describe, it, expect } from "vitest";
import { sortedWithIndex, sortedNames } from "./sortNames";

describe("compareNames", () => {
  it("ignores case, so CTZ doesn't jump ahead of Cascade", () => {
    expect(sortedNames(["CTZ", "Cascade", "Citra"])).toEqual(["Cascade", "Citra", "CTZ"]);
  });

  it("orders embedded numbers numerically", () => {
    expect(sortedNames(["Crystal 120", "Crystal 8", "Crystal 80"]))
      .toEqual(["Crystal 8", "Crystal 80", "Crystal 120"]);
  });

  it("sorts a leading digit ahead of letters", () => {
    expect(sortedNames(["Pils", "2-Row", "Aromatic"])).toEqual(["2-Row", "Aromatic", "Pils"]);
  });

  it("tolerates null and undefined names", () => {
    expect(() => sortedNames([null, "Saaz", undefined])).not.toThrow();
  });
});

describe("sortedWithIndex", () => {
  const hops = [
    ["Cascade", 12, "boil", 10],
    ["Amarillo", 16, "boil", 7.5],
    ["Cascade", 12, "whirlpool", 20],
    ["Cascade", 48, "dryhop1", 0],
  ];

  it("returns rows in name order with their original index", () => {
    expect(sortedWithIndex(hops, (t) => t[0]).map((r) => [r.item[0], r.index])).toEqual([
      ["Amarillo", 1],
      ["Cascade", 0],
      ["Cascade", 2],
      ["Cascade", 3],
    ]);
  });

  it("keeps stored order among repeats of one name", () => {
    const stages = sortedWithIndex(hops, (t) => t[0])
      .filter((r) => r.item[0] === "Cascade")
      .map((r) => r.item[2]);
    expect(stages).toEqual(["boil", "whirlpool", "dryhop1"]);
  });

  it("does not mutate the input", () => {
    const items = [["B"], ["A"]];
    sortedWithIndex(items, (t) => t[0]);
    expect(items.map((t) => t[0])).toEqual(["B", "A"]);
  });

  it("handles an empty list", () => {
    expect(sortedWithIndex()).toEqual([]);
  });
});
