import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import CellarPanel from "./CellarPanel";

// The date math is buildCellarSheet's, and cellarSheet.test.js owns it. What
// this file guards is the PAPER: that every scheduled step reaches the box it
// belongs in, that a Target is never confused with an Actual, and that a step
// with no date still leaves a line to write on. A cellar sheet that quietly
// drops a dry hop date is worse than one that prints nothing at all — the crew
// works off the sheet, not off the app.
//
// Brew date 2026-06-01, so every offset below reads as June.
const BREW_DATE = "2026-06-01";

const recipe = {
  n: "All Y'alls", s: "New England IPA", og: 1.062, fg: 1.012, mt: 155, ft: 68,
  m: [["2-Row", 185]],
  h: [
    ["Cascade", 12, "boil", 10],          // brew day: belongs on the OTHER sheet
    ["Cascade", 48, "dryhop1", 0],
    ["Mosaic", 32, "dryhop2", 0],
  ],
  y: [["K97", 1]],
  a: [["Coffee", 5, "lbs", "secondary", 0], ["Clarity Ferm", 125, "ml", "transfer", 0]],
  sa: [],
  sc: [
    [0, "Brew Date"], [11, "Step Crash 55"], [11, "Bung | Pressure"],
    [12, "Blow Off"], [12, "Dry Hop 1"], [13, "Rouse"], [13, "Step Crash 40"],
    [14, "Step Crash 33"], [16, "Dry Hop 2"], [19, "Transfer"], [20, "Carb"], [20, "Keg"],
  ],
};

const renderPanel = (over = {}) => {
  const utils = render(<CellarPanel recipe={"recipe" in over ? over.recipe : recipe} />);
  if (over.brewDate !== null) {
    fireEvent.change(screen.getByLabelText(/Brew date/), { target: { value: over.brewDate || BREW_DATE } });
  }
  return utils;
};

// A titled box on the sheet, by its section heading. ⚠️ Found by the heading
// ELEMENT, not the text: "Bung" is both a box title and a row label inside it.
const box = (title) => screen.getAllByText(title)
  .find((el) => el.tagName === "DIV" && el.parentElement?.tagName === "DIV").parentElement;
// Matched on the row's own label cell: a box's title can repeat as one of its
// row labels ("Bung"), and a box can hold more than one table (Transfer / Carb
// has a Tanks Involved table above its Target/Actual one).
const rowFor = (title, label) => [...box(title).querySelectorAll("tbody tr")]
  .find((r) => r.querySelector("td")?.textContent.trim() === label);
// Target is the second cell of a Target/Actual row, Actual the third — and
// Actual is ALWAYS blank, because it is what the brewer writes on the tank.
const target = (row) => row.querySelectorAll("td")[1].textContent.trim();
const actual = (row) => row.querySelectorAll("td")[2].textContent.trim();

afterEach(() => vi.restoreAllMocks());

