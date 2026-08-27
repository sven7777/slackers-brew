import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CatalogBrowser from "./CatalogBrowser";
import { setBackend, resetBackend } from "../lib/repo";

// ⚠️ Fabricated prices — real vendor prices never enter this repo. The names and
// SKUs are real rows from a BSG Houston list.
const CATALOG = [
  { sku: "MRAH1173", name: "Rahr To Thee! Pils™", vendor: "Rahr", category: "malt", price: 1, packQty: 1, packUnit: "lb", effective: "2026-08-24" },
  { sku: "MGAM1016", name: "Gambrinus Munich Light", vendor: "Gambrinus", category: "malt", price: 2, packQty: 1, packUnit: "lb" },
  { sku: "AZZZ4101", name: "Honey - Clover (USA) - 60 lb", vendor: null, category: null, price: 120, packQty: 60, packUnit: "lb" },
  { sku: "AZZZ4102", name: "Honey - Clover (USA) - 5 lb", vendor: null, category: null, price: 15, packQty: 5, packUnit: "lb" },
  { sku: "AZZZ1771", name: "Candi Syrup Dark - 25 kg", vendor: null, category: null, price: 100, packQty: 25, packUnit: "kg", effective: "2026-08-24" },
  { sku: "XZZZ0100", name: "Xtratuf Boots", vendor: null, category: "other", price: 100, packQty: null, packUnit: null },
];

const withCatalog = (entries) => setBackend({
  load: (key, fallback) => (key === "catalog" ? entries : fallback),
  save: () => {},
});

const inventory = { malts: [{ n: "Pils", q: 0 }], hops: [], yeast: [], adj: [] };

const open = (props = {}) => render(
  <CatalogBrowser open inventory={inventory} onAdopt={props.onAdopt ?? vi.fn()} onClose={props.onClose ?? vi.fn()} {...props} />,
);

afterEach(() => resetBackend());

