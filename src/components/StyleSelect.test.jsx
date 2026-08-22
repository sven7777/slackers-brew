import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import StyleSelect from "./StyleSelect";
import { styleNames } from "../lib/beerStyles";

const renderSel = (value, onChange = vi.fn()) => {
  render(<StyleSelect id="s" value={value} onChange={onChange} />);
  return { onChange, field: () => screen.getByLabelText("Style", { selector: "#s" }) };
};

// The label lives in the parent, so query the control directly here.
const control = () => document.querySelector("#s");

describe("StyleSelect", () => {
  it("offers the catalog grouped by category", () => {
    renderSel("");
    expect(styleNames.length).toBeGreaterThan(100);
    expect(screen.getByRole("option", { name: "New England IPA" })).toBeInTheDocument();
    // Umlauts survive the export's XML entities (K&ouml;lsch).
    expect(screen.getByRole("option", { name: "Kölsch" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "IPA" })).toBeInTheDocument();
  });

  it("selects a catalog style", () => {
    const onChange = vi.fn();
    renderSel("", onChange);
    fireEvent.change(control(), { target: { value: "Witbier" } });
    expect(onChange).toHaveBeenCalledWith("Witbier");
  });

  // Slackers' own shorthand and anything a .bsmx import brings in must survive
  // being rendered — a picker that dropped unrecognized values would rewrite
  // recipe data on sight.
  it("keeps a style the guide doesn't list", () => {
    renderSel("NEIPA");
    expect(control()).toHaveValue("NEIPA");
    const group = screen.getByRole("group", { name: "On this recipe" });
    expect(within(group).getByRole("option", { name: "NEIPA" })).toBeInTheDocument();
  });

  it("does not add an extra option for a style already in the catalog", () => {
    renderSel("Witbier");
    expect(screen.queryByRole("group", { name: "On this recipe" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("option", { name: "Witbier" })).toHaveLength(1);
  });

  it("falls back to a text box for a house style, and back again", () => {
    const onChange = vi.fn();
    renderSel("", onChange);
    fireEvent.change(control(), { target: { value: "__custom__" } });

    const box = control();
    expect(box.tagName).toBe("INPUT");
    fireEvent.change(box, { target: { value: "Slackers Table Beer" } });
    expect(onChange).toHaveBeenCalledWith("Slackers Table Beer");

    fireEvent.click(screen.getByRole("button", { name: "Use list" }));
    expect(control().tagName).toBe("SELECT");
  });

  it("treats an empty style as none, not as a catalog entry", () => {
    renderSel(null);
    expect(control()).toHaveValue("");
    expect(screen.getByRole("option", { name: "— none —" }).selected).toBe(true);
  });
});
