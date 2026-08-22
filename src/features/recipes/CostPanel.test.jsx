import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import CostPanel from "./CostPanel";

// Fabricated prices (real vendor pricing stays out of this repo), picked so the
// totals are checkable by hand: 100 lb × $1 + 20 oz × $0.50 + 1 pack × $80 = $190.
const recipe = {
  n: "Test Ale",
  m: [["2-Row", 100]],
  h: [["Cascade", 12, "boil", 60], ["Cascade", 8, "dryhop", 0]],
  y: [["K97", 1]],
  a: [],
  sa: [["CaCl2", 100, "mash"]],
};
const inv = {
  malts: [{ n: "2-Row", q: 0, cpu: 1, pricedAt: "2025-06-19" }],
  hops: [{ n: "Cascade", q: 0, cpu: 0.5, pricedAt: "2025-07-01" }],
  yeast: [{ n: "K97", q: 0, cpu: 80, pricedAt: "2025-06-19" }],
  adj: [],
};
const settings = { postBoilYield: 150, lossPct: 33 };

const renderPanel = (over = {}) => {
  const setInvCost = vi.fn();
  const utils = render(
    <CostPanel recipe={recipe} dbl={false} setDbl={vi.fn()} {...inv}
      setInvCost={setInvCost} settings={settings} {...over} />
  );
  return { ...utils, setInvCost };
};

// Find a stat tile by its label and read the dollar figure under it.
const stat = (label) => screen.getByText(label).parentElement.textContent.replace(label, "");

describe("CostPanel", () => {
  it("shows the batch total, cost per bbl, and cost per keg", () => {
    renderPanel();
    expect(stat("Batch total")).toBe("$190.00");
    // 150 gal less 33% = 100.5 gal = 3.2419 bbl → 190 / 3.2419 = $58.61
    expect(stat("Cost / bbl")).toBe("$58.61");
    expect(stat("Cost / keg")).toBe("$29.31");   // raw 29.3036, rounded up
    // $190 over 804 pints = 0.2363, rounded up
    expect(stat("Cost / pint")).toBe("$0.24");
  });

  it("shows the derived keg count so a wrong loss % is visible", () => {
    renderPanel();
    expect(screen.getByText(/3\.24 bbl ≈ 6\.5 kegs ≈ 804 pints/)).toBeInTheDocument();
  });

  it("folds a hop used at two stages into one line", () => {
    renderPanel();
    const rows = screen.getAllByText("Cascade");
    expect(rows).toHaveLength(1);
    expect(within(rows[0].closest("tr")).getByText("20 oz")).toBeInTheDocument();
  });

  it("excludes water salts", () => {
    renderPanel();
    expect(screen.queryByText("CaCl2")).not.toBeInTheDocument();
  });

  it("subtotals each category", () => {
    renderPanel();
    expect(screen.getByText("🌾 Malts").parentElement).toHaveTextContent("$100.00");
    expect(screen.getByText("🌿 Hops").parentElement).toHaveTextContent("$10.00");
    expect(screen.getByText("🧫 Yeast").parentElement).toHaveTextContent("$80.00");
  });

  it("reports the oldest price date behind the number", () => {
    renderPanel();
    expect(screen.getByText(/Prices as of/)).toHaveTextContent("2025-06-19");
  });

  // Regression: the input used to round for display, so a 3-decimal malt price
  // showed as 0.72 next to a cost computed from 0.724 — and editing the field
  // would have written the truncated value back over the real one.
  it("shows the stored price unrounded so editing cannot truncate it", () => {
    renderPanel({ malts: [{ n: "2-Row", q: 0, cpu: 0.724 }] });
    expect(screen.getByLabelText("Cost per lb of 2-Row")).toHaveValue(0.724);
  });

  it("edits a cost per unit through the inventory setter", () => {
    const { setInvCost } = renderPanel();
    fireEvent.change(screen.getByLabelText("Cost per lb of 2-Row"), { target: { value: "1.25" } });
    expect(setInvCost).toHaveBeenCalledWith("malt", "2-Row", "1.25");
  });

  it("doubles the total for a double batch but holds cost per bbl", () => {
    renderPanel();
    const perBbl = stat("Cost / bbl");
    renderPanel({ dbl: true });
    const doubled = screen.getAllByText("Batch total")[1].parentElement.textContent;
    expect(doubled).toContain("$380.00");
    expect(screen.getAllByText("Cost / bbl")[1].parentElement.textContent).toContain(perBbl);
  });

  // The contract that matters most: an unpriced ingredient must be visible and
  // must not be quietly folded in at $0.
  describe("with an unpriced ingredient", () => {
    const unpriced = { malts: [{ n: "2-Row", q: 0, cpu: 1 }, { n: "Mystery Malt", q: 0 }] };
    const withMystery = { ...recipe, m: [...recipe.m, ["Mystery Malt", 50]] };

    it("warns, names it, and leaves it out of the total", () => {
      renderPanel({ recipe: withMystery, ...unpriced });
      expect(screen.getByText(/1 ingredient unpriced/)).toBeInTheDocument();
      expect(screen.getAllByText(/Mystery Malt/).length).toBeGreaterThan(0);
      expect(stat("Batch total")).toBe("$190.00"); // not $190 + 50×0
    });

    it("marks the row rather than showing it as free", () => {
      renderPanel({ recipe: withMystery, ...unpriced });
      const row = screen.getAllByText("Mystery Malt").find(el => el.closest("tr"))?.closest("tr");
      expect(within(row).getByText("unpriced")).toBeInTheDocument();
      expect(within(row).queryByText("$0.00")).not.toBeInTheDocument();
    });
  });

  describe("without a batch volume", () => {
    it("still totals but prompts for a yield", () => {
      renderPanel({ settings: { lossPct: 33 } });
      expect(stat("Batch total")).toBe("$190.00");
      expect(stat("Cost / bbl")).toBe("—");
      expect(stat("Cost / pint")).toBe("—");
      expect(screen.getByText(/No batch volume/)).toBeInTheDocument();
    });

    it("prefers the recipe's own post-boil yield over the brewery default", () => {
      renderPanel({ recipe: { ...recipe, process: { postBoilYield: "300 gal" } } });
      expect(stat("Cost / bbl")).toBe("$29.31"); // twice the volume, half the cost/bbl
    });
  });

  it("renders nothing without a recipe", () => {
    const { container } = render(
      <CostPanel recipe={null} dbl={false} setDbl={vi.fn()} {...inv}
        setInvCost={vi.fn()} settings={settings} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
