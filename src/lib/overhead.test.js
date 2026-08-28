import { describe, it, expect } from "vitest";
import {
  annualCapacity, annualLabor, annualOverhead, annualVolume,
  costInputs, costStack, defCosts, missingInputs, parseNum, FICA_PCT,
} from "./overhead";

// Slackers' real production basis (Derek, 2026-08-28): 150 gal post-boil,
// 6.5 kegs packaged, 40 batches a year. Overhead figures here are fabricated
// round numbers — the real ones are the brewery's business and, like vendor
// prices, stay out of this repo.
const settings = { postBoilYield: 150, avgKegs: 6.5, lossPct: 33 };

const withCosts = (costs) => ({ ...settings, costs: { ...costs } });

// Confirmed overhead so a stack can be complete: $10k/mo total across six lines.
const OVERHEAD = { rent: 6000, electric: 1500, water: 400, insurance: 600, otherFixed: 500, fohPayroll: 1000 };

describe("parseNum", () => {
  it("reads the shapes a free-text money field actually holds", () => {
    expect(parseNum("1200")).toBe(1200);
    expect(parseNum("$1,200")).toBe(1200);
    expect(parseNum(" 12.50 ")).toBe(12.5);
    expect(parseNum(1200)).toBe(1200);
    expect(parseNum(0)).toBe(0);
  });

  // Null, never 0: an empty rent field means "we haven't entered it", and
  // treating that as free rent is the whole failure this module guards.
  it("returns null rather than zero when there is no number", () => {
    expect(parseNum("")).toBeNull();
    expect(parseNum(null)).toBeNull();
    expect(parseNum("not entered")).toBeNull();
  });
});

describe("costInputs", () => {
  it("falls back to the brewery defaults when nothing is stored", () => {
    expect(costInputs({}).brewerRate).toBe(defCosts.brewerRate);
    expect(costInputs(undefined).batchesPerYear).toBe(40);
  });

  it("honors an explicit zero rather than treating it as empty", () => {
    // 0% card processing is a real answer; empty is not.
    expect(costInputs(withCosts({ cardPct: 0 })).cardPct).toBe(0);
    expect(costInputs(withCosts({ cardPct: "" })).cardPct).toBe(defCosts.cardPct);
  });

  it("parses free-text money and keeps the permit type as a string", () => {
    expect(costInputs(withCosts({ rent: "$6,000" })).rent).toBe(6000);
    expect(costInputs(withCosts({ permitType: "mb" })).permitType).toBe("mb");
  });

  // ⚠️ Vessel volumes are actual working volume, never the nameplate rating.
  // A "3.5 BBL" fermenter here holds 125 gal; deriving from 3.5 understates
  // the brewery by a third.
  it("defaults the fermenters to their actual working gallons", () => {
    const f = costInputs({}).fermenters;
    expect(f.map((x) => x.gal)).toEqual([125, 125, 125, 250]);
  });
});

describe("missingInputs", () => {
  it("names every unconfirmed overhead input", () => {
    expect(missingInputs({})).toEqual(
      ["rent", "electric", "water", "insurance", "otherFixed", "fohPayroll"]
    );
  });

  it("is empty once they are all entered", () => {
    expect(missingInputs(withCosts(OVERHEAD))).toEqual([]);
  });
});

describe("annualVolume", () => {
  it("computes the year from the brewery's own batch basis", () => {
    const v = annualVolume({ settings });
    expect(v.packagedGalPerBatch).toBeCloseTo(100.75, 2);   // 6.5 kegs
    // Three volumes, not two: 150 boiled, 125 into the tank, 100.75 packaged.
    expect(v.kettleLossPct).toBeCloseTo(16.7, 1);
    expect(v.cellarLossPct).toBeCloseTo(19.4, 1);
    expect(v.packagedBbl).toBeCloseTo(130, 2);              // 40 batches
    expect(v.pintsPackaged).toBeCloseTo(32240, 0);
  });

  // The three denominators are the classic way to understate a per-pint cost.
  // Pints SOLD is the only correct one, and it is the smallest.
  it("takes pour losses off packaged beer to reach pints sold", () => {
    const v = annualVolume({ settings });
    // 3% line then 2% comps, compounding: 32240 × 0.97 × 0.98
    expect(v.pintsSold).toBeCloseTo(30647.4, 0);
    expect(v.pintsSold).toBeLessThan(v.pintsPackaged);
    expect(v.lossToPourPct).toBeCloseTo(4.94, 2);
  });

  it("compounds the two losses in sequence rather than adding them", () => {
    const v = annualVolume({ ...{ settings: withCosts({ linePct: 10, compsPct: 10 }) } });
    // 0.9 × 0.9 = 0.81 kept, not 0.80
    expect(v.lossToPourPct).toBeCloseTo(19, 6);
  });

  it("scales with the number of batches", () => {
    const v = annualVolume({ settings: withCosts({ batchesPerYear: 80 }) });
    expect(v.packagedBbl).toBeCloseTo(260, 2);
  });
});

