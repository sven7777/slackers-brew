import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import WholesalePanel from "./WholesalePanel";
import { costAllRecipes } from "../../lib/analytics";
import { costStack } from "../../lib/overhead";
import { priceBoard, OZ_PER_PINT } from "../../lib/menuPricing";

// Fabricated prices throughout; real vendor pricing stays out of this repo, and
// the brewery's real overhead is its own business.
//
// ⚠️ What this file is FOR. The arithmetic behind this screen is covered in
// kegPricing.test.js and is not re-tested here. This panel is 543 lines of
// WIRING, and wiring is what this repo actually gets wrong: a PriceInput reused
// across a size switch, a `≤` that should be a `+`, a column sliced off by a
// missing overflow wrapper. Each test below points at a wiring failure that has
// either happened here or happened somewhere just like it.
const inv = {
  malts: [{ n: "2-Row", q: 0, cpu: 1 }],
  hops: [{ n: "Cascade", q: 0, cpu: 0.5 }],
  yeast: [{ n: "K97", q: 0, cpu: 80 }],
  adj: [],
};

const OVERHEAD = { rent: 6000, electric: 1500, water: 400, insurance: 600, otherFixed: 500, fohPayroll: 1000 };
// ⚠️ `kegCost` is per SIZE, not a single figure — a sixtel and a half barrel are
// not the same asset — and `missingWholesaleInputs()` reports it missing as soon
// as any priced size lacks one. A settings object without it never reaches the
// "every input is in" path, so the complete case has to carry it.
const KEG_SIZES = [
  { key: "sixtel", label: "1/6 BBL", bbl: 1 / 6, price: null, kegCost: 95 },
  { key: "quarter", label: "1/4 BBL", bbl: 1 / 4, price: 95, kegCost: 105 },
  { key: "halfbbl", label: "1/2 BBL", bbl: 1 / 2, price: 160, kegCost: 125 },
];
const WHOLESALE = { kegDeliveryPerKeg: 12, kegLossPct: 3, kegDepositPerKeg: 30, kegSizes: KEG_SIZES };

const settings = {
  postBoilYield: 150,
  lossPct: 33,
  costs: { ...OVERHEAD, ...WHOLESALE },
};

const kolsch = { n: "Kolsch", s: "Kolsch", m: [["2-Row", 100]], h: [["Cascade", 20, "boil", 60]], y: [["K97", 1]], a: [] };
// A dear beer that the account pours smaller and sells higher — the pair of
// per-beer fields the ceiling is made of.
const tripel = {
  n: "Red Panda", s: "Tripel", m: [["2-Row", 300]], h: [], y: [["K97", 1]], a: [],
  process: { kegPrices: { halfbbl: 240 }, accountPourOz: 12, accountRetailPint: 8 },
};

const renderPanel = (over = {}) => {
  const recs = over.recs || [kolsch, tripel];
  const s = over.settings || settings;
  const setSettings = vi.fn();
  const setRecs = vi.fn();
  const { rows, summary } = costAllRecipes({ recs, ...inv, settings: s });
  const stack = costStack({ settings: s, ingredientCostPerBbl: summary.avgCostPerBbl });
  // Built exactly as PricingPanel builds them, so this test cannot pass against
  // a cost basis the real screen never sees.
  const stackFor = (perBbl) => costStack({ settings: s, ingredientCostPerBbl: perBbl });
  const board = priceBoard({ settings: s, stack });
  const taproomServing = board.rows.find((r) => r.oz === OZ_PER_PINT) || board.rows[0];
  const utils = render(
    <WholesalePanel settings={s} setSettings={setSettings} recs={recs} setRecs={setRecs}
      rows={rows} stack={stack} stackFor={stackFor} taproomServing={taproomServing} />
  );
  return { ...utils, setSettings, setRecs, recs };
};

// The setters take an updater; run it against the current value to see what
// would actually be stored.
const applied = (mock, base = settings) => mock.mock.calls.at(-1)[0](base);
const appliedRecs = (mock, base) => mock.mock.calls.at(-1)[0](base);

const priceList = () => screen.getByText("📦 Keg Price List").closest("div").parentElement;
const listRow = (label) => [...priceList().querySelectorAll("tbody tr")]
  .find((r) => r.querySelector("td").textContent === label);
