import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import BrewSheetPanel from "./BrewSheetPanel";

// buildBrewSheet() owns the routing and brewSheet.test.js owns that. This file
// guards the PAPER and the one piece of state the panel carries itself: the
// three kinds of reading (editable-and-persisted, mirrored, tick-box) and the
// rule that an Actual is never filled in for the brewer.
//
// ⚠️ A double batch prints two pages at SINGLE-batch amounts — two brews, one
// sheet each. Doubling the numbers on one page would be a different beer.
const recipe = {
  n: "All Y'alls", s: "New England IPA", og: 1.062, fg: 1.012, abv: null, mt: 155, ft: 68,
  m: [["2-Row", 185], ["White Wheat", 55]],
  h: [
    ["Cascade", 12, "boil", 10],
    ["Amarillo", 12, "whirlpool", 20],
    ["Mosaic", 48, "dryhop1", 0],       // cellar: belongs on the OTHER sheet
  ],
  y: [["K97", 1]],                       // pitched in the cellar, not on brew day
  a: [["Orange Peel", 3, "oz", "boil", 15]],
  sa: [["CaCl2", 100, "mash"], ["CaSo4", 40, "sparge"], ["Baking Soda", 30, "boil"]],
  sc: [],
  process: { strikeTemp: "164" },
};

const renderPanel = (over = {}) => {
  const setRecs = vi.fn();
  const recs = over.recs || [{ n: "Other" }, "recipe" in over ? over.recipe : recipe];
  const utils = render(
    <BrewSheetPanel recipe={"recipe" in over ? over.recipe : recipe} ri={over.ri ?? 1} setRecs={setRecs} />
  );
  return { ...utils, setRecs, recs };
};

const pages = () => document.querySelectorAll(".brew-page");
const page = (n = 0) => pages()[n];
// A titled box, found by its heading ELEMENT — a title can repeat as a label.
const box = (title, n = 0) => within(page(n)).getAllByText(title)
  .find((el) => el.tagName === "DIV" && el.parentElement?.tagName === "DIV").parentElement;
const readingRow = (label, n = 0) => [...page(n).querySelectorAll("tbody tr")]
  .find((r) => r.querySelector("td")?.textContent.trim() === label);
const actualCell = (row) => row.querySelectorAll("td")[2];
const applied = (setRecs, recs) => setRecs.mock.calls.at(-1)[0](recs);

afterEach(() => vi.restoreAllMocks());