describe("annualCapacity", () => {
  it("derives the tank ceiling from working volume and turn time", () => {
    const cap = annualCapacity({ settings });
    expect(cap.tankGal).toBe(625);                    // 125×3 + 250
    expect(cap.turns).toBeCloseTo(17.333, 2);         // 52 / 3 weeks
    // ⚠️ The ratio is fermenter→packaged (100.75/125 = 0.806), NOT
    // kettle→packaged: 625 gal × 0.806 × 17.33 turns ÷ 31 = ~282 bbl. Using
    // the kettle ratio charges the kettle loss twice and reads a 282 bbl
    // brewery as a 235 bbl one.
    expect(cap.capacityBbl).toBeCloseTo(281.6, 0);
    expect(cap.capacityBatches).toBeCloseTo(86.7, 1);
  });

  it("reports utilization against actual volume", () => {
    const cap = annualCapacity({ settings });
    expect(cap.utilizationPct).toBeCloseTo(46.2, 0);  // 130 of ~282
  });

  it("moves with turn time, which is the point of the sensitivity view", () => {
    const fast = annualCapacity({ settings: withCosts({ turnWeeks: 2 }) });
    const slow = annualCapacity({ settings: withCosts({ turnWeeks: 4 }) });
    expect(fast.capacityBbl).toBeGreaterThan(slow.capacityBbl);
    expect(fast.capacityBbl / slow.capacityBbl).toBeCloseTo(2, 1);
  });
});

describe("annualLabor", () => {
  it("burdens the base wages and keeps tip FICA as its own line", () => {
    const l = annualLabor({ settings });
    expect(l.brewerBase).toBeCloseTo(12 * 20 * 52, 2);   // $12,480
    expect(l.cellarBase).toBeCloseTo(8.5 * 11 * 52, 2);  // $4,862
    expect(l.burden).toBeCloseTo((12480 + 4862) * 0.12, 2);
  });

  // Tips are the customer's money. The employer's ONLY cost is FICA on the
  // shared amount — putting the tips themselves in COGS invents an expense.
  it("charges only FICA on the tip share, never the tips", () => {
    const l = annualLabor({ settings });
    const tipHours = (20 + 11) * 52;
    expect(l.tipFica).toBeCloseTo(9 * tipHours * (FICA_PCT / 100), 1);
    // The $9/hr share itself is ~$14.5k and must not appear in the total.
    expect(l.total).toBeLessThan(l.base + l.burden + 9 * tipHours);
  });
});

describe("annualOverhead", () => {
  it("annualizes the monthly figures", () => {
    const o = annualOverhead({ settings: withCosts(OVERHEAD) });
    expect(o.total).toBeCloseTo(10000 * 12, 2);
    expect(o.complete).toBe(true);
  });

  // The core rule, inherited from cogs.js: unconfirmed is not zero.
  it("leaves an unconfirmed line out and names it rather than costing it at 0", () => {
    const o = annualOverhead({ settings: withCosts({ ...OVERHEAD, rent: null }) });
    expect(o.missing).toEqual(["rent"]);
    expect(o.complete).toBe(false);
    expect(o.total).toBeCloseTo(4000 * 12, 2); // everything but the rent
    expect(o.lines.find((l) => l.key === "rent").annual).toBeNull();
  });
});

describe("costStack", () => {
  const full = { settings: withCosts(OVERHEAD), ingredientCostPerBbl: 111.83 };

  it("builds the per-pint stack over pints SOLD", () => {
    const s = costStack(full);
    expect(s.pintsSold).toBeCloseTo(30647.4, 0);
    expect(s.annual.ingredients).toBeCloseTo(111.83 * 130, 0);
    expect(s.perPint.ingredients).toBeCloseTo(0.48, 2);
    expect(s.complete).toBe(true);
  });

  it("separates direct from absorbed, since they answer different questions", () => {
    const s = costStack(full);
    expect(s.annual.direct).toBeCloseTo(s.annual.ingredients + s.annual.labor, 1);
    expect(s.annual.absorbed).toBeCloseTo(s.annual.direct + s.annual.overhead, 1);
    expect(s.perPint.absorbed).toBeGreaterThan(s.perPint.direct);
  });

  it("shows overhead dominating ingredients, which is the whole point", () => {
    const s = costStack(full);
    expect(s.perPint.overhead).toBeGreaterThan(s.perPint.ingredients * 5);
  });

  it("marks the stack incomplete when an input is unconfirmed", () => {
    const s = costStack({ settings, ingredientCostPerBbl: 111.83 });
    expect(s.complete).toBe(false);
    expect(s.missing).toContain("rent");
    // Still reports the floor rather than refusing to say anything.
    expect(s.perPint.absorbed).toBeGreaterThan(0);
  });

  it("treats unpriced ingredients as missing, never as free", () => {
    const s = costStack({ settings: withCosts(OVERHEAD) });
    expect(s.annual.ingredients).toBeNull();
    expect(s.perPint.ingredients).toBeNull();
    expect(s.missing).toContain("ingredients");
  });

  // This is the capacity curve: same fixed costs, more beer, cheaper pint.
  it("re-runs at an arbitrary volume so the curve can be drawn", () => {
    const low = costStack({ ...full, volumeBbl: 100 });
    const high = costStack({ ...full, volumeBbl: 300 });
    expect(high.perPint.absorbed).toBeLessThan(low.perPint.absorbed);
    // Ingredients are per-bbl so they do NOT move; only the fixed layers spread.
    expect(high.perPint.ingredients).toBeCloseTo(low.perPint.ingredients, 2);
    expect(high.perPint.overhead).toBeLessThan(low.perPint.overhead / 2);
  });

  it("returns nulls rather than dividing by zero at no volume", () => {
    const s = costStack({ ...full, volumeBbl: 0 });
    expect(s.perPint.absorbed).toBeNull();
  });
});
