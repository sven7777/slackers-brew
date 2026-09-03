import { useMemo } from "react";
import { annualCapacity, annualVolume, costInputs, costStack, overheadLabel } from "../../lib/overhead";
import { card, hdr, cell, num, th } from "../../styles";

// Analytics ▸ Overhead: what a pint costs once everything except ingredients is
// counted.
//
// The Beers view is ingredient COGS, which is the exact part — real vendor
// prices against real grain bills. It is also about 6% of an $8.00 pint, so a
// price set off it alone is set off a rounding error. This view stacks the rest
// on top: production labor, then the allocated cost of being open.
//
// It adds no arithmetic of its own, exactly as the Beers view adds none to
// cogs.js — every figure comes from `lib/overhead.js`, so this screen and the
// Settings basis lines can't drift apart.
//
// Two distinctions the layout exists to make:
//
//   DIRECT (ingredients + production labor) vs ABSORBED (+ overhead). They
//   answer different questions: direct says whether one more pint is worth
//   pouring, absorbed says whether the business works at this volume. A single
//   "cost per pint" would answer neither honestly.
//
//   An UNCONFIRMED input is not a zero. A brewery whose rent has not been
//   entered does not have free rent, so the absorbed figure is marked a floor
//   and the missing lines are named — the same rule the Beers view keeps for an
//   unpriced ingredient.

const money = (n) => (n == null ? "—" : `$${Math.round(n).toLocaleString()}`);
const cents = (n) => (n == null ? "—" : `$${n.toFixed(2)}`);
const pct = (n) => (n == null ? "—" : `${n.toFixed(0)}%`);

