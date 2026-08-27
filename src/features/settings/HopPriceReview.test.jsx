import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import HopPriceReview from "./HopPriceReview";

// ⚠️ Fabricated prices only — real vendor prices never enter this repo.

const hop = (over) => ({
  name: "Cascade", sku: "HOP-CAS", price: 16, year: 2025,
  matchedLabel: "Cascade Pellet - 11lb", available: [], conflict: false, ambiguous: false,
  ...over,
});

const show = (props = {}) => render(
  <HopPriceReview hops={[hop()]} currentByName={{}} effective="Apr 29, 2026" source="text"
    onApply={vi.fn()} onCancel={vi.fn()} {...props} />,
);

describe("HopPriceReview", () => {
  it("previews the per-ounce price a per-pound quote becomes", () => {
    show();
    expect(screen.getByText("$1.00")).toBeInTheDocument();   // $16/lb ÷ 16
  });

  // ⚠️ The regression this test exists for. A hop ADOPTED from the spot list has
  // no row in products.js — its SKU was synthesised from the variety name — and
  // the converter used to look the SKU up there and give up, leaving the New
  // column blank for exactly the hops the catalog ingest had just added. Every
  // row on a spot hop list is quoted per pound; that is the fallback.
  it("converts a hop products.js has never heard of", () => {
    show({ hops: [hop({ name: "Nelson Sauvin", sku: "HOP-NELSONSAUVIN", price: 16 })] });
    expect(screen.getByText("$1.00")).toBeInTheDocument();
  });

  it("offers to apply a price that moved, on an adopted hop as much as a stocked one", () => {
    const onApply = vi.fn();
    show({
      hops: [hop({ name: "Nelson Sauvin", sku: "HOP-NELSONSAUVIN", price: 16 })],
      currentByName: { "Nelson Sauvin": 0.5 },
      onApply,
    });
    fireEvent.click(screen.getByText(/Apply 1 hop price/));
    expect(onApply).toHaveBeenCalledWith([
      expect.objectContaining({ name: "Nelson Sauvin", sku: "HOP-NELSONSAUVIN", perLb: 16, to: 1 }),
    ]);
  });

  it("says plainly when the list doesn't carry a hop, rather than guessing", () => {
    show({ hops: [hop({ name: "Pink Boots 2025", sku: "HOP-PB25", price: null, year: null, matchedLabel: null })] });
    expect(screen.getByText("not found on this list")).toBeInTheDocument();
  });

  describe("the catalog it would ingest", () => {
    const catalog = {
      added: [{ sku: "HOP-NELSONSAUVIN", name: "Nelson Sauvin" }],
      discontinued: [],
      next: new Array(620),
      counts: { rows: 69, varieties: 57, priced: 57, unpriced: 0, skippedVariants: 10, unnamed: 0, unfamiliar: 46 },
    };

    it("reports what the rest of the list would add", () => {
      show({ catalog });
      expect(screen.getByText(/1 variety would be added, for 620 products in total/)).toBeInTheDocument();
      expect(screen.getByText(/57 varieties read from 69 rows/)).toBeInTheDocument();
    });

    // The same honesty the price table keeps: say what was left out and why.
    // Extract isn't even quoted per pound, so carrying it would be a plain lie.
    it("says how many Cryo and extract rows it dropped", () => {
      show({ catalog });
      expect(screen.getByText(/10 Cryo\/extract rows skipped/)).toBeInTheDocument();
    });

    // A list can carry new varieties without moving a single price we hold.
    it("can be applied when no price moved but the catalog has work", () => {
      const onApply = vi.fn();
      show({ catalog, currentByName: { Cascade: 1 }, onApply });
      fireEvent.click(screen.getByText(/Apply no hop prices \+ 1 varieties/));
      expect(onApply).toHaveBeenCalled();
    });

    it("names a hop we buy that this list has stopped carrying", () => {
      show({ catalog: { ...catalog, discontinued: [{ sku: "HOP-LEM", name: "Lemondrop" }] } });
      expect(screen.getByText(/not on this list: Lemondrop/)).toBeInTheDocument();
    });
  });
});
