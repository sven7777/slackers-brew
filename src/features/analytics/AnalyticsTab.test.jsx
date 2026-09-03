import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import AnalyticsTab from "./AnalyticsTab";

// Fabricated prices (real vendor pricing stays out of this repo), picked so the
// totals are checkable by hand against the Cost panel's own arithmetic:
// 150 gal less 33% loss = 100.5 gal = 3.2419 bbl.
const inv = {
  malts: [
    { n: "2-Row", q: 0, cpu: 1, pricedAt: "2025-06-19" },
    { n: "Unpriced Malt", q: 0 },
  ],
  hops: [{ n: "Cascade", q: 0, cpu: 0.5 }],
  yeast: [{ n: "K97", q: 0, cpu: 80 }],
  adj: [],
};
const settings = { postBoilYield: 150, lossPct: 33 };

// $100 + $10 + $80 = $190
const cheap = { n: "Table Beer", s: "Bitter", m: [["2-Row", 100]], h: [["Cascade", 20, "boil", 60]], y: [["K97", 1]], a: [] };
// $300 + $80 = $380
const dear = { n: "Big Wheat", s: "Weizen", m: [["2-Row", 300]], h: [], y: [["K97", 1]], a: [] };
const gappy = { n: "Gappy IPA", s: "IPA", m: [["2-Row", 100], ["Unpriced Malt", 50]], h: [], y: [], a: [] };

const renderTab = (over = {}) => {
  const openRecipeCost = vi.fn();
  const utils = render(
    <AnalyticsTab recs={[cheap, dear]} {...inv} settings={settings} openRecipeCost={openRecipeCost} {...over} />
  );
  return { ...utils, openRecipeCost };
};

// Find a stat tile by its label and read the figure under it.
const stat = (label) => screen.getByText(label).parentElement.textContent.replace(label, "");
// The beer names down the cost table, in display order.
const rowNames = () =>
  screen.getAllByRole("table")[0].querySelectorAll("tbody tr td:first-child button");

describe("AnalyticsTab", () => {
  it("lists every beer with the costs its own Cost panel would show", () => {
    renderTab();
    const table = screen.getAllByRole("table")[0];
    const row = within(table).getByRole("button", { name: "Table Beer" }).closest("tr");
    const cells = [...row.querySelectorAll("td")].map((td) => td.textContent);
    expect(cells[2]).toBe("$190.00");   // batch
    expect(cells[3]).toBe("$58.61");    // per bbl
    expect(cells[4]).toBe("$29.31");    // per keg
    expect(cells[5]).toBe("$0.24");     // per pint
  });

  it("defaults to alphabetical order", () => {
    renderTab();
    expect([...rowNames()].map((b) => b.textContent)).toEqual(["Big Wheat", "Table Beer"]);
  });

  it("sorts by a money column, dearest first, and reverses on a second click", () => {
    renderTab();
    fireEvent.click(screen.getByText(/\$ \/ bbl/));
    expect([...rowNames()].map((b) => b.textContent)).toEqual(["Big Wheat", "Table Beer"]);
    fireEvent.click(screen.getByText(/\$ \/ bbl/));
    expect([...rowNames()].map((b) => b.textContent)).toEqual(["Table Beer", "Big Wheat"]);
  });

  it("averages only the fully priced beers and says how many it left out", () => {
    renderTab({ recs: [cheap, dear, gappy] });
    expect(stat("Beers costed")).toContain("2");
    expect(stat("Beers costed")).toContain("of 3");
    expect(screen.getByText(/1 unpriced .* excluded below/)).toBeInTheDocument();
    // (190 + 380) / 2 = 285 — the gappy recipe's $100 floor is not in it.
    expect(stat("Avg / bbl")).toBe("$87.92");
  });

  it("shows an incomplete beer's floor, marked, rather than hiding the row", () => {
    renderTab({ recs: [gappy] });
    const row = screen.getByRole("button", { name: "Gappy IPA" }).closest("tr");
    expect(row.textContent).toContain("$100.00");
    expect(row.textContent).toContain("1 unpriced: Unpriced Malt");
  });

  it("ranks the ingredients blocking the most beers", () => {
    renderTab({ recs: [gappy, { ...gappy, n: "Second Gap" }, cheap] });
    const blockerTable = screen.getAllByRole("table")[1];
    const row = within(blockerTable).getByText(/Unpriced Malt/).closest("tr");
    expect(row.textContent).toContain("Gappy IPA, Second Gap");
    expect(row.textContent).toContain("2");
  });

  it("hides the blockers card when every beer prices", () => {
    renderTab();
    expect(screen.queryByText(/blocking/)).not.toBeInTheDocument();
    expect(screen.getByText(/every recipe fully priced/)).toBeInTheDocument();
  });

  it("opens a beer's cost breakdown by its stored index", () => {
    const { openRecipeCost } = renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Table Beer" }));
    expect(openRecipeCost).toHaveBeenCalledWith(0);   // stored index, not row order
  });

  it("names the cheapest and dearest beer per bbl", () => {
    renderTab();
    expect(screen.getByText(/Cheapest per bbl/).textContent).toMatch(/Table Beer.*\$58\.61.*Big Wheat/s);
  });

  it("prints the oldest price date behind the figures", () => {
    renderTab();
    expect(screen.getByText(/Prices as of/).textContent).toContain("2025-06-19");
  });

  it("says so rather than crashing when there are no recipes", () => {
    renderTab({ recs: [] });
    expect(screen.getByText(/No recipes yet/)).toBeInTheDocument();
  });

  it("survives a recipe with no ingredient arrays at all", () => {
    renderTab({ recs: [{ n: "Just An Idea" }] });
    expect(screen.getByText(/no ingredients yet/)).toBeInTheDocument();
    expect(stat("Beers costed")).toContain("of 1");
  });

  it("switches to the Overhead view and feeds it the book average", () => {
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Overhead" }));

    // The Beers table is gone and the cost stack is in its place.
    expect(screen.queryByText("Cost by Beer")).not.toBeInTheDocument();
    // ⚠️ The ingredient layer must be the SAME number the Beers tile printed —
    // $87.92/bbl — not a second computation off the same recipes. 3.2419 bbl
    // × 40 batches × $87.92 = $11,401.35.
    const row = screen.getByText("Ingredients").closest("tr");
    expect(row.textContent).toContain("$11,401");
  });

  it("shows Overhead even with no recipes at all — rent is a cost on day one", () => {
    renderTab({ recs: [] });
    // The Beers view says there is nothing to cost...
    expect(screen.getByText(/No recipes yet/)).toBeInTheDocument();
    // ...but the sub-nav is still there and Overhead still has something to say.
    fireEvent.click(screen.getByRole("button", { name: "Overhead" }));
    expect(screen.getByText(/No recipe is fully priced/)).toBeInTheDocument();
    expect(screen.getByText("Production labor")).toBeInTheDocument();
  });
});
