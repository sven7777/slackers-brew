import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import PricingPanel from "./PricingPanel";
import { costAllRecipes } from "../../lib/analytics";

// Fabricated prices; real vendor pricing stays out of this repo. Fabricated
// overhead too — the brewery's real figures are its own business.
const inv = {
  malts: [{ n: "2-Row", q: 0, cpu: 1 }],
  hops: [{ n: "Cascade", q: 0, cpu: 0.5 }],
  yeast: [{ n: "K97", q: 0, cpu: 80 }],
  adj: [],
};

const OVERHEAD = { rent: 6000, electric: 1500, water: 400, insurance: 600, otherFixed: 500, fohPayroll: 1000 };
const settings = { postBoilYield: 150, lossPct: 33, costs: { ...OVERHEAD } };

const kolsch = { n: "Kolsch", s: "Kolsch", m: [["2-Row", 100]], h: [["Cascade", 20, "boil", 60]], y: [["K97", 1]], a: [] };
const panda = { n: "Red Panda", s: "Tripel", m: [["2-Row", 300]], h: [], y: [["K97", 1]], a: [], process: { pourOz: 8 } };

const renderPanel = (over = {}) => {
  const recs = over.recs || [kolsch, panda];
  const s = over.settings || settings;
  const setSettings = vi.fn();
  const setRecs = vi.fn();
  const { rows, summary } = costAllRecipes({ recs, ...inv, settings: s });
  const utils = render(
    <PricingPanel settings={s} setSettings={setSettings} recs={recs} setRecs={setRecs}
      rows={rows} ingredientCostPerBbl={summary.avgCostPerBbl} />
  );
  return { ...utils, setSettings, setRecs };
};

// setSettings is called with an updater; run it against the current settings to
// see what would actually be stored.
const applied = (mock, base = settings) => mock.mock.calls.at(-1)[0](base);

const boardTable = () => screen.getAllByRole("table")[0];
// Rows are found by their size's NAME, not by "· N oz" — the panel prints that
// suffix only when the name doesn't already carry the ounces.
const boardRow = (label) => [...boardTable().querySelectorAll("tbody tr")]
  .find((r) => r.querySelector("td").textContent.startsWith(label));
const beerTable = () => screen.getAllByRole("table").at(-1);

