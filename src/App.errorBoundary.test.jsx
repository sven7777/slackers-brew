import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Force the Inventory tab to blow up the way the three shipped white screens
// did — an unguarded read during render. Proves the boundary is actually
// mounted in App.jsx, not merely correct in isolation.
vi.mock("./features/inventory/InventoryTab", () => ({
  default: () => {
    throw new Error("recs[selR] is undefined");
  },
}));

import App from "./App";

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("App crash containment", () => {
  it("contains a crashing tab instead of blanking the page", () => {
    render(<App />);
    expect(screen.getByText("Something went wrong here.")).toBeInTheDocument();
    // The shell survives: header and nav are outside the boundary.
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Recipes")).toBeInTheDocument();
  });

  it("lets the brewer escape to a working tab", () => {
    render(<App />);
    expect(screen.getByText("Something went wrong here.")).toBeInTheDocument();
    // Boundary is keyed by tab, so navigating away remounts it clean.
    fireEvent.click(screen.getByText("Settings"));
    expect(screen.queryByText("Something went wrong here.")).not.toBeInTheDocument();
  });
});
