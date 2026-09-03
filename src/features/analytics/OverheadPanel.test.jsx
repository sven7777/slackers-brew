import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import OverheadPanel from "./OverheadPanel";

// Fabricated round numbers, like every other money fixture here — the brewery's
// real rent and payroll are its own business and stay out of a public repo,
// exactly as vendor prices do. Picked so the arithmetic is checkable by hand:
//
//   volume  40 batches × 150 gal less 33% = 100.5 gal = 4,020 gal = 129.68 bbl
//           × 248 pints = 32,160 packaged, less 3% line and 2% comps
//           = 30,571.296 pints SOLD
//   labor   $10/hr × 20 hrs × 52 = $10,400 brewer, $10/hr × 10 hrs × 52 = $5,200
//           cellar, +10% burden = $1,560, + FICA on $10/hr × 1,560 hrs = $1,193.40
//           => $18,353.40, rounded to $18,353 on screen
//   ovhd    $1,000 × 6 lines = $6,000/mo = $72,000/yr
const settings = {
  postBoilYield: 150,
  lossPct: 33,
  costs: {
    batchesPerYear: 40,
    linePct: 3,
    compsPct: 2,
    brewerRate: 10, brewerHrsWeek: 20,
    cellarRate: 10, cellarHrsWeek: 10,
    burdenPct: 10, tipShareRate: 10,
    rent: 1000, electric: 1000, water: 1000,
    insurance: 1000, fohPayroll: 1000, otherFixed: 1000,
  },
};

// One overhead line left blank: the panel must report it rather than cost it at
// zero, which is the whole reason this module has a `missing` list.
const gappy = { ...settings, costs: { ...settings.costs, rent: "" } };

const renderPanel = (over = {}) =>
  render(<OverheadPanel settings={settings} ingredientCostPerBbl={100} costedBeers={4} {...over} />);

// Read the figure under a stat tile's label.
const stat = (label) => screen.getByText(label).parentElement.textContent.replace(label, "");

// The named row of the cost-stack table, as an array of its cells.
const stackRow = (label) => {
  const table = screen.getAllByRole("table")[0];
  const row = within(table).getByText(label).closest("tr");
  return [...row.querySelectorAll("td")].map((td) => td.textContent);
};

describe("OverheadPanel", () => {
  it("stacks ingredients, labor and overhead into a cost per pint SOLD", () => {
    renderPanel();

    // $100/bbl × 129.68 bbl = $12,967.75 ingredients
    expect(stackRow("Ingredients")[1]).toBe("$12,968");
    expect(stackRow("Production labor")[1]).toBe("$18,353");
    expect(stackRow("Allocated overhead")[1]).toBe("$72,000");

    // Direct = ingredients + labor; absorbed adds overhead.
    expect(stackRow("= Direct cost")[1]).toBe("$31,321");
    expect(stackRow("= Absorbed cost")[1]).toBe("$103,321");

    // The denominator is pints SOLD (30,571), not pints packaged (32,160).
    // $103,321.15 / 30,571.296 = $3.38.
    expect(stat("Absorbed / pint")).toContain("$3.38");
    expect(stat("Pints sold / yr")).toContain("30,571");
  });

  it("separates direct from absorbed, because they answer different questions", () => {
    renderPanel();
    // $31,321.15 / 30,571.296 = $1.03 — what one more pint costs to make, well
    // under the $3.38 the business needs it to clear.
    expect(stat("Direct / pint")).toContain("$1.03");
    expect(stat("Absorbed / pint")).toContain("$3.38");
  });

  it("reports an unconfirmed overhead line instead of costing it at zero", () => {
    renderPanel({ settings: gappy });

    expect(screen.getByText(/This is a floor, not a cost/)).toBeInTheDocument();
    // Named by the same label Settings collects it under — in the banner AND
    // on its own row, so the reader sees both that something is missing and
    // which line has the hole in it.
    expect(screen.getAllByText(/Rent \+ NNN/).length).toBeGreaterThan(1);

    // $72,000 less the $12,000 rent line.
    expect(stackRow("Allocated overhead")[1]).toBe("$60,000");
    // And the absorbed figure is marked a floor.
    expect(stat("Absorbed / pint")).toContain("+");
  });

  it("renders with no priced recipes at all — rent is a cost on day one", () => {
    renderPanel({ ingredientCostPerBbl: null, costedBeers: 0 });

    expect(screen.getByText(/No recipe is fully priced/)).toBeInTheDocument();
    expect(stackRow("Ingredients")[1]).toBe("—");
    // Labor and overhead are still real and still totalled.
    expect(stackRow("= Absorbed cost")[1]).toBe("$90,353");
  });

  it("shows tank utilization, the lever that moves overhead per pint", () => {
    renderPanel();
    // 625 gal of tank × (100.5/125 yield) × 17.33 turns = 280.97 bbl capacity
    // against 129.68 bbl brewed.
    expect(stat("Tank utilization")).toContain("46%");
  });

  it("counts the employer FICA on tips but never the tips themselves", () => {
    renderPanel();
    // $10/hr × 1,560 hrs × 7.65% = $1,193.40. The $15,600 of tip income itself
    // is the customer's money and appears nowhere.
    expect(screen.getByText(/Employer FICA on the tip share/).closest("tr").textContent).toContain("$1,193");
    expect(screen.queryByText("$15,600")).not.toBeInTheDocument();
  });
});
