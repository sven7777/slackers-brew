import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import BeersPanel from "./BeersPanel";
import { costAllRecipes } from "../../lib/analytics";

// Fabricated prices; real vendor pricing stays out of this repo.
//
// The arithmetic is analytics.test.js's job. What this file guards is the
// panel's ONE editorial rule and the wiring that carries it: a beer whose cost
// is incomplete must never be presented as though it were costed — not in a
// total, not in an average, not in a count.
const inv = {
  malts: [{ n: "2-Row", q: 0, cpu: 1 }, { n: "Munich", q: 0 }], // Munich unpriced
  hops: [{ n: "Cascade", q: 0, cpu: 0.5 }],
  yeast: [{ n: "K97", q: 0, cpu: 80 }],
  adj: [],
};

const settings = { postBoilYield: 150, lossPct: 33 };

const kolsch = { n: "Kolsch", s: "Kolsch", m: [["2-Row", 100]], h: [["Cascade", 20, "boil", 60]], y: [["K97", 1]], a: [] };
const amber = { n: "Amber", s: "Amber Ale", m: [["2-Row", 200]], h: [], y: [["K97", 1]], a: [] };
// An unpriced ingredient: costable in part, and therefore not costed.
const blocked = { n: "Dunkel", s: "Munich Dunkel", m: [["2-Row", 50], ["Munich", 150]], h: [], y: [["K97", 1]], a: [] };
// ⚠️ No ingredients at all totals $0 and reports nothing missing, which would
// read as a beer that costs nothing to brew.
const empty = { n: "Sketch", s: "Saison", m: [], h: [], y: [], a: [] };

const renderPanel = (over = {}) => {
  const recs = over.recs || [kolsch, amber, blocked, empty];
  const openRecipeCost = vi.fn();
  const { rows, summary, blockers } = costAllRecipes({ recs, ...inv, settings });
  const utils = render(
    <BeersPanel rows={rows} summary={summary} blockers={blockers}
      asOf={over.asOf ?? "2026-08-01"} openRecipeCost={openRecipeCost} />
  );
  return { ...utils, openRecipeCost, rows, summary, blockers, recs };
};

const table = () => screen.getByText("🍺 Cost by Beer").closest("div").parentElement.querySelector("table");
const beerLink = (name) => within(table()).getByTitle(`Open ${name}'s cost breakdown`);
const beerRow = (name) => beerLink(name).closest("tr");
// ⚠️ SortableTh appends " ▲"/" ▼" to the ACTIVE column's label, so a header is
// matched by prefix — an exact name silently stops matching the moment that
// column becomes the one being sorted on.
const header = (label) => within(table()).getByRole("button", { name: new RegExp(`^${label.replace(/[$/]/g, "\\$&")}`) });
const beerNames = () => [...table().querySelectorAll("tbody tr")]
  .map((r) => r.querySelector("button").textContent);
const tile = (label) => screen.getByText(label).parentElement;

