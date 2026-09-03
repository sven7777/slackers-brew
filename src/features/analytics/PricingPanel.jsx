import { useMemo, useState } from "react";
import PriceInput from "../../components/PriceInput";
import SortableTh from "../../components/SortableTh";
import { costInputs, costStack, overheadLabel } from "../../lib/overhead";
import {
  OZ_PER_PINT, priceBeers, priceBoard, servingsOf, sortPricedBeers,
} from "../../lib/menuPricing";
import { card, hdr, cell, num, th, inp, statBox, statLabel, statValue, statNote } from "../../styles";

// Analytics ▸ Pricing: what a beer is sold for, against what it costs.
//
// The Overhead view stops at cost. This one puts the board beside it and takes
// off everything that comes out of a price before a single cost is paid. That
// last part is the reason the view exists: an $8.00 pint against a $7.15
// absorbed cost looks like $0.85 of contribution, and it is not. What it really
// is depends on the basis — on Slackers' tax-added board, card processing and
// excise take $0.31 and it clears $0.54; on a tax-inclusive board the tax comes
// out of that same $8.00 too and the pint LOSES five cents. The gap between the
// price on the wall and the money that reaches the brewery is the whole subject,
// and the basis is the biggest part of the gap.
//
// It adds no arithmetic of its own, exactly as the Beers and Overhead views add
// none: every figure comes from lib/menuPricing.js, which in turn consumes
// lib/overhead.js's published cost rather than recomputing one.
//
// Three things the layout is built to say:
//
//   PRICE is not REVENUE. The deduction table is printed in full, on the actual
//   board price, because every one of those lines is invisible on a menu.
//
//   SIZE is a pricing decision, not a packaging detail. A flat board charges the
//   same for 12 oz and 16 oz, which means the per-ounce price of the pint is the
//   lowest on the menu. The board table exists to make that comparison
//   unavoidable; the $/oz column is the point of it.
//
//   Pour size belongs to the BEER. Red Panda pours 8 oz because it is a 9%
//   tripel, so the control that sets it sits on Red Panda's row and writes to
//   the recipe — not to a list of exceptions in settings.

const money = (n) => (n == null ? "—" : `$${n.toFixed(2)}`);
const signed = (n) => (n == null ? "—" : `${n < 0 ? "−" : ""}$${Math.abs(n).toFixed(2)}`);
const pct = (n) => (n == null ? "—" : `${n.toFixed(1)}%`);
const perOz = (n) => (n == null ? "—" : `$${n.toFixed(3)}`);
// "a $8.00 pint" is read aloud as "a eight dollar pint". Eight and eleven are
// the two leading digits that take "an".
const article = (n) => (n != null && /^\$?(8|11)/.test(String(n)) ? "an" : "a");

// ⚠️ An incomplete cost marks a PROFIT in the opposite direction from a cost.
// The rest of the app appends `+` to a total built on a missing input, meaning
// "at least this" — but subtract that same floor from a price and the answer is
// a CEILING: at most this much profit. Printing a confident green $5.95 beside a
// cost with no rent in it is the exact failure the `+` convention exists to
// prevent, in the one place where it would flatter rather than alarm. `≤` is
// that convention with its sign the right way round.
const ceiling = (text, complete) => (complete || text === "—" ? text : `≤ ${text}`);

const noteStyle = { fontSize: 12, color: "#64748b", padding: "8px 14px" };
const subtotal = { fontWeight: 700, background: "#f8fafc" };

// A figure that is losing money is the one thing on this screen that must not
// read as just another number in a column.
const profitStyle = (n) => (n == null ? null : { color: n < 0 ? "#b91c1c" : "#15803d", fontWeight: 600 });

const BEER_COLUMNS = [
  { key: "name", label: "Beer", align: "left" },
  { key: "pourOz", label: "Pour", align: "right" },
  { key: "price", label: "Price", align: "right" },
  { key: "absorbedCost", label: "Cost", align: "right" },
  { key: "net", label: "Net", align: "right" },
  { key: "profit", label: "Profit", align: "right" },
  { key: "profitMarginPct", label: "Margin", align: "right" },
  { key: "recommended", label: "To hit target", align: "right" },
];

