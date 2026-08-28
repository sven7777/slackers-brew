import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CostInputs from "./CostInputs";

const settings = { postBoilYield: 150, avgKegs: 6.5, lossPct: 33 };
const OVERHEAD = { rent: 6000, electric: 1500, water: 400, insurance: 600, otherFixed: 500, fohPayroll: 1000 };

const renderInputs = (over = {}) => {
  const setSettings = vi.fn();
  const utils = render(<CostInputs settings={settings} setSettings={setSettings} {...over} />);
  return { ...utils, setSettings };
};

// Apply the updater a setSettings mock was called with, so a test can assert on
// the settings object that would actually be stored.
const applied = (setSettings, prev = settings) => {
  const fn = setSettings.mock.calls.at(-1)[0];
  return typeof fn === "function" ? fn(prev) : fn;
};

describe("CostInputs", () => {
  it("flags the operating costs that haven't been entered", () => {
    renderInputs();
    expect(screen.getByText(/6 operating costs not entered yet/)).toBeInTheDocument();
    expect(screen.getByText(/left out of the cost per pint rather than counted as zero/)).toBeInTheDocument();
  });

  it("drops the warning once they're all filled in", () => {
    renderInputs({ settings: { ...settings, costs: OVERHEAD } });
    expect(screen.queryByText(/not entered yet/)).not.toBeInTheDocument();
  });

  // Print the basis on screen — the lesson from Settings and the Cost panel
  // silently disagreeing about volume.
  it("prints the annual volume and capacity it derives", () => {
    renderInputs();
    expect(screen.getByText(/40 batches/)).toBeInTheDocument();
    expect(screen.getByText(/130 bbl/)).toBeInTheDocument();
    expect(screen.getByText(/282 bbl/)).toBeInTheDocument();   // tank capacity
    expect(screen.getByText(/46%/)).toBeInTheDocument();       // utilization
  });

  it("prints pints sold, not pints packaged, as the denominator", () => {
    renderInputs();
    expect(screen.getByText(/30,647 pints sold/)).toBeInTheDocument();
  });

  it("writes a cost input under settings.costs without disturbing the rest", () => {
    const { setSettings } = renderInputs();
    fireEvent.change(screen.getByLabelText("Batches per year"), { target: { value: "60" } });
    const next = applied(setSettings);
    expect(next.costs.batchesPerYear).toBe("60");
    expect(next.postBoilYield).toBe(150); // untouched
  });

  it("edits a fermenter's working volume", () => {
    const { setSettings } = renderInputs();
    fireEvent.change(screen.getByLabelText("Fermenter 4 gallons"), { target: { value: "260" } });
    expect(applied(setSettings).costs.fermenters[3].gal).toBe("260");
  });

  it("adds and removes fermenters", () => {
    const { setSettings } = renderInputs();
    fireEvent.click(screen.getByText("+ Add fermenter"));
    expect(applied(setSettings).costs.fermenters).toHaveLength(5);

    setSettings.mockClear();
    fireEvent.click(screen.getByLabelText("Remove fermenter 1"));
    expect(applied(setSettings).costs.fermenters).toHaveLength(3);
  });

  it("switches the permit type and says what it costs on an $8 pint", () => {
    const { setSettings } = renderInputs();
    expect(screen.getByText(/No gross receipts tax on this permit/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Permit type"), { target: { value: "mb" } });
    expect(applied(setSettings).costs.permitType).toBe("mb");
  });

  it("shows the mixed beverage hit once that permit is selected", () => {
    renderInputs({ settings: { ...settings, costs: { permitType: "mb" } } });
    // 6.7% of $8.00
    expect(screen.getByText(/\$0\.54 gross receipts/)).toBeInTheDocument();
  });

  it("states that tips are not an employer cost", () => {
    renderInputs();
    expect(screen.getByText(/Tips are not an employer cost/)).toBeInTheDocument();
  });
});