const statBox = { flex: 1, minWidth: 150, padding: "12px 14px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8 };
const statLabel = { fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" };
const statValue = { fontSize: 22, fontWeight: 800, color: "#92400e", marginTop: 2 };
const statNote = { fontSize: 11, color: "#94a3b8", marginTop: 2 };
const noteStyle = { fontSize: 12, color: "#64748b", padding: "8px 14px" };
const subtotal = { fontWeight: 700, background: "#f8fafc" };

export default function OverheadPanel({ settings, ingredientCostPerBbl, costedBeers }) {
  const stack = useMemo(
    () => costStack({ settings, ingredientCostPerBbl }),
    [settings, ingredientCostPerBbl]
  );
  const v = useMemo(() => annualVolume({ settings }), [settings]);
  const cap = useMemo(() => annualCapacity({ settings }), [settings]);
  const c = useMemo(() => costInputs(settings), [settings]);

  // Ingredients missing is a different fix from rent missing — one is a price
  // to enter on the Inventory tab, the other a number to type into Settings —
  // so they are reported separately rather than as one count.
  const missingOverhead = stack.overhead.missing;
  const noIngredients = stack.annual.ingredients == null;

  // Share of the absorbed pint each layer accounts for. Only meaningful once
  // the stack is complete; a share of a floor would read as a share of a total.
  const share = (n) =>
    stack.complete && n != null && stack.annual.absorbed > 0
      ? (n / stack.annual.absorbed) * 100
      : null;

  const LAYERS = [
    { key: "ingredients", label: "Ingredients", note: costedBeers ? `book average across ${costedBeers} costed beer${costedBeers === 1 ? "" : "s"}` : "no beer is fully priced yet" },
    { key: "labor", label: "Production labor", note: "brewer + cellar, burdened, incl. FICA on the tip share" },
  ];

  return (
    <div>
      {(missingOverhead.length > 0 || noIngredients) && (
        <div style={{ ...card, borderColor: "#fbbf24", background: "#fffbeb" }}>
          <div style={{ padding: "10px 14px", fontSize: 13, color: "#92400e" }}>
            <strong>This is a floor, not a cost.</strong>{" "}
            {missingOverhead.length > 0 && (
              <>
                {missingOverhead.length} operating cost{missingOverhead.length > 1 ? "s are" : " is"} still
                unconfirmed — {missingOverhead.map(overheadLabel).join(", ")}. Enter them in{" "}
                <strong>Settings ▸ Operating Costs</strong>.{" "}
              </>
            )}
            {noIngredients && (
              <>No recipe is fully priced, so the ingredient layer is left out entirely — see the{" "}
              <strong>Beers</strong> view for what's blocking it.{" "}</>
            )}
            Everything absent is left OUT of the totals below rather than counted as zero, so the
            real cost per pint is higher than anything shown here.
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={statBox}>
          <div style={statLabel}>Direct / pint</div>
          <div style={statValue}>
            {cents(stack.perPint.direct)}{noIngredients && <span style={{ color: "#b45309" }}>+</span>}
          </div>
          <div style={statNote}>ingredients + production labor</div>
        </div>
        <div style={statBox}>
          <div style={statLabel}>Absorbed / pint</div>
          <div style={statValue}>
            {cents(stack.perPint.absorbed)}{!stack.complete && <span style={{ color: "#b45309" }}>+</span>}
          </div>
          <div style={statNote}>everything it costs to pour it</div>
        </div>
        <div style={statBox}>
          <div style={statLabel}>Pints sold / yr</div>
          <div style={statValue}>{Math.round(stack.pintsSold).toLocaleString()}</div>
          <div style={statNote}>
            {v.packagedBbl.toFixed(0)} bbl packaged less {v.lossToPourPct.toFixed(1)}% pour loss
          </div>
        </div>
        <div style={statBox}>
          <div style={statLabel}>Tank utilization</div>
          <div style={statValue}>{pct(cap.utilizationPct)}</div>
          <div style={statNote}>{cap.capacityBbl.toFixed(0)} bbl of capacity</div>
        </div>
      </div>

      <div style={card}>
        <div style={{ ...hdr, display: "flex", justifyContent: "space-between" }}>
          <span>🧱 Cost Stack</span>
          <span style={{ fontWeight: 400, fontSize: 12, color: "#64748b" }}>
            per pint SOLD, not per pint brewed
          </span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Layer</th>
                <th style={{ ...th, textAlign: "right" }}>Per year</th>
                <th style={{ ...th, textAlign: "right" }}>Per pint</th>
                <th style={{ ...th, textAlign: "right" }}>Share</th>
              </tr>
            </thead>
            <tbody>
              {LAYERS.map((l) => (
                <tr key={l.key}>
                  <td style={cell}>
                    {l.label}
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>{l.note}</div>
                  </td>
                  <td style={num}>{money(stack.annual[l.key])}</td>
                  <td style={num}>{cents(stack.perPint[l.key])}</td>
                  <td style={{ ...num, color: "#94a3b8" }}>{pct(share(stack.annual[l.key]))}</td>
                </tr>
              ))}
              <tr style={subtotal}>
                <td style={{ ...cell, ...subtotal }}>
                  = Direct cost
                  <div style={{ fontSize: 11, fontWeight: 400, color: "#94a3b8" }}>
                    what one more pint actually costs to make
                  </div>
                </td>
                <td style={{ ...num, ...subtotal }}>{money(stack.annual.direct)}</td>
                <td style={{ ...num, ...subtotal }}>{cents(stack.perPint.direct)}</td>
                <td style={{ ...num, ...subtotal, color: "#94a3b8" }}>{pct(share(stack.annual.direct))}</td>
              </tr>
              <tr>
                <td style={cell}>
                  Allocated overhead
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>
                    rent, utilities, insurance, FOH payroll — the cost of being open
                  </div>
                </td>
                <td style={num}>{money(stack.annual.overhead)}</td>
                <td style={num}>{cents(stack.perPint.overhead)}</td>
                <td style={{ ...num, color: "#94a3b8" }}>{pct(share(stack.annual.overhead))}</td>
              </tr>
              <tr style={subtotal}>
                <td style={{ ...cell, ...subtotal }}>
                  = Absorbed cost
                  <div style={{ fontSize: 11, fontWeight: 400, color: "#94a3b8" }}>
                    what a pint has to clear for the business to work
                  </div>
                </td>
                <td style={{ ...num, ...subtotal }}>{money(stack.annual.absorbed)}</td>
                <td style={{ ...num, ...subtotal }}>
                  {cents(stack.perPint.absorbed)}{!stack.complete && <span style={{ color: "#b45309" }}>+</span>}
                </td>
                <td style={{ ...num, ...subtotal, color: "#94a3b8" }}>{stack.complete ? "100%" : "—"}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style={noteStyle}>
          The denominator is <strong>{Math.round(stack.pintsSold).toLocaleString()} pints sold</strong>{" "}
          a year — packaged beer less {c.linePct}% line and foam and {c.compsPct}% comps and staff
          pours. Beer that went down a drain is beer you paid to make and were never paid for, so
          dividing by pints packaged would understate every figure here.
        </div>
      </div>

      <div style={card}>
        <div style={hdr}>🏠 Where the overhead goes</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Line</th>
                <th style={{ ...th, textAlign: "right" }}>Per month</th>
                <th style={{ ...th, textAlign: "right" }}>Per year</th>
                <th style={{ ...th, textAlign: "right" }}>Per pint</th>
              </tr>
            </thead>
            <tbody>
              {stack.overhead.lines.map((l) => (
                <tr key={l.key} style={l.known ? null : { background: "#fffbeb" }}>
                  <td style={cell}>
                    {overheadLabel(l.key)}
                    {!l.known && <span style={{ color: "#b45309", fontSize: 11 }}> — not entered</span>}
                  </td>
                  <td style={num}>{money(l.monthly)}</td>
                  <td style={num}>{money(l.annual)}</td>
                  <td style={num}>
                    {l.annual == null || !(stack.pintsSold > 0) ? "—" : cents(l.annual / stack.pintsSold)}
                  </td>
                </tr>
              ))}
              <tr style={subtotal}>
                <td style={{ ...cell, ...subtotal }}>Total</td>
                <td style={{ ...num, ...subtotal }}>{money(stack.overhead.total / 12)}</td>
                <td style={{ ...num, ...subtotal }}>{money(stack.overhead.total)}</td>
                <td style={{ ...num, ...subtotal }}>
                  {cents(stack.perPint.overhead)}{missingOverhead.length > 0 && <span style={{ color: "#b45309" }}>+</span>}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div style={card}>
        <div style={hdr}>👷 Where the labor goes</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={cell}>Brewer — {c.brewerHrsWeek} hrs/wk at ${c.brewerRate.toFixed(2)}</td>
              <td style={num}>{money(stack.labor.brewerBase)}</td>
            </tr>
            <tr>
              <td style={cell}>Cellar — {c.cellarHrsWeek} hrs/wk at ${c.cellarRate.toFixed(2)}</td>
              <td style={num}>{money(stack.labor.cellarBase)}</td>
            </tr>
            <tr>
              <td style={cell}>Payroll burden at {c.burdenPct}%</td>
              <td style={num}>{money(stack.labor.burden)}</td>
            </tr>
            <tr>
              <td style={cell}>
                Employer FICA on the tip share
                {/* The tips themselves are the customer's money passing through.
                    Putting them in COGS would invent an expense nobody pays. */}
                <div style={{ fontSize: 11, color: "#94a3b8" }}>
                  the tips themselves are not an employer cost and are not counted
                </div>
              </td>
              <td style={num}>{money(stack.labor.tipFica)}</td>
            </tr>
            <tr style={subtotal}>
              <td style={{ ...cell, ...subtotal }}>Total</td>
              <td style={{ ...num, ...subtotal }}>{money(stack.labor.total)}</td>
            </tr>
          </tbody>
        </table>
        <div style={noteStyle}>
          Charged as a fixed <strong>weekly</strong> cost, not per batch — the brewer works about
          the same week whether it holds one brew or two. That is exactly why brewing more
          spreads this cost rather than adding to it: at {v.batches} batches a year it is{" "}
          {cents(stack.perPint.labor)} a pint, and every extra batch makes it less.
        </div>
      </div>

      <div style={card}>
        <div style={noteStyle}>
          The ingredient layer is the <strong>book average</strong> per bbl from the Beers view —
          the model assumes the year's beer costs what the average costed recipe costs, which is
          true only to the extent the book is brewed evenly. A year weighted toward the dear end
          costs more than this. Overhead is spread evenly across every pint rather than charged
          to the beer that occupied a tank longest; tank occupancy is the second real per-beer
          driver and is not modelled here yet. This is <strong>cost</strong> only — what a pint
          should be priced at, and what comes off that price in card fees and taxes, is the
          Pricing work still to come.
        </div>
      </div>
    </div>
  );
}
