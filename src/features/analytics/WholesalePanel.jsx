import { useMemo, useState } from "react";
import PriceInput from "../../components/PriceInput";
import SortableTh from "../../components/SortableTh";
import { costInputs } from "../../lib/overhead";
import { OZ_PER_BBL, sortPricedBeers } from "../../lib/menuPricing";
import {
  channelCompare, costPerBbl, kegPriceList, kegSizesOf, priceKegBeers,
  wholesaleHint, wholesaleLabel,
} from "../../lib/kegPricing";
import { card, hdr, cell, num, th, inp, statBox, statLabel, statValue, statNote } from "../../styles";

// Analytics ▸ Pricing ▸ Wholesale: what a KEG is sold for to an account.
//
// The taproom view beside this one is about a price on a wall and everything
// invisible that comes off it — sales tax, card processing, the basis question.
// None of that applies here: a keg to a licensed account is a sale for resale,
// and it is invoiced rather than swiped. What is left is short enough to print
// in full, which is the one genuine advantage this channel has.
//
// It adds no arithmetic of its own — every figure is from lib/kegPricing.js,
// which consumes `costStack()` as published exactly as menuPricing.js does.
//
// ⚠️ THE EMPHASIS IS INVERTED FROM THE TAPROOM BOARD, deliberately. There the
// absorbed figure leads, because a board that does not carry the building is a
// board problem. Here the DIRECT figure leads, because wholesale cannot carry
// the building and never could: one barrel poured at the bar nets roughly five
// times what the same barrel nets as kegs, so a keg price asked to absorb a
// taproom's rent would have to be six hundred dollars. The real questions a keg
// price has to answer are whether it clears direct cost and whether the tap
// handle is worth the barrel. Leading with the absorbed loss would bury both
// under a number that is true, unavoidable, and useless.
//
// Three more things the layout exists to say:
//
//   THE PRICE BELONGS TO THE BEER. Derek prices beers differently from one
//   another, so the editable price sits on each beer's row and writes to
//   `recipe.process.kegPrices` — the same arrangement pour size has, and not a
//   list of exceptions inside the pricing code.
//
//   A DEPOSIT IS NOT REVENUE. It is the account's money held against the keg
//   coming back. It prints on the price list and is in no margin on the screen.
//
//   ONE BARREL, TWO CHANNELS. The comparison row is the payoff of the toggle,
//   and the taproom side of it is discounted by pour loss while the keg side is
//   not — a barrel poured at the bar does not yield a barrel of paid-for beer.