describe("BeersPanel", () => {
  it("lists every beer, including the ones it will not average", () => {
    renderPanel();
    expect(beerNames()).toEqual(["Amber", "Dunkel", "Kolsch", "Sketch"]); // alphabetical
  });

  it("invites a first recipe rather than rendering an empty table", () => {
    renderPanel({ recs: [] });
    expect(screen.getByText(/No recipes yet/)).toBeInTheDocument();
    expect(screen.queryByText("🍺 Cost by Beer")).not.toBeInTheDocument();
  });

  describe("an incomplete cost is never presented as a cost", () => {
    // ⚠️ The `+` convention: "at least this much". The row is shown, the total
    // is marked, and the beer is kept out of the averages.
    it("marks a partly-priced total as a floor", () => {
      renderPanel();
      const total = [...beerRow("Dunkel").querySelectorAll("td")][2].textContent;
      expect(total).toMatch(/\+$/);
      expect([...beerRow("Kolsch").querySelectorAll("td")][2].textContent).not.toMatch(/\+/);
    });

    it("names the ingredient holding the beer up, on the beer's own row", () => {
      renderPanel();
      expect(within(beerRow("Dunkel")).getByText("1 unpriced: Munich")).toBeInTheDocument();
    });

    // ⚠️ $0 with nothing reported missing is the one that reads as a real
    // answer. It gets its own words, not the unpriced ones.
    it("says a recipe with no ingredients is empty rather than free", () => {
      renderPanel();
      expect(within(beerRow("Sketch")).getByText("no ingredients yet")).toBeInTheDocument();
      expect([...beerRow("Sketch").querySelectorAll("td")][2].textContent).not.toMatch(/\+/);
    });

    // An average over two beers must never read as the average of four.
    it("counts what it averaged and says what it left out", () => {
      renderPanel();
      const counted = tile("Beers costed").textContent;
      expect(counted).toMatch(/2\s*of 4/);
      expect(counted).toMatch(/1 unpriced/);
      expect(counted).toMatch(/1 empty/);
      expect(counted).toMatch(/excluded below/);
    });

    it("says so plainly when every recipe is priced", () => {
      renderPanel({ recs: [kolsch, amber] });
      expect(tile("Beers costed").textContent).toMatch(/every recipe fully priced/);
    });

    it("says the totals are ingredients only and where the rest lives", () => {
      renderPanel();
      expect(screen.getByText(/Ingredients only/)).toBeInTheDocument();
      expect(screen.getByText(/a floor, not a cost/)).toBeInTheDocument();
    });

    it("dates the prices it costed against", () => {
      renderPanel();
      expect(screen.getByText("2026-08-01")).toBeInTheDocument();
    });
  });

  describe("the blockers table", () => {
    // The payoff the per-recipe warnings cannot give: each Cost view only ever
    // sees its own gap.
    it("ranks unpriced ingredients by how many beers each one holds up", () => {
      const other = { n: "Bock", s: "Bock", m: [["Munich", 200]], h: [], y: [["K97", 1]], a: [] };
      renderPanel({ recs: [kolsch, blocked, other] });
      const blockerRow = screen.getByText(/^Munich$/).closest("tr");
      expect(within(blockerRow).getByText("Bock, Dunkel")).toBeInTheDocument();
      expect([...blockerRow.querySelectorAll("td")][2].textContent).toBe("2");
    });

    it("says where to fix it, and that one entry fixes every beer beside it", () => {
      renderPanel();
      expect(screen.getByText(/one entry fixes every/)).toBeInTheDocument();
    });

    it("stays away entirely when nothing is blocked", () => {
      renderPanel({ recs: [kolsch, amber] });
      expect(screen.queryByText(/blocking/)).not.toBeInTheDocument();
    });

    it("agrees with itself about how many recipes are blocked", () => {
      renderPanel();
      expect(screen.getByText(/blocking 1 recipe$/)).toBeInTheDocument(); // singular
    });
  });

  describe("sorting", () => {
    // Name first, like every list a brewer scans. A money column opens at the
    // DEAR end instead, because that is the reason to sort by cost at all.
    it("opens on name ascending and a money column descending", () => {
      renderPanel();
      expect(beerNames()[0]).toBe("Amber");

      fireEvent.click(header("$ / bbl"));
      expect(header("$ / bbl").closest("th")).toHaveAttribute("aria-sort", "descending");
    });

    it("reverses a column that is already sorted", () => {
      renderPanel();
      fireEvent.click(header("Beer")); // already ascending -> descending
      expect(header("Beer").closest("th")).toHaveAttribute("aria-sort", "descending");
      expect(beerNames()[0]).toBe("Sketch");
    });
  });

  // Clicking a beer hands off into its own Cost view. The index is the
  // RECIPE's, not the sorted row's — sorting the table must not open a
  // different beer.
  it("opens the clicked beer's cost view by its recipe index, not its row", () => {
    const { openRecipeCost, recs } = renderPanel();
    fireEvent.click(beerLink("Kolsch"));
    expect(openRecipeCost).toHaveBeenCalledWith(recs.indexOf(kolsch));

    fireEvent.click(header("Beer")); // resort; the row moves, the index does not
    fireEvent.click(beerLink("Dunkel"));
    expect(openRecipeCost).toHaveBeenLastCalledWith(recs.indexOf(blocked));
  });

  it("survives being rendered without a handoff", () => {
    const { rows, summary, blockers } = costAllRecipes({ recs: [kolsch], ...inv, settings });
    render(<BeersPanel rows={rows} summary={summary} blockers={blockers} asOf={null} />);
    expect(() => fireEvent.click(screen.getByTitle("Open Kolsch's cost breakdown"))).not.toThrow();
  });

  it("names the cheapest and dearest beer per bbl", () => {
    renderPanel();
    const note = screen.getByText(/Cheapest per bbl is/);
    expect(note.textContent).toMatch(/Cheapest per bbl is Kolsch/);
    expect(note.textContent).toMatch(/dearest is Amber/);
  });

  it("says nothing of the sort when there is only one beer to compare", () => {
    renderPanel({ recs: [kolsch] });
    expect(screen.queryByText(/Cheapest per bbl is/)).not.toBeInTheDocument();
  });
});
