import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OrderEstimate from "./OrderEstimate";

// ⚠️ Fabricated prices only — never a real vendor number, fixtures included.

const order = {
  malts: [{ n: "Munich", need: 40, have: 0, order: 40 }],
  hops: [{ n: "Saaz", need: 20, have: 0, order: 20 }],
  yeast: [],
  adj: [],
};
const inventory = {
  malts: [{ n: "Munich", q: 0, cpu: 1 }],
  hops: [{ n: "Saaz", q: 0, cpu: 1 }],
  yeast: [],
  adj: [],
};

describe("OrderEstimate", () => {
  it("prices the order in whole packs", async () => {
    render(<OrderEstimate order={order} {...inventory} />);
    // 40 lbs of Munich is one 55 lb sack; 20 oz of Saaz is one 11 lb box.
    expect(await screen.findByText("1 × 55lb")).toBeInTheDocument();
    expect(screen.getByText("1 × 11lb")).toBeInTheDocument();
    expect(screen.getByText("$231.00")).toBeInTheDocument(); // 55 + 176
  });

  it("copies the email list to the clipboard", async () => {
    const user = userEvent.setup();
    // Spy rather than replace: user-event's setup() installs its own clipboard
    // stub and defines it getter-only, so assigning over it throws.
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    render(<OrderEstimate order={order} {...inventory} />);
    await user.click(await screen.findByRole("button", { name: /copy for email/i }));
    expect(writeText).toHaveBeenCalledWith("Malts\n1 Munich (55lb)\n\nHops\n1 Saaz (11lb)");
    await waitFor(() => expect(screen.getByRole("button", { name: /copied/i })).toBeInTheDocument());
  });

  it("renders nothing when everything is in stock", () => {
    const { container } = render(
      <OrderEstimate order={{ malts: [{ n: "Munich", order: 0 }], hops: [], yeast: [], adj: [] }} {...inventory} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