describe("PricingPanel", () => {
  it("prices every size on the board", () => {
    renderPanel();
    const rows = [...boardTable().querySelectorAll("tbody tr")];
    expect(rows).toHaveLength(5);
    expect(rows[0].textContent).toMatch(/8 oz/);
  });

  // "12 oz · 12 oz" is a stutter; the size is only worth repeating when the
  // name doesn't already carry it.
  it("does not repeat a size that is already in its name", () => {
    renderPanel();
    expect(boardRow("Half pour").querySelector("td").textContent).toBe("Half pour · 8 oz");
    expect(boardRow("12 oz").querySelector("td").textContent).toBe("12 oz");
  });

  // The comparison a flat board hides: one price for 12 and 16 oz makes the
  // pint the cheapest beer on the menu per ounce.
  it("prints the per-ounce price that a flat board obscures", () => {
    renderPanel();
    const cellsFor = (label) =>
      [...boardRow(label).querySelectorAll("td")].map((td) => td.textContent);
    // $7.00 / 12 oz = $0.583; $8.00 / 16 oz = $0.500.
    expect(cellsFor("12 oz")[2]).toBe("$0.583");
    expect(cellsFor("16 oz pint")[2]).toBe("$0.500");
  });

  // The finding the whole view exists for: a price compared straight against a
  // cost per pint skips tax, card and excise entirely.
  it("walks a board price down to what actually reaches the brewery", () => {
    renderPanel();
    expect(screen.getByText(/Sales tax at 8\.25%/)).toBeInTheDocument();
    expect(screen.getByText(/charged on the whole swipe, tax included/)).toBeInTheDocument();
    expect(screen.getByText(/= Net revenue/)).toBeInTheDocument();
  });

  it("states which tax basis every figure on the screen assumes", () => {
    renderPanel();
    expect(screen.getByLabelText("Sales tax basis")).toHaveValue("included");
    expect(screen.getByText(/of sales tax passing through/)).toBeInTheDocument();
  });

  it("switches the basis and stores it under settings.costs", () => {
    const { setSettings } = renderPanel();
    fireEvent.change(screen.getByLabelText("Sales tax basis"), { target: { value: "added" } });
    expect(applied(setSettings).costs.taxBasis).toBe("added");
  });

  // Editing the board here edits the brewery's board, exactly as an ingredient
  // price edited in a Cost view changes it for every recipe.
  it("edits a board price in place", () => {
    const { setSettings } = renderPanel();
    fireEvent.change(screen.getByLabelText("16 oz pint price"), { target: { value: "9.00" } });
    const board = applied(setSettings).costs.servings;
    expect(board.find((s) => s.oz === 16).price).toBe("9.00");
  });

  it("recommends against the target margin, and re-solves when it changes", () => {
    const { setSettings } = renderPanel();
    fireEvent.change(screen.getByLabelText("target margin"), { target: { value: "30" } });
    expect(applied(setSettings).costs.targetMarginPct).toBe("30");
  });

  // The per-beer pour is a property of the beer, so the control writes to the
  // recipe's free-form `process` map — no migration, per 0005.
  it("writes a per-beer pour onto the recipe", () => {
    const { setRecs } = renderPanel();
    fireEvent.change(screen.getByLabelText("Kolsch pour size"), { target: { value: "12" } });
    const next = setRecs.mock.calls.at(-1)[0]([kolsch, panda]);
    expect(next[0].process.pourOz).toBe("12");
    expect(next[1]).toBe(panda);
  });

  // "House pour" and "pour zero ounces" are different answers.
  it("removes the override rather than storing a zero", () => {
    const { setRecs } = renderPanel();
    fireEvent.change(screen.getByLabelText("Red Panda pour size"), { target: { value: "" } });
    const next = setRecs.mock.calls.at(-1)[0]([kolsch, panda]);
    expect(next[1].process.pourOz).toBeUndefined();
  });

  it("shows each beer at its own pour", () => {
    renderPanel();
    const row = within(beerTable()).getByText("Red Panda").closest("tr");
    expect(within(row).getByLabelText("Red Panda pour size")).toHaveValue("8");
    expect(within(beerTable()).getByLabelText("Kolsch pour size")).toHaveValue("");
  });

  // Half the beer at the same price. The pour size is a bigger lever on margin
  // than any grain bill, which is the point of putting it on the row.
  it("makes a half pour at the pint price the best thing on the board", () => {
    renderPanel();
    const profitOf = (name) => {
      const row = within(beerTable()).getByText(name).closest("tr");
      return [...row.querySelectorAll("td")][5].textContent;
    };
    // Strips the whole rendering, not just the first symbol a cell happens to
    // carry: a profit can print as "$5.95", "−$0.05" or "≤ $5.95" depending on
    // sign and on whether the cost behind it was complete.
    const parse = (t) => Number(t.replace(/\u2212/g, "-").replace(/[^\d.-]/g, ""));
    expect(parse(profitOf("Red Panda"))).toBeGreaterThan(parse(profitOf("Kolsch")));
  });

  // An unconfirmed rent is not free rent, so a margin built on it is a ceiling.
  it("says the margins are ceilings when an operating cost is missing", () => {
    renderPanel({ settings: { ...settings, costs: { rent: 6000 } } });
    expect(screen.getByText(/every margin is a ceiling/)).toBeInTheDocument();
    expect(screen.getByText(/Austin Energy/)).toBeInTheDocument();
  });

  it("says nothing of the sort once every input is in", () => {
    renderPanel();
    expect(screen.queryByText(/every margin is a ceiling/)).not.toBeInTheDocument();
  });

  // A size nobody sells yet gets a recommendation, not a margin of −100%.
  it("recommends a price for a size that is not on the board", () => {
    renderPanel();
    const row = boardRow("64 oz growler");
    expect(row.textContent).toMatch(/not on the board/);
    const cells = [...row.querySelectorAll("td")].map((td) => td.textContent);
    expect(cells[5]).toBe("—");                 // no profit to report
    expect(cells[7]).toMatch(/^\$\d/);          // but a price to aim at
  });

  // The header is a real <button>, so Enter and Space work and the sort state
  // stays on the <th> where it describes the column. Sorting used to be
  // mouse-only (CodeRabbit on #97).
  it("sorts the beer table from a keyboard", () => {
    renderPanel();
    const header = within(beerTable()).getByRole("button", { name: "Beer" });
    fireEvent.click(header);
    expect(header.closest("th")).toHaveAttribute("aria-sort", "ascending");
    fireEvent.click(header);
    expect(header.closest("th")).toHaveAttribute("aria-sort", "descending");
  });

  it("names what it does not model rather than pricing as though it did", () => {
    renderPanel();
    expect(screen.getByText(/punch-card redemption are not/)).toBeInTheDocument();
    expect(screen.getByText(/tank occupancy would/)).toBeInTheDocument();
  });
});