describe("BrewSheetPanel", () => {
  it("says so plainly when no recipe is selected", () => {
    renderPanel({ recipe: null });
    expect(screen.getByText("No recipe selected.")).toBeInTheDocument();
    expect(pages()).toHaveLength(0);
  });

  describe("the sheet", () => {
    it("prints the grain bill and its total", () => {
      renderPanel();
      const grain = box("Grain Bill (lbs)");
      expect(within(grain).getByText("2-Row")).toBeInTheDocument();
      const total = [...grain.querySelectorAll("tr")].find((r) => r.textContent.startsWith("Total"));
      expect(total.textContent).toMatch(/240$/); // 185 + 55
    });

    it("prints brew-day additions with their stage and time", () => {
      renderPanel();
      const adds = box("Hops & Additions");
      const cascade = within(adds).getByText("Cascade").closest("tr");
      expect([...cascade.querySelectorAll("td")].map((td) => td.textContent))
        .toEqual(["Cascade", "boil", "10", "12 oz"]);
      expect(within(adds).getByText("Orange Peel")).toBeInTheDocument();
    });

    // ⚠️ A dry hop printed on the brew sheet reads as a kettle addition, and
    // yeast is pitched in the cellar. Both belong to the Cellar Sheet.
    it("keeps cellar additions and yeast off the brew sheet", () => {
      renderPanel();
      const adds = box("Hops & Additions");
      expect(within(adds).queryByText("Mosaic")).not.toBeInTheDocument();
      expect(within(adds).queryByText("K97")).not.toBeInTheDocument();
    });

    it("leaves blank rows to write extra additions into", () => {
      renderPanel();
      const rows = [...box("Hops & Additions").querySelectorAll("tbody tr")];
      expect(rows.length).toBe(3 + 4); // three brew-day additions plus the write-in blanks
    });

    it("prints target gravities to three decimals and derives the ABV", () => {
      renderPanel();
      expect(within(page()).getByText("1.062")).toBeInTheDocument();
      expect(within(page()).getByText("1.012")).toBeInTheDocument();
      // (1.062 − 1.012) × 131.25 = 6.6%, derived rather than left blank because
      // the recipe stores no abv.
      expect(within(page()).getByText("6.6")).toBeInTheDocument();
    });

    it("leaves date, brewer and serial as write-in fields", () => {
      renderPanel();
      for (const label of ["Date", "Brewer(s)", "Serial"]) {
        expect(within(page()).getByText(label)).toBeInTheDocument();
      }
    });
  });

  describe("water salts", () => {
    // The template pre-prints its own rows so the sheet matches the paper form
    // the brewers already know; the recipe fills in the amounts it specifies.
    it("pre-prints the template's rows and fills the amounts the recipe sets", () => {
      renderPanel();
      const mash = box("Mash Adds (g)");
      const cacl2 = [...mash.querySelectorAll("tr")].find((r) => r.textContent.startsWith("CaCl2"));
      expect(cacl2.textContent).toMatch(/100$/);
      // A template row the recipe says nothing about stays a blank write-in.
      const chalk = [...mash.querySelectorAll("tr")].find((r) => r.textContent.startsWith("Chalk"));
      expect(chalk.querySelectorAll("td")[1].textContent.trim()).toBe("");
    });

    it("gives sparge salts their own box when the recipe has some", () => {
      renderPanel();
      expect(within(box("Sparge Adds (g)")).getByText("CaSo4")).toBeInTheDocument();
    });

    it("leaves the sparge box off entirely when it has none", () => {
      renderPanel({ recipe: { ...recipe, sa: [["CaCl2", 100, "mash"]] } });
      expect(within(page(0)).queryByText("Sparge Adds (g)")).not.toBeInTheDocument();
    });

    // ⚠️ Nothing the recipe specifies may be dropped just because the paper form
    // never had a row for it.
    it("appends a recipe salt the template does not pre-print", () => {
      renderPanel({ recipe: { ...recipe, sa: [["Salt", 7, "mash"]] } });
      const row = [...box("Mash Adds (g)").querySelectorAll("tr")].find((r) => r.textContent.startsWith("Salt"));
      expect(row.textContent).toMatch(/7$/);
    });
  });

  describe("process readings", () => {
    // ⚠️ Three kinds, and the difference is the point: an editable Target is a
    // PLAN the brewer sets once and it persists; a mirror echoes the recipe; a
    // check is ticked by pen and never stored.
    it("persists an edited Target onto the recipe's process map", () => {
      const { setRecs, recs } = renderPanel();
      const strike = within(readingRow("Strike Temp")).getByRole("textbox");
      expect(strike).toHaveValue("164");

      fireEvent.change(strike, { target: { value: "168" } });
      const next = applied(setRecs, recs);
      expect(next[1].process.strikeTemp).toBe("168");
      expect(next[1].process).toMatchObject({ strikeTemp: "168" });
      expect(next[0]).toEqual({ n: "Other" }); // the other recipe is untouched
    });

    it("writes to the selected recipe's index, not the first one", () => {
      const { setRecs } = renderPanel({ ri: 0, recs: [recipe, { n: "Other" }] });
      fireEvent.change(within(readingRow("Mill Time")).getByRole("textbox"), { target: { value: "25" } });
      const next = applied(setRecs, [recipe, { n: "Other" }]);
      expect(next[0].process.millTime).toBe("25");
      expect(next[1].process).toBeUndefined();
    });

    // A pre-printed default is a suggestion, not a stored value — it shows as a
    // placeholder so an untouched field still prints the template's number
    // without claiming the brewer chose it.
    it("offers the template default as a placeholder until it is overridden", () => {
      renderPanel();
      const ph = within(readingRow("pH Final")).getByRole("textbox");
      expect(ph).toHaveValue("5.2");
      expect(ph).toHaveAttribute("placeholder", "5.2");
    });

    it("mirrors the mash temp from the recipe rather than letting it drift", () => {
      renderPanel();
      const row = readingRow("Mash Temp");
      expect(within(row).queryByRole("textbox")).not.toBeInTheDocument(); // read-only
      expect(row.querySelectorAll("td")[1].textContent.trim()).toBe("155");
    });

    it("prints an empty tick box for a brew-day prep step, and stores nothing", () => {
      const { setRecs } = renderPanel();
      const row = readingRow("Water Cycled");
      expect(row.querySelectorAll("td")[1].textContent.trim()).toBe(""); // no Target
      expect(actualCell(row).querySelector("span")).toBeTruthy();        // the box
      expect(setRecs).not.toHaveBeenCalled();
    });

    // ⚠️ The Actual column is the brew-day measurement. Pre-filling it would be
    // the app recording what happened.
    it("leaves every Actual blank", () => {
      renderPanel();
      for (const label of ["Strike Temp", "Mash Temp", "Boil Time", "pH Final"]) {
        expect(actualCell(readingRow(label)).textContent.trim()).toBe("");
      }
    });

    it("carries all three reading groups from the paper template", () => {
      renderPanel();
      for (const title of ["Mash", "Boil", "Whirlpool / Knockout"]) {
        expect(box(title)).toBeTruthy();
      }
    });
  });

  describe("single and double batches", () => {
    it("prints one unlabelled page for a single batch", () => {
      renderPanel();
      expect(pages()).toHaveLength(1);
      expect(within(page()).queryByText("#1")).not.toBeInTheDocument();
    });

    // ⚠️ Two pages at SINGLE-batch amounts: it is two brews, one sheet each.
    it("prints two numbered pages at single-batch amounts for a double", () => {
      renderPanel();
      fireEvent.click(screen.getByRole("checkbox"));
      expect(pages()).toHaveLength(2);
      expect(within(page(0)).getByText("1")).toBeInTheDocument();
      expect(within(page(1)).getByText("2")).toBeInTheDocument();

      const totalOf = (n) => [...box("Grain Bill (lbs)", n).querySelectorAll("tr")]
        .find((r) => r.textContent.startsWith("Total")).textContent;
      expect(totalOf(0)).toMatch(/240$/);
      expect(totalOf(1)).toMatch(/240$/); // NOT 480
    });

    it("says which mode it is in", () => {
      renderPanel();
      expect(screen.getByText("Single")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("checkbox"));
      expect(screen.getByText("Double (2 pages)")).toBeInTheDocument();
    });
  });

  describe("printing", () => {
    // ⚠️ LANDSCAPE, unlike the Cellar Sheet — this one lies on a bench.
    it("prints landscape US Letter, one page per batch", () => {
      const { container } = renderPanel();
      const css = container.querySelector("style").textContent;
      expect(css).toMatch(/@page\s*{\s*size:\s*letter landscape/);
      expect(css).toMatch(/page-break-after:\s*always/);
    });

    it("hides the controls from the printed page", () => {
      const { container } = renderPanel();
      expect(container.querySelector(".no-print")).toBeTruthy();
      expect(container.querySelector("style").textContent).toMatch(/\.no-print\s*{\s*display:\s*none/);
    });

    it("prints on request", () => {
      const print = vi.spyOn(window, "print").mockImplementation(() => {});
      renderPanel();
      fireEvent.click(screen.getByRole("button", { name: /Print/ }));
      expect(print).toHaveBeenCalled();
    });
  });
});