const beerTable = () => screen.getAllByRole("table").at(-1);
const beerRow = (name) => within(beerTable()).getByText(name).closest("tr");
const cells = (row) => [...row.querySelectorAll("td")].map((td) => td.textContent);
// Strips the whole rendering: a figure can print as "$5.95", "−$0.05" or
// "≤ $5.95" depending on sign and on whether the cost behind it was complete.
const parse = (t) => Number(String(t).replace(/−/g, "-").replace(/[^\d.-]/g, ""));

describe("WholesalePanel", () => {
  describe("the price list", () => {
    it("prices every keg size the brewery sells", () => {
      renderPanel();
      const rows = [...priceList().querySelectorAll("tbody tr")];
      expect(rows.map((r) => r.querySelector("td").textContent)).toEqual(["1/6 BBL", "1/4 BBL", "1/2 BBL"]);
    });

    // ⚠️ The pairing this view exists for. A cost-plus suggestion alone reads as
    // an instruction to raise prices; at this brewery's scale it routinely
    // exceeds what an account can actually pay, and only the ceiling beside it
    // can say so.
    it("prints the cost-plus suggestion and the account ceiling as a pair", () => {
      renderPanel();
      const c = cells(listRow("1/2 BBL"));
      // The suggestion carries the squeeze marker when it has overtaken the
      // ceiling, which at this scale is the usual case — hence the optional ⚠.
      expect(c[7]).toMatch(/^\$[\d,]+\.\d\d( ⚠)?$/); // suggested
      expect(c[8]).toMatch(/^\$[\d,]+\.\d\d$/);      // ceiling
    });

    it("marks the squeeze where cost-plus has overtaken the ceiling", () => {
      renderPanel();
      const squeezed = [...priceList().querySelectorAll("tbody tr")]
        .filter((r) => r.textContent.includes("⚠"));
      // The whole point of the pair: at 3.5 BBL and ~40 batches a year the
      // squeeze is the NORMAL case, not an error.
      expect(squeezed.length).toBeGreaterThan(0);
      expect(within(squeezed[0]).getByTitle("above what the account can pay")).toBeInTheDocument();
    });

    // A deposit is the account's money held against the keg coming back.
    it("prints the deposit and keeps it out of every margin", () => {
      renderPanel();
      expect(screen.getByText(/Deposits of \$30\.00 are collected on top/)).toBeInTheDocument();
      expect(screen.getByText(/not revenue/)).toBeInTheDocument();
    });

    // ⚠️ Structural guard only. jsdom has no layout, so this cannot prove a
    // column is visible — it proves the wrapper that makes overflow scrollable
    // is still there, which is exactly what went missing in #88 and #90.
    it("keeps the ten-column table inside a scrollable wrapper", () => {
      renderPanel();
      const table = priceList().querySelector("table");
      expect(table).toHaveStyle({ minWidth: "920px" });
      expect(table.parentElement).toHaveStyle({ overflowX: "auto" });
    });

    it("edits a house price per size, and stores the whole list rather than an orphan row", () => {
      const { setSettings } = renderPanel();
      fireEvent.change(screen.getByLabelText("House price for 1/6 BBL"), { target: { value: "95" } });
      const sizes = applied(setSettings).costs.kegSizes;
      expect(sizes).toHaveLength(3);
      expect(sizes.find((s) => s.key === "sixtel").price).toBe("95");
      expect(sizes.find((s) => s.key === "halfbbl").price).toBe(160);
    });

    it("clears a house price to null rather than zero", () => {
      const { setSettings } = renderPanel();
      fireEvent.change(screen.getByLabelText("House price for 1/2 BBL"), { target: { value: "" } });
      expect(applied(setSettings).costs.kegSizes.find((s) => s.key === "halfbbl").price).toBeNull();
    });
  });

  describe("the deduction walk", () => {
    it("shows what comes off a keg, and that tax and card fees are not on the list", () => {
      renderPanel();
      expect(screen.getByText(/No sales tax and no card fee/)).toBeInTheDocument();
      expect(screen.getByText("Net to the brewery")).toBeInTheDocument();
    });

    // ⚠️ A blank input is UNKNOWN, not zero — the rule the whole app keeps.
    it("names an unentered deduction instead of deducting nothing", () => {
      renderPanel({ settings: { ...settings, costs: { ...OVERHEAD } } });
      const walk = screen.getByText("Net to the brewery").closest("table");
      expect(within(walk).getAllByText("not entered")).toHaveLength(2); // delivery + keg loss
      expect(screen.getByText(/rate not entered/)).toBeInTheDocument();
    });

    it("says every margin is a ceiling while an input is missing, and names it", () => {
      renderPanel({ settings: { ...settings, costs: { ...OVERHEAD } } });
      expect(screen.getByText(/Every cost here is a floor, so every margin is a ceiling/)).toBeInTheDocument();
      expect(screen.getByText(/delivery per keg, keg loss %/)).toBeInTheDocument();
    });

    it("drops the warning once the wholesale inputs are in", () => {
      renderPanel();
      expect(screen.queryByText(/Every cost here is a floor/)).not.toBeInTheDocument();
    });
  });

  describe("the overhead share", () => {
    it("writes the share to settings.costs", () => {
      const { setSettings } = renderPanel();
      fireEvent.change(screen.getByLabelText("Share of overhead a wholesale barrel absorbs"), { target: { value: "50" } });
      expect(applied(setSettings).costs.wholesaleOverheadPct).toBe("50");
    });

    // The default that cannot flatter: a full share, stated before any figure
    // that depends on it.
    it("defaults to the full share and says what that costs per barrel", () => {
      renderPanel();
      expect(screen.getByLabelText("Share of overhead a wholesale barrel absorbs")).toHaveValue(100);
      expect(screen.getByText(/of the .*\/bbl it is costed at/)).toBeInTheDocument();
    });

    it("says a keg carries direct cost alone when the share is zero", () => {
      renderPanel({ settings: { ...settings, costs: { ...OVERHEAD, ...WHOLESALE, wholesaleOverheadPct: 0 } } });
      expect(screen.getByText(/nothing: a keg is costed at its .*\/bbl direct cost alone/)).toBeInTheDocument();
    });

    it("states that there is no distributor margin, because the brewery self-distributes", () => {
      renderPanel();
      expect(screen.getByText(/You self-distribute, so no distributor margin/)).toBeInTheDocument();
    });
  });

  describe("one barrel, two channels", () => {
    // ⚠️ The taproom side is discounted by pour loss and the wholesale side is
    // not. Applying pour loss to both — or to neither — is the mistake, and it
    // is invisible in the totals.
    it("discounts the taproom barrel for foam and the keg barrel not at all", () => {
      renderPanel();
      const compare = screen.getByText("Given up per barrel").closest("table");
      expect(within(compare).getByText(/less .*% to foam, line and comps/)).toBeInTheDocument();
      expect(within(compare).getByText(/all of it, none lost here/)).toBeInTheDocument();
    });

    it("shows the taproom netting several times more on the same barrel", () => {
      renderPanel();
      const rows = [...screen.getByText("Given up per barrel").closest("table").querySelectorAll("tr")];
      const taproom = parse(rows[0].querySelectorAll("td")[1].textContent);
      const wholesale = parse(rows[1].querySelectorAll("td")[1].textContent);
      expect(taproom).toBeGreaterThan(wholesale * 2);
      expect(screen.getByText(/the bar nets .*×/)).toBeInTheDocument();
    });

    it("says the gap is not an argument against wholesale", () => {
      renderPanel();
      expect(screen.getByText(/The gap is not an argument/)).toBeInTheDocument();
    });
  });

  describe("every beer at wholesale", () => {
    it("prices each beer at its own price and its own ingredient cost", () => {
      renderPanel();
      expect(within(beerTable()).getByLabelText("Wholesale price for Red Panda")).toHaveValue(240);
      expect(within(beerTable()).getByLabelText("Wholesale price for Kolsch")).toHaveValue(160); // house
    });

    // Bold is this beer's own; grey is the house price it inherits. Without the
    // distinction there is no way to tell an override from a default.
    it("distinguishes a beer's own price from the house price it inherits", () => {
      renderPanel();
      expect(within(beerTable()).getByLabelText("Wholesale price for Red Panda")).toHaveStyle({ fontWeight: "700" });
      expect(within(beerTable()).getByLabelText("Wholesale price for Kolsch")).toHaveStyle({ color: "#94a3b8" });
    });

    it("writes a per-beer price onto the recipe, keyed by size", () => {
      const { setRecs, recs } = renderPanel();
      fireEvent.change(within(beerTable()).getByLabelText("Wholesale price for Kolsch"), { target: { value: "175" } });
      const next = appliedRecs(setRecs, recs);
      expect(next[0].process.kegPrices).toEqual({ halfbbl: "175" });
      expect(next[1]).toEqual(tripel); // the other beer is untouched
    });

    // "Use the house price" and "give it away" are different answers, and the
    // second one is a price a brewery might actually mean.
    it("clearing a price removes the override rather than storing zero", () => {
      const { setRecs, recs } = renderPanel();
      fireEvent.change(within(beerTable()).getByLabelText("Wholesale price for Red Panda"), { target: { value: "" } });
      const next = appliedRecs(setRecs, recs);
      expect(next[1].process.kegPrices).toBeUndefined();
      expect(next[1].process.accountPourOz).toBe(12); // the rest of `process` survives
    });

    it("writes the account's pour and the account's retail price onto the beer", () => {
      const { setRecs, recs } = renderPanel();
      fireEvent.change(within(beerTable()).getByLabelText("Account pour size for Kolsch"), { target: { value: "12" } });
      expect(appliedRecs(setRecs, recs)[0].process.accountPourOz).toBe("12");

      fireEvent.change(within(beerTable()).getByLabelText("Account retail price for Kolsch"), { target: { value: "8" } });
      expect(appliedRecs(setRecs, recs)[0].process.accountRetailPint).toBe("8");
    });

    it("clearing the account pour removes it rather than dividing the ceiling by zero", () => {
      const { setRecs, recs } = renderPanel();
      fireEvent.change(within(beerTable()).getByLabelText("Account pour size for Red Panda"), { target: { value: "" } });
      expect(appliedRecs(setRecs, recs)[1].process.accountPourOz).toBeUndefined();
    });

    // ⚠️ THE BUG THIS PANEL'S COMMENT CALLS OUT. PriceInput holds the keystrokes
    // while focused, so without a key that includes the size, React reuses the
    // instance across a size switch and a half-barrel draft sits on top of the
    // sixtel's price: the row's arithmetic right and the number in the box
    // wrong, which is the worse of the two ways to be wrong.
    it("does not carry a typed price across a size switch", () => {
      renderPanel();
      const field = () => within(beerTable()).getByLabelText("Wholesale price for Red Panda");
      fireEvent.change(field(), { target: { value: "999" } });
      expect(field()).toHaveValue(999); // the draft owns the field while focused

      fireEvent.change(screen.getByLabelText("size"), { target: { value: "sixtel" } });
      // A different size means a different price. The sixtel has no house price
      // in these settings and Red Panda overrides only the half barrel, so the
      // honest answer is blank — never the half barrel's 999.
      expect(field()).not.toHaveValue(999);
      expect(field()).toHaveValue(null);
    });

    it("prices the whole table against the selected size", () => {
      renderPanel();
      const before = parse(cells(beerRow("Kolsch"))[4]); // direct cost
      fireEvent.change(screen.getByLabelText("size"), { target: { value: "sixtel" } });
      expect(parse(cells(beerRow("Kolsch"))[4])).toBeLessThan(before);
    });

    // ⚠️ A missing cost makes a profit look BIGGER, so an incomplete total is a
    // ceiling. The rest of the app appends `+` meaning "at least this"; here the
    // same gap has to print `≤`, or the one place the convention would flatter
    // rather than alarm is the place it silently inverts.
    it("marks a contribution built on an incomplete cost as a ceiling, not a floor", () => {
      renderPanel({ settings: { ...settings, costs: { rent: 6000, ...WHOLESALE } } });
      const contribution = cells(beerRow("Kolsch"))[6];
      expect(contribution).toMatch(/^≤ /);
      expect(contribution).not.toMatch(/\+/);
    });

    it("flags the beer itself when an input behind its cost is missing", () => {
      renderPanel({ settings: { ...settings, costs: { rent: 6000, ...WHOLESALE } } });
      expect(within(beerRow("Kolsch")).getByTitle("an input behind this beer's cost is missing")).toBeInTheDocument();
    });

    // A dear beer poured smaller and sold higher is the case the pair of
    // per-beer fields exists for — fixing only the pour gets it half right.
    it("warns when a beer's price is above what its account could pay", () => {
      const overpriced = { ...tripel, process: { kegPrices: { halfbbl: 400 }, accountPourOz: 16, accountRetailPint: 7 } };
      renderPanel({ recs: [kolsch, overpriced] });
      const row = beerRow("Red Panda");
      expect(within(row).getByTitle("your price is above what the account can pay at this pour")).toBeInTheDocument();
    });

    it("does not warn when the same beer is poured smaller and sold higher", () => {
      renderPanel(); // Red Panda at $240, 12 oz pours, $8 retail
      expect(within(beerRow("Red Panda"))
        .queryByTitle("your price is above what the account can pay at this pour")).not.toBeInTheDocument();
    });

    it("sorts the beer table from a keyboard", () => {
      renderPanel();
      const header = within(beerTable()).getByRole("button", { name: "Beer" });
      fireEvent.click(header);
      expect(header.closest("th")).toHaveAttribute("aria-sort", "ascending");
      fireEvent.click(header);
      expect(header.closest("th")).toHaveAttribute("aria-sort", "descending");
    });

    // A recipe mid-edit stays priceable. The name is substituted upstream by
    // `recipeName()`, so the panel's own `|| "(untitled)"` and its
    // "this beer" aria-label branch are unreachable — worth knowing before
    // anyone "fixes" a blank row by adding a third fallback.
    it("renders a recipe with no name rather than an empty cell", () => {
      renderPanel({ recs: [{ ...kolsch, n: "" }] });
      expect(within(beerTable()).getByText("(untitled)")).toBeInTheDocument();
      expect(within(beerTable()).getByLabelText("Wholesale price for (untitled)")).toBeInTheDocument();
    });
  });

  describe("what the account sees", () => {
    // ⚠️ ~20% of a keg never reaches a paying glass at a bar — far more than the
    // brewery's own ~5% pour loss. Using the brewery's figure would overstate
    // what the bar gets by fifteen points.
    it("works the account's side backwards from their own pour cost", () => {
      renderPanel();
      expect(screen.getByText(/to tapping, line and/)).toBeInTheDocument();
      expect(screen.getByText("Most they could pay")).toBeInTheDocument();
      expect(screen.getByText(/craft bars target 25%/)).toBeInTheDocument();
    });

    it("says this is the only figure that can call a price too high", () => {
      renderPanel();
      expect(screen.getByText(/the only number here that can say a price is too HIGH/)).toBeInTheDocument();
    });
  });

  describe("the stat tiles", () => {
    it("leads with the direct figures, not the absorbed one", () => {
      renderPanel();
      // ⚠️ The emphasis is INVERTED from the taproom board on purpose: there the
      // absorbed figure leads, here the direct ones do, because wholesale cannot
      // carry a taproom's rent and never could. Leading with the absorbed loss
      // would bury both real questions under a number that is true, unavoidable
      // and useless.
      // label div -> the tile -> the row of tiles.
      const tiles = screen.getByText("Taproom gives up").parentElement.parentElement;
      expect([...tiles.children].map((t) => t.firstChild.textContent))
        .toEqual(["Net on a 1/2 BBL", "Contribution", "Fill floor", "Taproom gives up"]);
      // The absorbed cost is on the price list, last and unemphasised. It is on
      // no tile, because it is the number wholesale is not expected to clear.
      expect(tiles.textContent).not.toMatch(/Absorbed/);
    });

    it("follows the selected size", () => {
      renderPanel();
      expect(screen.getByText(/Net on a 1\/2 BBL/)).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText("size"), { target: { value: "quarter" } });
      expect(screen.getByText(/Net on a 1\/4 BBL/)).toBeInTheDocument();
    });
  });

  describe("inputs it does not own", () => {
    it("names where the wholesale inputs are set and what is not modelled", () => {
      renderPanel();
      expect(screen.getByText(/Freight-out, draught line cleaning/)).toBeInTheDocument();
      expect(screen.getByText(/delivery per keg/)).toBeInTheDocument();
    });
  });
});