describe("CatalogBrowser", () => {
  it("renders nothing at all while closed", () => {
    withCatalog(CATALOG);
    render(<CatalogBrowser open={false} onAdopt={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // The catalog arrives with a price import. Saying so beats an empty list,
  // which reads as a broken feature.
  it("points at the price import when there is no catalog yet", async () => {
    withCatalog([]);
    open();
    expect(await screen.findByText(/No vendor catalog yet/)).toBeInTheDocument();
  });

  it("searches by name, vendor or SKU", async () => {
    withCatalog(CATALOG);
    open();
    fireEvent.change(await screen.findByLabelText("Search the catalog"), { target: { value: "gambrinus" } });
    expect(screen.getByText("Gambrinus Munich Light")).toBeInTheDocument();
    expect(screen.queryByText("Rahr To Thee! Pils™")).not.toBeInTheDocument();
  });

  it("keeps equipment and merchandise behind the toggle", async () => {
    withCatalog(CATALOG);
    open();
    fireEvent.change(await screen.findByLabelText("Search the catalog"), { target: { value: "boots" } });
    expect(screen.queryByText("Xtratuf Boots")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText(/Show everything/));
    expect(screen.getByText("Xtratuf Boots")).toBeInTheDocument();
  });

  it("adopts a product as an inventory row at quantity zero, with its SKU", async () => {
    withCatalog(CATALOG);
    const onAdopt = vi.fn();
    open({ onAdopt });
    fireEvent.change(await screen.findByLabelText("Search the catalog"), { target: { value: "MGAM1016" } });
    fireEvent.click(screen.getByText("Add…"));

    // The suggested name drops the vendor prefix the SKU already tells us.
    expect(screen.getByLabelText("Short name")).toHaveValue("Munich Light");
    fireEvent.click(screen.getByText("Add to inventory"));
    expect(onAdopt).toHaveBeenCalledWith("malt",
      expect.objectContaining({ n: "Munich Light", q: 0, sku: "MGAM1016", cpu: 2 }),
      expect.objectContaining({ sku: "MGAM1016" }));
  });

  // ⚠️ The Carafa lesson: one sack became three inventory rows because nothing
  // ever asked. A warning, not a block — the brewer is the one who knows.
  it("warns when the shelf already has that name", async () => {
    withCatalog(CATALOG);
    open();
    fireEvent.change(await screen.findByLabelText("Search the catalog"), { target: { value: "to thee" } });
    fireEvent.click(screen.getByText("Add…"));
    fireEvent.change(screen.getByLabelText("Short name"), { target: { value: "Pils" } });
    expect(screen.getByText(/You already stock/)).toBeInTheDocument();
    expect(screen.getByText("Add to inventory")).not.toBeDisabled();
  });

  // The payoff of classify() leaving ~311 rows alone: nobody classifies 311
  // things, but a brewer will classify the one they are buying.
  it("will not adopt an unclassified product until a category is chosen", async () => {
    withCatalog(CATALOG);
    open();
    fireEvent.change(await screen.findByLabelText("Search the catalog"), { target: { value: "clover" } });
    fireEvent.click(screen.getAllByText("Add…")[0]);
    expect(screen.getByText("Add to inventory")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "adj" } });
    expect(screen.getByText("Add to inventory")).not.toBeDisabled();
  });

  // Two SKUs, one product, two very different derived prices. The catalog can't
  // know which size Slackers orders, so it asks.
  it("offers the pack sizes a product ships in and re-costs on the choice", async () => {
    withCatalog(CATALOG);
    open();
    fireEvent.change(await screen.findByLabelText("Search the catalog"), { target: { value: "clover" } });
    fireEvent.click(screen.getAllByText("Add…")[0]);
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "adj" } });
    expect(screen.getByText("$3.00")).toBeInTheDocument();      // 5 lb at $15
    fireEvent.change(screen.getByLabelText("Pack size"), { target: { value: "AZZZ4101" } });
    expect(screen.getByText("$2.00")).toBeInTheDocument();      // 60 lb at $120
  });

  // ⚠️ The Adjuncts table opened onto an empty panel until the locked browser
  // learned to include the unsorted pile: classify() names no adjuncts at all.
  it("shows unsorted products when locked to a table, labelled as unsorted", async () => {
    withCatalog(CATALOG);
    open({ category: "adj" });
    expect(await screen.findByText("Honey - Clover (USA) - 60 lb")).toBeInTheDocument();
    expect(screen.getAllByText(/· Unsorted/).length).toBeGreaterThan(0);
    expect(screen.queryByText("Gambrinus Munich Light")).not.toBeInTheDocument();
  });

  it("does not ask for a category the table already answered", async () => {
    withCatalog(CATALOG);
    open({ category: "malt" });
    fireEvent.change(await screen.findByLabelText("Search the catalog"), { target: { value: "munich" } });
    fireEvent.click(screen.getByText("Add…"));
    expect(screen.queryByLabelText("Category")).not.toBeInTheDocument();
    expect(screen.getByText(/the table you're adding to/)).toBeInTheDocument();
  });

  // Linking is the other direction: a row already on the shelf being told which
  // product it is. Prod's "Candi Sugar, Dark" was typed in by hand — no
  // product, no price, counted in "each" — and there was no way to say so.
  describe("link mode", () => {
    const row = { n: "Candi Sugar, Dark", q: 0, u: "each" };
    const openLink = (onLink) => render(
      <CatalogBrowser open category="adj" linkTo={row} inventory={inventory}
        onLink={onLink} onClose={vi.fn()} />,
    );

    it("asks which product the row is, not for a name or a category", async () => {
      withCatalog(CATALOG);
      openLink(vi.fn());
      expect(await screen.findByText("Which product is Candi Sugar, Dark?")).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText("Search the catalog"), { target: { value: "candi" } });
      fireEvent.click(screen.getByText("Choose"));
      expect(screen.queryByLabelText("Short name")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Category")).not.toBeInTheDocument();
      expect(screen.getByText("Link Candi Sugar, Dark")).toBeInTheDocument();
    });

    // ⚠️ The unit is the other half of the fix. A 25 kg pack against a row
    // counted in "each" reconciles to nothing, so the row would stay unpriced
    // however well it was linked.
    it("lets the unit be corrected, and says the cost follows it", async () => {
      withCatalog(CATALOG);
      const onLink = vi.fn();
      openLink(onLink);
      fireEvent.change(await screen.findByLabelText("Search the catalog"), { target: { value: "candi" } });
      fireEvent.click(screen.getByText("Choose"));
      expect(screen.getByText(/unpriced/)).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText("Counted in"), { target: { value: "lbs" } });
      expect(screen.getByText("$1.81")).toBeInTheDocument();      // 25 kg = 55.1 lb at $100
      expect(screen.getByText(/Changes what this ingredient is counted in/)).toBeInTheDocument();

      fireEvent.click(screen.getByText("Link Candi Sugar, Dark"));
      expect(onLink).toHaveBeenCalledWith("adj", "Candi Sugar, Dark",
        { sku: "AZZZ1771", vendor: null, cpu: 1.81, pricedAt: "2026-08-24", u: "lbs" },
        expect.objectContaining({ sku: "AZZZ1771" }));
    });

    it("does not warn about a duplicate name — the row is the one being linked", async () => {
      withCatalog(CATALOG);
      render(<CatalogBrowser open category="malt" linkTo={{ n: "Pils", q: 0 }} inventory={inventory}
        onLink={vi.fn()} onClose={vi.fn()} />);
      fireEvent.change(await screen.findByLabelText("Search the catalog"), { target: { value: "munich" } });
      fireEvent.click(screen.getByText("Choose"));
      expect(screen.queryByText(/You already stock/)).not.toBeInTheDocument();
    });
  });
});