// ⚠️ Money on this screen reaches four figures — a half barrel's absorbed cost,
// and every per-barrel column — where nothing on the taproom board exceeds a
// pint. Hence the thousands separator that `money()` next door does not need.
const money = (n) => (n == null ? "—" : `${n < 0 ? "−" : ""}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const whole = (n) => (n == null ? "—" : `${n < 0 ? "−" : ""}$${Math.abs(Math.round(n)).toLocaleString()}`);
const signed = money;
// The typographic minus, matching money() — a margin reading "-0.1%" beside a
// contribution reading "−$0.19" is two conventions for one fact.
const pct = (n) => (n == null ? "—" : `${n < 0 ? "−" : ""}${Math.abs(n).toFixed(1)}%`);

// ⚠️ A missing COST makes a profit look bigger, so an incomplete total here is a
// CEILING — the same `≤` the taproom view prints, and for the same reason.
const ceiling = (text, complete) => (complete || text === "—" ? text : `≤ ${text}`);

const noteStyle = { fontSize: 12, color: "#64748b", padding: "8px 14px" };
const profitStyle = (n) => (n == null ? null : { color: n < 0 ? "#b91c1c" : "#15803d", fontWeight: 600 });

const BEER_COLUMNS = [
  { key: "name", label: "Beer", align: "left" },
  { key: "price", label: "Price", align: "right" },
  { key: "directCost", label: "Direct", align: "right" },
  { key: "net", label: "Net", align: "right" },
  { key: "contribution", label: "Contribution", align: "right" },
  { key: "contributionMarginPct", label: "Margin", align: "right" },
  { key: "directFloor", label: "Floor", align: "right" },
];

export default function WholesalePanel({ settings, setSettings, recs, setRecs, rows, stack, stackFor, taproomServing }) {
  const [sort, setSort] = useState({ key: "contribution", dir: "asc" });
  const c = useMemo(() => costInputs(settings), [settings]);
  const sizes = useMemo(() => kegSizesOf(settings), [settings]);
  const [sizeKey, setSizeKey] = useState(() => sizes[sizes.length - 1]?.key || null);

  const list = useMemo(() => kegPriceList({ settings, stack }), [settings, stack]);
  const per = useMemo(() => costPerBbl({ settings, stack }), [settings, stack]);
  const beers = useMemo(
    () => priceKegBeers({ settings, rows, recs, stackFor, sizeKey }),
    [settings, rows, recs, stackFor, sizeKey]
  );
  const sortedBeers = useMemo(() => sortPricedBeers(beers, sort.key, sort.dir), [beers, sort]);

  // The half barrel anchors the walk-through and the channel comparison: a
  // deduction table needs one concrete price to be worth reading.
  const anchor = list.rows.find((r) => r.key === sizeKey) || list.rows.find((r) => r.price != null) || list.rows[list.rows.length - 1];
  const compare = useMemo(
    () => channelCompare({ settings, taproomServing, kegRow: anchor }),
    [settings, taproomServing, anchor]
  );

  const toggleSort = (key) =>
    setSort((p) => (p.key === key ? { key, dir: p.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const setCost = (key, value) =>
    setSettings((p) => ({ ...p, costs: { ...(p.costs || {}), [key]: value } }));

  // Resolved through costInputs() rather than read raw, so the first edit to a
  // list still on the shipped sizes writes the whole list rather than a single
  // orphaned row — the same guard the board's price editor has.
  const setSizeField = (key, field, value) =>
    setSettings((p) => ({
      ...p,
      costs: {
        ...(p.costs || {}),
        kegSizes: costInputs(p).kegSizes.map((s) =>
          s.key === key ? { ...s, [field]: value === "" ? null : value } : s
        ),
      },
    }));

  const missing = list.missing;

  return (
    <div>
      {(!stack.complete || missing.length > 0) && (
        <div style={{ ...card, borderColor: "#fbbf24", background: "#fffbeb" }}>
          <div style={{ padding: "10px 14px", fontSize: 13, color: "#92400e" }}>
            <strong>Every cost here is a floor, so every margin is a ceiling.</strong>{" "}
            {missing.length > 0 && <>
              {missing.map((k) => (k === "kegCost" ? "the cost of an empty keg" : wholesaleLabel(k).toLowerCase())).join(", ")}{" "}
              {missing.length === 1 ? "is" : "are"} not entered — see{" "}
              <strong>Settings ▸ Wholesale</strong>.{" "}
            </>}
            {!stack.complete && <>The production cost behind these figures is itself incomplete —
              see the <strong>Overhead</strong> view.{" "}</>}
          </div>
        </div>
      )}

      {/* The assumption that moves this screen most, stated before any number
          that depends on it — the same treatment the tax basis gets next door.
          Whether a keg going out the door should carry taproom rent is a real
          judgement, and it is the brewery's. */}
      <div style={{ ...card, background: "#f8fafc" }}>
        <div style={{ padding: "10px 14px", fontSize: 13, color: "#475569", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span>A wholesale barrel absorbs</span>
          <input type="number" min="0" max="100" step="5" aria-label="Share of overhead a wholesale barrel absorbs"
            style={{ ...inp, width: 64 }} value={c.wholesaleOverheadPct}
            onChange={(e) => setCost("wholesaleOverheadPct", e.target.value)} />
          <span>% of the taproom's overhead</span>
          <span style={{ color: "#94a3b8" }}>
            — {c.wholesaleOverheadPct > 0
              ? `${money(per.overhead)} of the ${money(per.absorbed)}/bbl it is costed at.`
              : `nothing: a keg is costed at its ${money(per.direct)}/bbl direct cost alone.`}
            {" "}You self-distribute, so no distributor margin is taken off these prices.
          </span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ ...statBox, minWidth: 170 }}>
          <div style={statLabel}>Net on {anchor?.label ? `a ${anchor.label}` : "a keg"}</div>
          <div style={statValue}>{money(anchor?.net)}</div>
          <div style={statNote}>
            of {money(anchor?.price)} invoiced, after excise, delivery and keg loss
          </div>
        </div>
        <div style={{ ...statBox, minWidth: 170 }}>
          <div style={statLabel}>Contribution</div>
          <div style={{ ...statValue, ...profitStyle(anchor?.contribution) }}>
            {ceiling(signed(anchor?.contribution), anchor?.complete)}
          </div>
          <div style={statNote}>over {money(anchor?.directCost)} of ingredients and labor</div>
        </div>
        <div style={{ ...statBox, minWidth: 170 }}>
          <div style={statLabel}>Fill floor</div>
          <div style={statValue}>{money(anchor?.directFloor)}</div>
          <div style={statNote}>below this the keg is not worth filling</div>
        </div>
        <div style={{ ...statBox, minWidth: 170 }}>
          <div style={statLabel}>Taproom gives up</div>
          <div style={statValue}>{whole(compare.difference)}</div>
          <div style={statNote}>
            per barrel sent out instead of poured
            {compare.ratio != null && <> — the bar nets {compare.ratio.toFixed(1)}×</>}
          </div>
        </div>
      </div>

      <div style={card}>
        <div style={hdr}>📦 Keg Price List</div>
        {/* ⚠️ overflowX, because the card is overflow:hidden and this table is
            ten columns wide. Without it a narrow window slices the right-hand
            columns clean off with nothing on screen to say so — the failure that
            shipped twice already (#88, #90). Scrolling is the backstop; jsdom
            has no layout, so no unit test can catch a regression here. */}
        <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 920, borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "left" }}>Size</th>
              <th style={th}>Price</th>
              <th style={th}>$/bbl</th>
              <th style={th}>Net</th>
              <th style={th}>Direct</th>
              <th style={th}>Contribution</th>
              <th style={th}>Fill floor</th>
              <th style={th} title="cost-plus, at your wholesale target margin on direct cost">Suggested</th>
              <th style={th} title="the most the account could pay and still hit their pour cost">Ceiling</th>
              <th style={th}>Absorbed</th>
            </tr>
          </thead>
          <tbody>
            {list.rows.map((r) => (
              <tr key={r.key} style={r.key === sizeKey ? { background: "#fffbeb" } : null}>
                <td style={{ ...cell, fontWeight: 600 }}>{r.label}</td>
                <td style={num}>
                  <PriceInput style={{ width: 80 }} aria-label={`House price for ${r.label}`}
                    value={r.price} onCommit={(v) => setSizeField(r.key, "price", v)} />
                </td>
                <td style={num}>{whole(r.pricePerBbl)}</td>
                <td style={num}>{money(r.net)}</td>
                <td style={num}>{money(r.directCost)}</td>
                <td style={{ ...num, ...profitStyle(r.contribution) }}>
                  {ceiling(signed(r.contribution), r.complete)}
                </td>
                <td style={num}>{money(r.directFloor)}</td>
                {/* ⚠️ Printed as a PAIR, never alone. The cost-plus suggestion
                    answers "how little can we charge"; the ceiling answers "what
                    will they actually pay". At this brewery's scale the first
                    routinely exceeds the second, and a suggested-price column on
                    its own would read as an instruction to raise prices past the
                    point any account buys. */}
                <td style={{ ...num, ...(r.squeezed ? { color: "#b45309" } : null) }}>
                  {money(r.suggested)}{r.squeezed && <span title="above what the account can pay"> ⚠</span>}
                </td>
                <td style={num}>{money(r.ceiling)}</td>
                {/* Printed, but last and unemphasised: it is the number that
                    cannot be cleared, not the number to price against. */}
                <td style={{ ...num, color: "#94a3b8" }}>{money(r.absorbedCost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <div style={noteStyle}>
          The house price list — what a beer goes out at unless that beer says otherwise. <strong>$/bbl</strong> is
          what the size is worth per barrel, which is why a sixtel is the dearest beer you sell by volume and a
          half barrel the cheapest. <strong>Fill floor</strong> covers ingredients, labor and the deductions
          below, and nothing else; <strong>Absorbed</strong> adds this beer's share of rent and payroll and is
          the number wholesale is not expected to clear. <strong>Suggested</strong> is cost-plus at your
          wholesale target margin on direct cost — the basis the industry's 40–60% draft benchmark is quoted
          on — and <strong>Ceiling</strong> is the most an account could pay and still hit their pour cost.
          They are printed together because at this scale the first often exceeds the second; where it does it
          is marked ⚠, and the answer is the next card, not a higher price.
          {c.kegDepositPerKeg != null && <> Deposits of {money(c.kegDepositPerKeg)} are collected on top and
            appear in no figure here — a deposit is the account's money held against the keg's return, not revenue.</>}
        </div>
      </div>

      {anchor && (
        <div style={card}>
          <div style={hdr}>🧾 What comes off {anchor.label ? `a ${anchor.label}` : "a keg"}</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                <td style={cell}>Invoice price</td>
                <td style={num}>{money(anchor.price)}</td>
              </tr>
              <tr>
                <td style={cell}>
                  Excise
                  <span style={{ color: "#94a3b8", fontSize: 12 }}>
                    {" "}— {money(c.exciseStateBbl + c.exciseFedBbl)}/bbl on {anchor.bbl?.toFixed(3)} bbl
                  </span>
                </td>
                <td style={num}>{anchor.excise == null ? "—" : `−${money(anchor.excise)}`}</td>
              </tr>
              <tr>
                <td style={cell}>
                  Delivery
                  <span style={{ color: "#94a3b8", fontSize: 12 }}> — you self-distribute</span>
                </td>
                <td style={num}>{anchor.delivery == null ? "not entered" : `−${money(anchor.delivery)}`}</td>
              </tr>
              <tr>
                <td style={cell}>
                  Keg loss
                  <span style={{ color: "#94a3b8", fontSize: 12 }}>
                    {" "}— {c.kegLossPct == null ? "rate not entered" : `${c.kegLossPct}% of ${money(anchor.kegCost)}`}
                  </span>
                </td>
                <td style={num}>{anchor.shrinkage == null ? "not entered" : `−${money(anchor.shrinkage)}`}</td>
              </tr>
              <tr style={{ fontWeight: 700, background: "#f8fafc" }}>
                <td style={cell}>Net to the brewery</td>
                <td style={num}>{money(anchor.net)}</td>
              </tr>
            </tbody>
          </table>
          <div style={noteStyle}>
            <strong>No sales tax and no card fee.</strong> A keg to a licensed account is a sale for resale — the
            account collects tax from its own customers — and it is invoiced rather than swiped. That is the whole
            list, which is the one thing wholesale has going for it against a pint: on the taproom board the same
            walk takes $0.31 off an $8.00 pint before a single cost is paid. Excise is still owed on the full
            barrel and is not reduced by pour loss, because none of this beer foams down your lines.
          </div>
        </div>
      )}

      {anchor && (
        <div style={card}>
          <div style={hdr}>🍸 What your account sees on {anchor.label ? `a ${anchor.label}` : "a keg"}</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                <td style={cell}>
                  Pours they actually sell
                  <span style={{ color: "#94a3b8", fontSize: 12 }}>
                    {" "}— {Math.round((anchor.bbl || 0) * OZ_PER_BBL)} oz less {c.accountLossPct}% to tapping, line and
                    foam, at {c.accountPourOz} oz
                  </span>
                </td>
                <td style={num}>{anchor.account?.pints ?? "—"}</td>
              </tr>
              <tr>
                <td style={cell}>
                  Their revenue on the keg
                  <span style={{ color: "#94a3b8", fontSize: 12 }}> — at {money(c.accountRetailPint)} a pour</span>
                </td>
                <td style={num}>{whole(anchor.account?.revenue)}</td>
              </tr>
              <tr>
                <td style={cell}>
                  Their pour cost at {money(anchor.price)}
                  <span style={{ color: "#94a3b8", fontSize: 12 }}> — craft bars target {c.accountPourCostPct}%</span>
                </td>
                <td style={{ ...num, ...(anchor.account?.pourCostPct > c.accountPourCostPct ? { color: "#b45309", fontWeight: 600 } : profitStyle(1)) }}>
                  {pct(anchor.account?.pourCostPct)}
                </td>
              </tr>
              <tr style={{ fontWeight: 700, background: "#f8fafc" }}>
                <td style={cell}>Most they could pay</td>
                <td style={num}>{money(anchor.ceiling)}</td>
              </tr>
            </tbody>
          </table>
          <div style={noteStyle}>
            ⚠️ <strong>This is the only number here that can say a price is too HIGH.</strong> Everything else on
            this screen is a floor built up from your costs, and a brewery pricing off cost alone will happily
            arrive at a keg nobody buys. A bar decides what it pays by working backwards from its own pour cost:
            what it can retail your beer for, less the fifth of every keg that never reaches a paying glass.
            Above roughly a third, the bar stops making money on the handle and stops buying. Published targets
            are 20–26% for a craft bar, 22–28% for a neighbourhood or sports bar, and 15–22% for a brewery's own
            taproom. The retail price, pour size and loss are yours to set in{" "}
            <strong>Settings ▸ Wholesale</strong> — if you know what a particular account charges, use theirs.
          </div>
        </div>
      )}

      <div style={card}>
        <div style={hdr}>🍺 One barrel, two channels</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={cell}>
                Poured in the taproom
                <span style={{ color: "#94a3b8", fontSize: 12 }}>
                  {" "}— {compare.pintsPerBbl} pints, less {(100 - compare.pourKeepPct).toFixed(1)}% to foam, line and comps
                </span>
              </td>
              <td style={num}>{whole(compare.taproomNetPerBbl)}</td>
            </tr>
            <tr>
              <td style={cell}>
                Sold as {anchor?.label || "kegs"}
                <span style={{ color: "#94a3b8", fontSize: 12 }}> — all of it, none lost here</span>
              </td>
              <td style={num}>{whole(compare.wholesaleNetPerBbl)}</td>
            </tr>
            <tr style={{ fontWeight: 700, background: "#f8fafc" }}>
              <td style={cell}>Given up per barrel</td>
              <td style={{ ...num, ...profitStyle(compare.difference == null ? null : -compare.difference) }}>
                {whole(compare.difference)}
              </td>
            </tr>
          </tbody>
        </table>
        <div style={noteStyle}>
          Net of every deduction on both sides, on one packaged barrel. The taproom figure is discounted by pour
          loss and the wholesale one is not, because a barrel poured at the bar does not yield a barrel of
          paid-for beer and a barrel sold as kegs yields exactly itself. <strong>The gap is not an argument
          against wholesale.</strong> It is why wholesale is a contribution business: the barrel that goes out
          the door is usually a barrel the taproom was never going to sell, and the tap handle is marketing you
          are paid for rather than paying for. What it does mean is that a keg priced below its fill floor is
          costing you twice.
        </div>
      </div>

      <div style={card}>
        <div style={{ ...hdr, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span>🍻 Every beer at wholesale</span>
          <span style={{ fontWeight: 400, fontSize: 12, color: "#64748b", display: "flex", alignItems: "center", gap: 6 }}>
            <label htmlFor="wholesale-size">size</label>
            <select id="wholesale-size" style={{ ...inp, width: 110, textAlign: "left" }}
              value={sizeKey || ""} onChange={(e) => setSizeKey(e.target.value)}>
              {sizes.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </span>
        </div>
        <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 620, borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {BEER_COLUMNS.map((col) => (
                <SortableTh key={col.key} label={col.label} sortKey={col.key} align={col.align}
                  sort={sort} onSort={toggleSort} />
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedBeers.map((b) => (
              <tr key={b.index}>
                <td style={cell}>
                  {b.name || "(untitled)"}
                  {!b.complete && <span style={{ color: "#b45309" }} title="an input behind this beer's cost is missing"> +</span>}
                </td>
                <td style={num}>
                  {/* The price belongs to the BEER — this writes to the recipe,
                      not to settings. Blank means "use the house price". */}
                  {/* ⚠️ Keyed by SIZE as well as beer. PriceInput holds the
                      keystrokes while focused (it has to — see its own comment),
                      and after a size switch this field means a different price
                      entirely. Without the key React reuses the instance and a
                      half-barrel draft sits on top of the sixtel's house price:
                      the row's arithmetic is right and the number in the box is
                      not, which is the worst of the two ways to be wrong. */}
                  <PriceInput key={`${b.index}-${sizeKey}`}
                    style={{ width: 80, ...(b.priceFromRecipe ? { fontWeight: 700 } : { color: "#94a3b8" }) }}
                    aria-label={`Wholesale price for ${b.name || "this beer"}`}
                    value={b.price} onCommit={(v) => setKegPrice(setRecs, recs, b.index, sizeKey, v)} />
                </td>
                <td style={num}>{money(b.directCost)}</td>
                <td style={num}>{money(b.net)}</td>
                <td style={{ ...num, ...profitStyle(b.contribution) }}>
                  {ceiling(signed(b.contribution), b.complete)}
                </td>
                <td style={num}>{b.contributionMarginPct == null ? "—" : pct(b.contributionMarginPct)}</td>
                <td style={num}>{money(b.directFloor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <div style={noteStyle}>
          Each beer at <strong>its own</strong> price and its own ingredient cost. A price in bold is that
          beer's own; a greyed one is the house price it inherits — type over it to set this beer's, clear it to
          go back to the house list. Prices are per size, so a beer that goes out dearer only on half barrels
          sets that one and leaves the rest alone.
        </div>
      </div>

      <div style={card}>
        <div style={noteStyle}>
          Wholesale inputs — {WHOLESALE_SUMMARY.map(([k], i) => (
            <span key={k}>
              {i > 0 && ", "}
              <strong>{wholesaleLabel(k).toLowerCase()}</strong>
              {" "}({c[k] == null ? "not entered" : k === "kegLossPct" ? `${c[k]}%` : money(c[k])})
              {wholesaleHint(k) && <span style={{ color: "#94a3b8" }}> — {wholesaleHint(k)}</span>}
            </span>
          ))} — are set in <strong>Settings ▸ Wholesale</strong>, alongside the keg deposit. Excise rates come
          from <strong>Settings ▸ Price Deductions</strong> and are shared with the taproom view. Freight-out,
          draught line cleaning at the account and keg float financing are not modelled.
        </div>
      </div>
    </div>
  );
}

const WHOLESALE_SUMMARY = [["kegDeliveryPerKeg"], ["kegLossPct"]];

// Writing a wholesale price onto the recipe, kept out of the component body so
// the panel reads as layout. An empty value REMOVES the override rather than
// storing 0 — "use the house price" and "give it away" are different answers,
// and the second one is a price a brewery might actually mean.
function setKegPrice(setRecs, recs, index, sizeKey, value) {
  if (!sizeKey) return;
  setRecs((prev) => {
    const list = Array.isArray(prev) ? prev : recs;
    return list.map((r, i) => {
      if (i !== index) return r;
      const process = { ...(r?.process || {}) };
      const prices = { ...(process.kegPrices || {}) };
      if (value === "" || value == null) delete prices[sizeKey];
      else prices[sizeKey] = value;
      if (Object.keys(prices).length) process.kegPrices = prices;
      else delete process.kegPrices;
      return { ...r, process };
    });
  });
}
