import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// ⚠️ Fabricated prices throughout — the real lists are stamped confidential and
// this repo is public (see products.js).
//
// PriceImport is the ORCHESTRATOR: four sources, two reviews, one path into
// inventory. The parsers it calls are covered by their own tests. What this file
// guards is the routing and the reporting — which parser gets a file, which
// ingredients a review asks about, and what the brewer is told when half of an
// import succeeds.

const extractPdfLines = vi.fn();
const extractPdfWords = vi.fn();
const renderPdfPages = vi.fn();
vi.mock("../../lib/pdfText", () => ({
  extractPdfLines: (...a) => extractPdfLines(...a),
  extractPdfWords: (...a) => extractPdfWords(...a),
  renderPdfPages: (...a) => renderPdfPages(...a),
}));

const createReader = vi.fn();
vi.mock("../../lib/ocr", () => ({ createReader: (...a) => createReader(...a) }));

const load = vi.fn();
const save = vi.fn();
vi.mock("../../lib/repo", () => ({
  load: (...a) => load(...a),
  save: (...a) => save(...a),
}));

import PriceImport from "./PriceImport";

// A vendor price list, in the shape parsePriceList() actually reads: a line
// starting with a SKU and carrying a $ amount, with quantity-break columns after
// the first one.
const PRICE_LINES = [
  "BSG Houston price list — effective 08/01/2026",
  "All malt comes in 55lb bags unless specified          Pallet fee: $12.50 each",
  "  MRAH1102 Rahr Standard 2-Row              price / lb    $1.000      $0.900",
  "  MCRI1001 Crisp Maris Otter                price / lb    $2.000      $1.900",
  "  BZZZ1984 Fermentis SafAle BE-134 - 500 g  each          $40.00",
];

// The spot hop list: a variety x crop-year table, with no SKU anywhere in it.
const w = (text, x0, y0, { width = text.length * 10 } = {}) =>
  ({ text, x0, y0, x1: x0 + width, y1: y0 + 14, confidence: 95 });
const hopRow = (label, y, prices) => [
  ...label.split(" ").map((t, i) => w(t, 100 + i * 60, y)),
  w("American", 420, y),
  ...prices.map(([x, p]) => w(p, x, y, { width: 60 })),
];
const HOP_WORDS = [
  [
    w("HOP", 100, 100), w("VARIETY", 140, 100), w("ORIGIN", 420, 100),
    w("2024", 620, 100, { width: 40 }), w("2025", 1080, 100, { width: 40 }),
    ...hopRow("Cascade Pellet - 11lb", 130, [[1075, "$3.00/lb"]]),
    ...hopRow("Citra Pellet - 11lb", 160, [[1075, "$4.00/lb"]]),
  ],
];

const malts = [
  { n: "2-Row", q: 10, cpu: 0.5, sku: "MRAH1102" },
  { n: "Maris Otter", q: 5, cpu: 1.5, sku: "MCRI1001" },
];
const hops = [
  { n: "Cascade", q: 4, cpu: 0.4, sku: "HOP-CAS" },
  { n: "Idaho 7", q: 2, cpu: 0.6, sku: "HOP-ID7", archived: true },
];

const renderImport = (over = {}) => {
  const setters = { setMalts: vi.fn(), setHops: vi.fn(), setYeast: vi.fn(), setAdj: vi.fn() };
  const utils = render(
    <PriceImport malts={over.malts ?? malts} hops={over.hops ?? hops}
      yeast={over.yeast ?? []} adj={over.adj ?? []} {...setters} />
  );
  return { ...utils, ...setters };
};

const upload = (file) => {
  const input = document.querySelector('input[type="file"]');
  Object.defineProperty(file, "arrayBuffer", { value: async () => new ArrayBuffer(8) });
  fireEvent.change(input, { target: { files: [file] } });
  return input;
};
const pdf = (name = "list.pdf") => new File(["%PDF-1.4"], name, { type: "application/pdf" });
const json = (obj, name = "prices.json") =>
  new File([JSON.stringify(obj)], name, { type: "application/json" });

beforeEach(() => {
  vi.clearAllMocks();
  load.mockResolvedValue([]);
  save.mockResolvedValue(undefined);
  renderPdfPages.mockResolvedValue([]);
});

