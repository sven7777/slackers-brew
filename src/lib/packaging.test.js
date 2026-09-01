import { describe, it, expect } from "vitest";
import { packagingCosts } from "./packaging";

// A 3.24 bbl batch (150 gal less 33% loss), the brewery default.
const cost = { total: 486.0, packagedBbl: 3.24, missing: [] };

describe("packagingCosts", () => {
  it("splits the batch total across sixtels", () => {
    // 3.24 bbl = 19.44 sixtels
    expect(packagingCosts(cost).costPerSixtel).toBe(25.0);
  });

  it("splits the batch total across 24 x 12 oz cases", () => {
    // 3.24 bbl = 44.64 cases
    expect(packagingCosts(cost).costPerCase).toBe(10.89);
  });

  it("reports how many ingredients were unpriced", () => {
    const partial = { ...cost, missing: [{ name: "Whirlfloc" }] };
    expect(packagingCosts(partial).unpricedCount).toBe(1);
  });
});