describe("CellarPanel", () => {
  it("says so plainly when no recipe is selected", () => {
    renderPanel({ recipe: null, brewDate: null });
    expect(screen.getByText("No recipe selected.")).toBeInTheDocument();
  });

  it("prints the sheet before a brew date is entered, with the dates left blank", () => {
    renderPanel({ brewDate: null });
    expect(screen.getByText("All Y'alls")).toBeInTheDocument();
    expect(target(rowFor("Bung", "Bung"))).toBe("");
    // The schedule is still the source; it just has nothing to count from yet.
    expect(screen.getByText("Dry Hop")).toBeInTheDocument();
  });

  it("fills every dated box from the recipe's own schedule", () => {
    renderPanel();
    expect(target(rowFor("Bung", "Bung"))).toBe("Fri 6/12");       // day 11
    expect(target(rowFor("Cold Crashing", "CC 55"))).toBe("Fri 6/12");
    expect(target(rowFor("Cold Crashing", "CC 40"))).toBe("Sun 6/14");
    expect(target(rowFor("Cold Crashing", "CC 33"))).toBe("Mon 6/15");
    expect(target(rowFor("Transfer / Carb", "Transfer"))).toBe("Sat 6/20");
    expect(target(rowFor("Transfer / Carb", "Carb Date"))).toBe("Sun 6/21");
  });

  // ⚠️ The Target|Actual convention, borrowed 1:1 from the Brew Sheet. A
  // pre-filled Actual would be the app telling the cellar what happened.
  it("leaves every Actual blank for the tank to fill in", () => {
    renderPanel();
    expect(actual(rowFor("Bung", "Bung"))).toBe("");
    expect(actual(rowFor("Cold Crashing", "CC 55"))).toBe("");
    expect(actual(rowFor("Transfer / Carb", "Transfer"))).toBe("");
  });

  it("leaves a blank write-in line for a step the schedule does not date", () => {
    renderPanel();
    // Carb Level / Time / Finished Beer have no schedule action at all.
    expect(target(rowFor("Transfer / Carb", "Carb Level"))).toBe("");
    expect(target(rowFor("Temp Raising", "Rs. 64"))).toBe("");
  });

  describe("dry hop", () => {
    // ⚠️ The bug migration 0011 exists for. A double dry hop is two charges on
    // two DIFFERENT days; before the charges were numbered there was nothing to
    // pair a hop with its day, so the sheet printed one date against the first
    // hop row and lost the second charge entirely.
    it("prints one block per charge, each dated from its own scheduled day", () => {
      renderPanel();
      const dryHop = box("Dry Hop");
      const cascade = within(dryHop).getByText("Cascade").closest("tr");
      const mosaic = within(dryHop).getByText("Mosaic").closest("tr");
      expect(cascade.querySelectorAll("td")[2].textContent.trim()).toBe("Sat 6/13"); // day 12
      expect(mosaic.querySelectorAll("td")[2].textContent.trim()).toBe("Wed 6/17");  // day 16
    });

    it("labels the charges when there is more than one", () => {
      renderPanel();
      const dryHop = box("Dry Hop");
      expect(within(dryHop).getByText("Dry Hop 1")).toBeInTheDocument();
      expect(within(dryHop).getByText("Dry Hop 2")).toBeInTheDocument();
    });

    // A single dry hop needs no "1" to tell it apart from nothing.
    it("does not number a single charge", () => {
      const single = { ...recipe, h: [["Cascade", 48, "dryhop1", 0]], sc: [[0, "Brew Date"], [12, "Dry Hop 1"]] };
      renderPanel({ recipe: single });
      expect(within(box("Dry Hop")).queryByText("Dry Hop 1")).not.toBeInTheDocument();
      expect(within(box("Dry Hop")).getByText("Cascade")).toBeInTheDocument();
    });

    // The day is the thing that must not be lost: a charge scheduled but with
    // no hops written down yet still prints its date.
    it("prints a scheduled charge that has no hops listed against it", () => {
      const noHops = { ...recipe, h: [["Cascade", 12, "boil", 10]] };
      renderPanel({ recipe: noHops });
      const rows = within(box("Dry Hop")).getAllByText("Not listed").map((el) => el.closest("tr"));
      expect(rows[0].querySelectorAll("td")[1].textContent.trim()).toBe("Sat 6/13");
      expect(rows[1].querySelectorAll("td")[1].textContent.trim()).toBe("Wed 6/17");
    });

    it("says there is no dry hop rather than printing an empty block", () => {
      const none = { ...recipe, h: [["Cascade", 12, "boil", 10]], sc: [[0, "Brew Date"], [20, "Keg"]] };
      renderPanel({ recipe: none });
      expect(within(box("Dry Hop")).getByText("No dry hop.")).toBeInTheDocument();
    });

    // Boil and whirlpool hops belong to the Brew Sheet. Printing them here
    // would read as a second dose.
    it("keeps brew-day hops off the cellar sheet", () => {
      renderPanel();
      expect(within(box("Dry Hop")).queryByText("12 oz")).not.toBeInTheDocument();
    });
  });

  describe("misc additions", () => {
    // ⚠️ A name and an amount alone never said WHEN it goes in — primary or
    // transfer — and left the crew nothing to record against.
    it("prints each addition's stage under its name", () => {
      renderPanel();
      const coffee = within(box("Misc. Additions")).getByText("Coffee").closest("tr");
      expect(coffee.textContent).toMatch(/Secondary/i);
      expect(coffee.querySelectorAll("td")[1].textContent).toBe("5 lbs");
    });

    it("dates only the stages a schedule action actually pins down", () => {
      renderPanel();
      const misc = box("Misc. Additions");
      const clarity = within(misc).getByText("Clarity Ferm").closest("tr");
      expect(clarity.querySelectorAll("td")[2].textContent.trim()).toBe("Sat 6/20"); // transfer
      // "Secondary" maps to no scheduled step, so it stays a write-in rather
      // than printing a guessed date.
      const coffee = within(misc).getByText("Coffee").closest("tr");
      expect(coffee.querySelectorAll("td")[2].textContent.trim()).toBe("");
    });

    // The tick box is what separates a pending addition from a done one.
    it("gives every addition an empty Added box to mark", () => {
      renderPanel();
      const rows = [...box("Misc. Additions").querySelectorAll("tbody tr")];
      expect(rows).toHaveLength(2);
      for (const r of rows) {
        const added = r.querySelectorAll("td")[3];
        expect(added.textContent.trim()).toBe(""); // empty, not ticked
        expect(added.querySelector("span > span")).toBeTruthy(); // the box itself
      }
    });

    it("says None rather than printing an empty table", () => {
      renderPanel({ recipe: { ...recipe, a: [] } });
      expect(within(box("Misc. Additions")).getByText("None.")).toBeInTheDocument();
    });
  });

  describe("the hand-written blocks", () => {
    it("pre-fills the yeast and ferm temp it knows, and leaves the rest to the cellar", () => {
      renderPanel();
      expect(rowFor("Yeast", "Gen / Type").querySelectorAll("td")[1].textContent).toBe("K97");
      expect(rowFor("Yeast", "Ferm Temp").querySelectorAll("td")[1].textContent).toBe("68°F");
      expect(rowFor("Yeast", "K.O. Temp").querySelectorAll("td")[1].textContent.trim()).toBe("");
    });

    it("keeps blow-off lines to write on even when the schedule has fewer", () => {
      renderPanel();
      const rows = [...box("Blow Offs").querySelectorAll("tbody tr")];
      expect(rows.length).toBeGreaterThanOrEqual(5);
      expect(rows[0].querySelectorAll("td")[0].textContent.trim()).toBe("Sat 6/13");
      expect(rows[4].querySelectorAll("td")[0].textContent.trim()).toBe("");
    });

    it("pre-fills the packaging date from the schedule's keg step, once", () => {
      renderPanel();
      const rows = [...box("Packaging Summary").querySelectorAll("tbody tr")];
      expect(rows[0].querySelectorAll("td")[0].textContent.trim()).toBe("Sun 6/21");
      expect(rows[1].querySelectorAll("td")[0].textContent.trim()).toBe("");
    });

    it("prints the target gravities to three decimals in the header", () => {
      renderPanel();
      expect(screen.getByText("1.062")).toBeInTheDocument();
      expect(screen.getAllByText("1.012").length).toBeGreaterThan(0); // header + gravity log
    });

    it("leaves serial and tank as write-in fields", () => {
      renderPanel();
      expect(screen.getByText("Serial")).toBeInTheDocument();
      expect(screen.getByText("Tank")).toBeInTheDocument();
    });
  });

  describe("printing", () => {
    // ⚠️ PORTRAIT, because this one hangs on a clipboard on the fermenter —
    // unlike the Brew Sheet, which is landscape on a bench.
    it("prints portrait US Letter", () => {
      const { container } = renderPanel();
      const css = container.querySelector("style").textContent;
      expect(css).toMatch(/@page\s*{\s*size:\s*letter portrait/);
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