describe("PriceImport", () => {
  describe("routing a dropped PDF by its CONTENT", () => {
    it("sends a PDF full of vendor SKUs to the price-list parser", async () => {
      extractPdfLines.mockResolvedValue({ lines: PRICE_LINES, hasText: true, pageCount: 1 });
      renderImport();
      upload(pdf());

      expect(await screen.findByText(/prices? would change|Nothing would change/)).toBeInTheDocument();
      expect(createReader).not.toHaveBeenCalled();   // no OCR engine for a text list
      expect(extractPdfWords).not.toHaveBeenCalled();
    });

    // ⚠️ THE ROUTING BUG. This used to switch on `hasText` alone, which was
    // right only while the hop list was image-only. The April 2026 list arrived
    // as an Excel export — real text, no SKUs anywhere — went to the SKU parser,
    // found nothing, and was reported unreadable. A document with text is not
    // thereby a PRICE LIST.
    it("falls through to the hop parser for a text PDF with no SKUs in it", async () => {
      extractPdfLines.mockResolvedValue({ lines: ["Hop Variety  2024  2025"], hasText: true, pageCount: 1 });
      extractPdfWords.mockResolvedValue({ pages: HOP_WORDS });
      renderImport();
      upload(pdf("spot-hops.pdf"));

      expect((await screen.findAllByText(/Cascade/)).length).toBeGreaterThan(0);
      expect(extractPdfWords).toHaveBeenCalled();
      expect(createReader).not.toHaveBeenCalled(); // exact text, so still no OCR
    });

    // The scanned list: four JPEGs with no text layer at all.
    it("sends a PDF with no text layer to OCR", async () => {
      extractPdfLines.mockResolvedValue({ lines: [], hasText: false, pageCount: 1 });
      const close = vi.fn();
      createReader.mockResolvedValue({ read: async () => HOP_WORDS[0], close });
      renderPdfPages.mockImplementation(async (_data, { onPage } = {}) => {
        if (onPage) await onPage({ pageNumber: 1, canvas: {} });
        return [];
      });
      renderImport();
      upload(pdf("scan.pdf"));

      expect((await screen.findAllByText(/Cascade/)).length).toBeGreaterThan(0);
      expect(createReader).toHaveBeenCalled();
      expect(close).toHaveBeenCalled(); // the engine is released either way
    });

    it("says what it was looking for when neither parser recognises the file", async () => {
      extractPdfLines.mockResolvedValue({ lines: ["Invoice", "Thank you"], hasText: true, pageCount: 1 });
      extractPdfWords.mockResolvedValue({ pages: [[w("Invoice", 10, 10)]] });
      renderImport();
      upload(pdf("invoice.pdf"));

      expect(await screen.findByText(/Is it a BSG\/Rahr price list or spot hop list\?/)).toBeInTheDocument();
    });

    it("reports a PDF it could not read at all, rather than failing silently", async () => {
      extractPdfLines.mockRejectedValue(new Error("corrupt xref"));
      renderImport();
      upload(pdf());
      expect(await screen.findByText(/Couldn't read that PDF: corrupt xref/)).toBeInTheDocument();
    });
  });

  describe("a prepared JSON file", () => {
    it("takes the same path into the review screen", async () => {
      renderImport();
      upload(json({ MRAH1102: 0.72 }));
      expect(await screen.findByText(/prices? would change|Nothing would change/)).toBeInTheDocument();
    });

    it("rejects a file that is not JSON", async () => {
      renderImport();
      upload(new File(["not json at all"], "prices.json", { type: "application/json" }));
      expect(await screen.findByText(/That file isn't valid JSON/)).toBeInTheDocument();
    });

    it("says so when a valid file prices nothing", async () => {
      renderImport();
      upload(json({}));
      expect(await screen.findByText(/No prices found in that file/)).toBeInTheDocument();
    });
  });

  describe("applying", () => {
    it("writes every category, not just the one that changed", async () => {
      extractPdfLines.mockResolvedValue({ lines: PRICE_LINES, hasText: true, pageCount: 1 });
      const { setMalts, setHops, setYeast, setAdj } = renderImport();
      upload(pdf());
      fireEvent.click(await screen.findByRole("button", { name: /Apply/i }));

      await waitFor(() => expect(setMalts).toHaveBeenCalled());
      // Inventory is four separate keys; a partial write would leave the other
      // three holding pre-import rows.
      for (const set of [setHops, setYeast, setAdj]) expect(set).toHaveBeenCalled();
    });

    it("saves the vendor catalog alongside the prices and says how many it holds", async () => {
      extractPdfLines.mockResolvedValue({ lines: PRICE_LINES, hasText: true, pageCount: 1 });
      renderImport();
      upload(pdf());
      fireEvent.click(await screen.findByRole("button", { name: /Apply/i }));

      await waitFor(() => expect(save).toHaveBeenCalledWith("catalog", expect.any(Array)));
      expect(await screen.findByText(/Catalog now lists 3 products \(3 new\)/)).toBeInTheDocument();
    });

    // ⚠️ Prices go into React state and save themselves; the catalog is written
    // here by hand. A catalog that failed to save must NOT hide inside a message
    // about prices that succeeded — the same rule the change set keeps by
    // reporting three outcomes instead of a success count.
    it("reports a failed catalog save without claiming the prices failed too", async () => {
      extractPdfLines.mockResolvedValue({ lines: PRICE_LINES, hasText: true, pageCount: 1 });
      save.mockRejectedValue(new Error("offline"));
      const { setMalts } = renderImport();
      upload(pdf());
      fireEvent.click(await screen.findByRole("button", { name: /Apply/i }));

      const msg = await screen.findByText(/product catalog couldn't be saved: offline/);
      expect(msg.textContent).toMatch(/Applied \d+ price change/); // the prices still landed
      expect(setMalts).toHaveBeenCalled();
    });

    it("drops the review and changes nothing on cancel", async () => {
      extractPdfLines.mockResolvedValue({ lines: PRICE_LINES, hasText: true, pageCount: 1 });
      const { setMalts } = renderImport();
      upload(pdf());
      fireEvent.click(await screen.findByRole("button", { name: /Cancel/i }));

      await waitFor(() => expect(screen.queryByText(/prices? would change|Nothing would change/)).not.toBeInTheDocument());
      expect(setMalts).not.toHaveBeenCalled();
      expect(save).not.toHaveBeenCalled();
    });
  });

  describe("which ingredients a review asks about", () => {
    // ⚠️ `ourHops()` reads defaultProductMap, which knows the fourteen hops the
    // brewery started with and nothing else — so a hop ADOPTED from this very
    // list would never appear on next month's review and its price would freeze
    // at the day it was adopted, silently. The targets come from INVENTORY.
    it("asks about a hop adopted from the catalog, not just the built-in list", async () => {
      extractPdfLines.mockResolvedValue({ lines: ["Hop Variety"], hasText: true, pageCount: 1 });
      extractPdfWords.mockResolvedValue({ pages: HOP_WORDS });
      renderImport({ hops: [{ n: "Citra", q: 0, sku: "HOP-CITRA" }] });

      upload(pdf("hops.pdf"));
      expect((await screen.findAllByText("Citra")).length).toBeGreaterThan(0);
      expect(screen.queryByText("Cascade")).not.toBeInTheDocument(); // not stocked
    });

    // "We stopped buying it" is already the answer to "why isn't this priced".
    it("leaves an archived hop out of the review", async () => {
      extractPdfLines.mockResolvedValue({ lines: ["Hop Variety"], hasText: true, pageCount: 1 });
      extractPdfWords.mockResolvedValue({ pages: HOP_WORDS });
      renderImport();

      upload(pdf("hops.pdf"));
      expect((await screen.findAllByText("Cascade")).length).toBeGreaterThan(0);
      expect(screen.queryByText("Idaho 7")).not.toBeInTheDocument();
    });
  });

  describe("the control itself", () => {
    it("names the wait while a PDF is being read", async () => {
      let resolve;
      extractPdfLines.mockReturnValue(new Promise((r) => { resolve = r; }));
      renderImport();
      upload(pdf());

      expect(await screen.findByText("Reading the PDF…")).toBeInTheDocument();
      expect(document.querySelector('input[type="file"]')).toBeDisabled();
      resolve({ lines: PRICE_LINES, hasText: true, pageCount: 1 });
      await screen.findByText(/prices? would change|Nothing would change/);
    });

    // Picking the same file twice in a row fires no change event unless the
    // input is cleared — so a brewer who re-exports and re-drops the same
    // filename would get nothing at all.
    //
    // ⚠️ Observed through a setter spy, not by reading `input.value` back: a
    // file input's value cannot be assigned in jsdom, so the obvious assertion
    // passes whether or not the line exists. Mutation-testing caught that.
    it("clears the input so the same file can be picked again", async () => {
      extractPdfLines.mockResolvedValue({ lines: PRICE_LINES, hasText: true, pageCount: 1 });
      renderImport();
      const input = document.querySelector('input[type="file"]');
      const assigned = [];
      Object.defineProperty(input, "value", { get: () => "", set: (v) => { assigned.push(v); } });

      const file = pdf();
      Object.defineProperty(file, "arrayBuffer", { value: async () => new ArrayBuffer(8) });
      fireEvent.change(input, { target: { files: [file] } });

      await screen.findByText(/prices? would change|Nothing would change/);
      expect(assigned).toContain("");
    });

    it("says what it takes and that nothing is written before confirmation", () => {
      renderImport();
      expect(screen.getByText(/Upload price list \(PDF or JSON\)/)).toBeInTheDocument();
      expect(screen.getByText(/exactly what would change before anything is saved/)).toBeInTheDocument();
      expect(screen.getByText(/won't clear prices you've already set/)).toBeInTheDocument();
    });
  });
});