export default function PricingPanel({ settings, setSettings, recs, setRecs, rows, ingredientCostPerBbl }) {
  const [sort, setSort] = useState({ key: "profit", dir: "asc" });

  const c = useMemo(() => costInputs(settings), [settings]);
  const stack = useMemo(
    () => costStack({ settings, ingredientCostPerBbl }),
    [settings, ingredientCostPerBbl]
  );
  const board = useMemo(() => priceBoard({ settings, stack }), [settings, stack]);
  const beers = useMemo(() => priceBeers({ settings, rows, recs }), [settings, rows, recs]);

  const sortedBeers = useMemo(() => sortPricedBeers(beers, sort.key, sort.dir), [beers, sort]);

  // Ascending on a fresh column, including the money ones — unlike the Beers
  // view, which opens a cost column at the dear end. Here the interesting end of
  // every column is the low one: the beers losing money.
  const toggleSort = (key) =>
    setSort((p) => (p.key === key ? { key, dir: p.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  // The house pour — the size the deduction walk-through is shown for, since a
  // deduction table needs one concrete price to be worth reading.
  const house = board.rows.find((r) => r.oz === OZ_PER_PINT) || board.rows.find((r) => r.price != null) || board.rows[0];

  const setCost = (key, value) =>
    setSettings((p) => ({ ...p, costs: { ...(p.costs || {}), [key]: value } }));

  // Editing a board price here edits the brewery's board, which is the same
  // arrangement the Cost panel has with ingredient prices: one stored value,
  // edited wherever it is being looked at. Said on screen below.
  const setServingPrice = (key, value) =>
    setSettings((p) => {
      // Resolved through costInputs() rather than read raw, so the first edit to
      // a board that is still on the shipped defaults writes the whole list
      // rather than a single orphaned row.
      const list = costInputs(p).servings;
      return {
        ...p,
        costs: {
          ...(p.costs || {}),
          servings: list.map((s) => (s.key === key ? { ...s, price: value === "" ? null : value } : s)),
        },
      };
    });

  // The pour size is written onto the RECIPE's free-form `process` map, which
  // migration 0005 made JSONB for exactly this: a new per-recipe field with no
  // migration behind it.
  const setPour = (index, value) =>
    setRecsPour(setRecs, recs, index, value);

  const sizes = servingsOf(settings);

  return (
    <div>
      {!stack.complete && (
        <div style={{ ...card, borderColor: "#fbbf24", background: "#fffbeb" }}>
          <div style={{ padding: "10px 14px", fontSize: 13, color: "#92400e" }}>
            <strong>Every cost here is a floor, so every margin is a ceiling.</strong>{" "}
            {stack.overhead.missing.length > 0 && <>
              {stack.overhead.missing.map(overheadLabel).join(", ")}{" "}
              {stack.overhead.missing.length === 1 ? "is" : "are"} not entered — see{" "}
              <strong>Settings ▸ Operating Costs</strong>.{" "}
            </>}
            {stack.annual.ingredients == null && <>No recipe is fully priced, so ingredients are
              left out entirely — see the <strong>Beers</strong> view.{" "}</>}
            A cost that omits an input makes the beer look more profitable than it is, which is
            the one direction this screen must never be wrong in.
          </div>
        </div>
      )}

      {/* The single assumption that moves this screen most, stated before any
          number that depends on it. 8.25% of an $8.00 pint is $0.61 — most of a
          pint's entire contribution — so it cannot sit implicit in the model. */}
      <div style={{ ...card, background: "#f8fafc" }}>
        <div style={{ padding: "10px 14px", fontSize: 13, color: "#475569", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span>Board prices</span>
          <select style={{ ...inp, width: 220, textAlign: "left" }} aria-label="Sales tax basis"
            value={c.taxBasis} onChange={(e) => setCost("taxBasis", e.target.value)}>
            <option value="included">already include sales tax</option>
            <option value="added">are before sales tax</option>
          </select>
          <span style={{ color: "#94a3b8" }}>
            {c.taxBasis === "added"
              ? `— ${article(money(house?.price))} ${money(house?.price)} pint rings up at ${money(house ? house.gross : null)} and the brewery keeps ${money(house?.beer)} of it.`
              : `— ${article(money(house?.price))} ${money(house?.price)} pint is ${money(house?.beer)} of beer and ${money(house?.salesTax)} of sales tax passing through.`}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={statBox}>
          <div style={statLabel}>Net on a {house?.label || "pint"}</div>
          <div style={statValue}>{money(house?.net)}</div>
          <div style={statNote}>
            of {article(money(house?.price))} {money(house?.price)} price, after tax, card and excise
          </div>
        </div>
        <div style={statBox}>
          <div style={statLabel}>Absorbed cost</div>
          <div style={statValue}>
            {money(house?.absorbedCost)}{!stack.complete && <span style={{ color: "#b45309" }}>+</span>}
          </div>
          <div style={statNote}>ingredients, labor and overhead for that pour</div>
        </div>
        <div style={statBox}>
          <div style={statLabel}>Profit</div>
          <div style={{ ...statValue, ...profitStyle(house?.profit) }}>
            {ceiling(signed(house?.profit), stack.complete)}
          </div>
          <div style={statNote}>
            {house?.contribution != null && <>{signed(house.contribution)} before overhead</>}
          </div>
        </div>
        <div style={statBox}>
          <div style={statLabel}>Break-even price</div>
          <div style={statValue}>
            {money(house?.breakEven)}{!stack.complete && <span style={{ color: "#b45309" }}>+</span>}
          </div>
          <div style={statNote}>what that pour has to ring up to cover itself</div>
        </div>
      </div>

      <div style={card}>
        <div style={{ ...hdr, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span>🍻 The Board</span>
          <span style={{ fontWeight: 400, fontSize: 12, color: "#64748b", display: "flex", alignItems: "center", gap: 6 }}>
            <label htmlFor="pricing-target">target margin</label>
            <input id="pricing-target" type="number" min="0" max="99" step="1" style={{ ...inp, width: 56 }}
              value={settings?.costs?.targetMarginPct ?? ""} placeholder={String(c.targetMarginPct)}
              onChange={(e) => setCost("targetMarginPct", e.target.value)} />
            <span>%</span>
          </span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Size</th>
                <th style={{ ...th, textAlign: "right" }}>Price</th>
                <th style={{ ...th, textAlign: "right" }}>$ / oz</th>
                <th style={{ ...th, textAlign: "right" }}>Net</th>
                <th style={{ ...th, textAlign: "right" }}>Cost</th>
                <th style={{ ...th, textAlign: "right" }}>Profit</th>
                <th style={{ ...th, textAlign: "right" }}>Break-even</th>
                <th style={{ ...th, textAlign: "right" }}>At {c.targetMarginPct}%</th>
              </tr>
            </thead>
            <tbody>
              {board.rows.map((r) => (
                <tr key={r.key} style={r.price == null ? { background: "#f8fafc" } : null}>
                  <td style={cell}>
                    <strong>{r.label}</strong>
                    {/* "12 oz · 12 oz" is a stutter; the size is only worth
                        repeating when the name doesn't already carry it. */}
                    {!r.label.includes(`${r.oz} oz`) && (
                      <span style={{ color: "#94a3b8", fontSize: 12 }}> · {r.oz} oz</span>
                    )}
                    {r.price == null && <div style={{ fontSize: 11, color: "#94a3b8" }}>not on the board</div>}
                  </td>
                  <td style={num}>
                    <PriceInput value={r.price} style={{ width: 68 }}
                      aria-label={`${r.label} price`}
                      onCommit={(v) => setServingPrice(r.key, v)} />
                  </td>
                  {/* The comparison a flat board hides: charging one price for
                      12 and 16 oz makes the pint the cheapest beer on the menu
                      per ounce, and the half pour the dearest. */}
                  <td style={{ ...num, color: "#64748b" }}>{perOz(r.pricePerOz)}</td>
                  <td style={num}>{money(r.net)}</td>
                  <td style={num}>
                    {money(r.absorbedCost)}{!r.complete && <span style={{ color: "#b45309" }}>+</span>}
                  </td>
                  <td style={{ ...num, ...profitStyle(r.profit) }}>
                    {ceiling(signed(r.profit), r.complete)}
                  </td>
                  <td style={num}>
                    {money(r.breakEven)}{!r.complete && <span style={{ color: "#b45309" }}>+</span>}
                  </td>
                  <td style={{ ...num, fontWeight: 600 }}>
                    {money(r.boardPrice)}
                    {r.recommended != null && r.boardPrice !== r.recommended && (
                      <div style={{ fontSize: 11, fontWeight: 400, color: "#94a3b8" }}>{money(r.recommended)} exact</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={noteStyle}>
          Costed on the <strong>book average</strong> beer; per-beer figures are below. Editing a
          price here changes the brewery's board everywhere, the same way an ingredient price
          edited in a Cost view changes it for every recipe. <strong>At {c.targetMarginPct}%</strong> is
          rounded up to the nearest quarter — a recommendation rounded down is one that misses.
        </div>
      </div>

      <div style={card}>
        <div style={{ ...hdr, display: "flex", justifyContent: "space-between" }}>
          <span>🧾 Where {article(money(house?.price))} {money(house?.price)} {house?.label || "pint"} goes</span>
          <span style={{ fontWeight: 400, fontSize: 12, color: "#64748b" }}>
            {c.permitType === "mb" ? "mixed beverage permit" : "wine & beer / on-premise permit"}
          </span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={cell}>
                Rung up
                <div style={{ fontSize: 11, color: "#94a3b8" }}>
                  {c.taxBasis === "added" ? "menu price plus sales tax at the register" : "the price on the board"}
                </div>
              </td>
              <td style={{ ...num, fontWeight: 600 }}>{money(house?.gross)}</td>
            </tr>
            <tr>
              <td style={cell}>
                Sales tax at {c.salesTaxPct}%
                <div style={{ fontSize: 11, color: "#94a3b8" }}>the state's money, never the brewery's</div>
              </td>
              <td style={num}>{signed(house?.salesTax == null ? null : -house.salesTax)}</td>
            </tr>
            {c.permitType === "mb" && (
              <tr>
                <td style={cell}>
                  Mixed beverage gross receipts at {c.mbGrtPct}%
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>owed by the seller, not collected from the customer</div>
                </td>
                <td style={num}>{signed(house?.grt == null ? null : -house.grt)}</td>
              </tr>
            )}
            <tr>
              <td style={cell}>
                Card processing at {c.cardPct}%
                <div style={{ fontSize: 11, color: "#94a3b8" }}>charged on the whole swipe, tax included</div>
              </td>
              <td style={num}>{signed(house?.card == null ? null : -house.card)}</td>
            </tr>
            <tr>
              <td style={cell}>
                Excise, ${(c.exciseStateBbl + c.exciseFedBbl).toFixed(2)}/bbl
                <div style={{ fontSize: 11, color: "#94a3b8" }}>
                  spread over the beer that got SOLD — the foam owes it too
                </div>
              </td>
              <td style={num}>{signed(house?.excise == null ? null : -house.excise)}</td>
            </tr>
            <tr style={subtotal}>
              <td style={{ ...cell, ...subtotal }}>
                = Net revenue
                <div style={{ fontSize: 11, fontWeight: 400, color: "#94a3b8" }}>
                  what actually reaches the brewery
                </div>
              </td>
              <td style={{ ...num, ...subtotal }}>{money(house?.net)}</td>
            </tr>
            <tr>
              <td style={cell}>Absorbed cost of the pour</td>
              <td style={num}>
                {signed(house?.absorbedCost == null ? null : -house.absorbedCost)}
                {!stack.complete && <span style={{ color: "#b45309" }}>+</span>}
              </td>
            </tr>
            <tr style={subtotal}>
              <td style={{ ...cell, ...subtotal }}>= Profit</td>
              <td style={{ ...num, ...subtotal, ...profitStyle(house?.profit) }}>
                {ceiling(signed(house?.profit), stack.complete)}
              </td>
            </tr>
          </tbody>
        </table>
        <div style={noteStyle}>
          None of the middle rows appear on a menu, and together they are{" "}
          <strong>{money(house && house.price != null && house.net != null ? Number((house.price - house.net).toFixed(2)) : null)}</strong>{" "}
          of {article(money(house?.price))} {money(house?.price)} pour. Comparing a board price
          straight against a cost per pint skips all of them and overstates the margin by that
          much.
        </div>
      </div>

      {beers.length > 0 && (
        <div style={card}>
          <div style={{ ...hdr, display: "flex", justifyContent: "space-between" }}>
            <span>🍺 By Beer</span>
            <span style={{ fontWeight: 400, fontSize: 12, color: "#64748b" }}>at each beer's own pour</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {BEER_COLUMNS.map((col) => (
                    <SortableTh key={col.key} label={col.label} sortKey={col.key} align={col.align}
                      sort={sort} onSort={toggleSort} />
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedBeers.map((r) => (
                  <tr key={r.index} style={r.profit != null && r.profit < 0 ? { background: "#fef2f2" } : null}>
                    <td style={cell}>
                      <strong>{r.name}</strong>
                      {r.empty && <div style={{ fontSize: 11, color: "#b45309" }}>no ingredients yet</div>}
                      {!r.empty && r.missingCount > 0 && (
                        <div style={{ fontSize: 11, color: "#b45309" }}>{r.missingCount} unpriced</div>
                      )}
                    </td>
                    <td style={num}>
                      {/* The pour is a property of the beer, so it is set on the
                          beer's own row and written to its recipe. */}
                      <select style={{ ...inp, width: 82, textAlign: "left" }}
                        aria-label={`${r.name} pour size`}
                        value={r.pourFromRecipe ? String(r.pourOz) : ""}
                        onChange={(e) => setPour(r.index, e.target.value)}>
                        <option value="">house</option>
                        {sizes.map((s) => (
                          <option key={s.key} value={s.oz}>{s.oz} oz</option>
                        ))}
                        {!sizes.some((s) => s.oz === r.pourOz) && r.pourFromRecipe && (
                          <option value={r.pourOz}>{r.pourOz} oz</option>
                        )}
                      </select>
                    </td>
                    <td style={num}>{money(r.price)}</td>
                    <td style={num}>
                      {money(r.absorbedCost)}{!r.complete && <span style={{ color: "#b45309" }}>+</span>}
                    </td>
                    <td style={num}>{money(r.net)}</td>
                    <td style={{ ...num, ...profitStyle(r.profit) }}>
                      {ceiling(signed(r.profit), r.complete)}
                    </td>
                    <td style={{ ...num, ...profitStyle(r.profit) }}>
                      {ceiling(pct(r.profitMarginPct), r.complete)}
                    </td>
                    <td style={num}>{money(r.boardPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={noteStyle}>
            Only the <strong>ingredient</strong> layer differs between these beers — labor and
            overhead are spread evenly over every pint. Allocating them by tank occupancy would
            be truer (a four-week tripel holds a fermenter twice as long as a two-week Kölsch),
            and it isn't done here because the app doesn't yet know how long anything ferments.
            So treat the spread between beers as the ingredient spread it is, and read the
            <strong> pour size</strong> as the bigger lever: the same price on half the beer is
            worth far more than any grain bill.
          </div>
        </div>
      )}

      <div style={card}>
        <div style={noteStyle}>
          Prices are what the brewery charges; costs are the <strong>absorbed</strong> figure from
          the Overhead view, which includes rent and payroll and therefore only makes sense at the
          volume being brewed today. A beer that loses money here can still be worth pouring —
          that is what the direct figure on the Overhead view is for — but a whole board that
          loses money here is a board, not a beer, problem. Excise rates and the card rate are
          inputs in <strong>Settings ▸ Price Deductions</strong>, not built-in law; confirm the
          excise with your accountant. Draft-versus-to-go mix and punch-card redemption are not
          modelled yet, so a beer sold through the punch card nets less than it shows here.
        </div>
      </div>
    </div>
  );
}

// Writing the pour onto the recipe, kept out of the component body so the panel
// reads as layout. An empty value REMOVES the override rather than storing 0 —
// "use the house pour" and "pour zero ounces" are different answers.
function setRecsPour(setRecs, recs, index, value) {
  setRecs((prev) => {
    const list = Array.isArray(prev) ? prev : recs;
    return list.map((r, i) => {
      if (i !== index) return r;
      const process = { ...(r?.process || {}) };
      if (value === "" || value == null) delete process.pourOz;
      else process.pourOz = value;
      return { ...r, process };
    });
  });
}
