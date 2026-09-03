import { useMemo, useState } from "react";
import SortableTh from "../../components/SortableTh";
import { sortRows } from "../../lib/analytics";
import { card, hdr, cell, num, th } from "../../styles";

// Analytics ▸ Beers: every beer in the book and what its ingredients cost, side
// by side.
//
// The Recipes ▸ Cost panel answers "what does THIS beer cost"; this answers the
// question that only exists across recipes — which beers cost what, where the
// book is dearest, and what one missing price would unlock. It runs the same
// `computeRecipeCost()` per recipe, so a figure here always matches that
// recipe's own Cost panel rather than being a second opinion.
//
// Everything is per SINGLE batch. Doubling a batch doubles ingredients and
// volume together, so cost per bbl/keg/pint don't move and only the batch total
// would — a toggle here would change nothing about how the beers compare.

const CAT_LABEL = { malt: "malt", hop: "hop", yeast: "yeast", adj: "adjunct" };

// Figures arrive from computeRecipeCost() already rounded up to the cent, so
// toFixed(2) is exact rather than a second rounding.
const money = (n) => (n == null ? "—" : `$${n.toFixed(2)}`);

const statBox = { flex: 1, minWidth: 130, padding: "12px 14px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8 };
const statLabel = { fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" };
const statValue = { fontSize: 22, fontWeight: 800, color: "#92400e", marginTop: 2 };
const statNote = { fontSize: 11, color: "#94a3b8", marginTop: 2 };
const noteStyle = { fontSize: 12, color: "#64748b", padding: "8px 14px" };

// Columns, in display order. `align` drives both the header and the body cell,
// so a column can't drift out of alignment with its own heading.
const COLUMNS = [
  { key: "name", label: "Beer", align: "left" },
  { key: "kegs", label: "Kegs", align: "right" },
  { key: "total", label: "Batch", align: "right" },
  { key: "costPerBbl", label: "$ / bbl", align: "right" },
  { key: "costPerKeg", label: "$ / keg", align: "right" },
  { key: "costPerPint", label: "$ / pint", align: "right" },
];

export default function BeersPanel({ rows, summary, blockers, asOf, openRecipeCost }) {
  // Name first, like every other list a brewer scans. A money column defaults
  // to descending instead: the reason to sort by cost is to find the dear end.
  const [sort, setSort] = useState({ key: "name", dir: "asc" });

  const sorted = useMemo(() => sortRows(rows, sort.key, sort.dir), [rows, sort]);

  const toggleSort = (key) =>
    setSort((p) => (p.key === key
      ? { key, dir: p.dir === "asc" ? "desc" : "asc" }
      : { key, dir: key === "name" ? "asc" : "desc" }));

  if (!rows.length) {
    return <p style={{ textAlign: "center", color: "#94a3b8", padding: 40, fontSize: 14 }}>
      No recipes yet. Add one in the Recipes tab and its costs will show up here.
    </p>;
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={statBox}>
          <div style={statLabel}>Beers costed</div>
          <div style={statValue}>{summary.counted} <span style={{ fontSize: 14, fontWeight: 600, color: "#94a3b8" }}>of {summary.recipes}</span></div>
          {/* An average over four priced beers must never read as the average
              of eighteen, so the gap is printed next to the count, not hidden
              behind it. */}
          <div style={statNote}>
            {summary.counted === summary.recipes
              ? "every recipe fully priced"
              : [summary.incomplete && `${summary.incomplete} unpriced`, summary.empty && `${summary.empty} empty`]
                  .filter(Boolean).join(", ") + " — excluded below"}
          </div>
        </div>
        <div style={statBox}>
          <div style={statLabel}>Avg / bbl</div>
          <div style={statValue}>{money(summary.avgCostPerBbl)}</div>
        </div>
        <div style={statBox}>
          <div style={statLabel}>Avg / keg</div>
          <div style={statValue}>{money(summary.avgCostPerKeg)}</div>
        </div>
        <div style={statBox}>
          <div style={statLabel}>Avg / pint</div>
          <div style={statValue}>{money(summary.avgCostPerPint)}</div>
        </div>
      </div>

      {summary.cheapest && summary.priciest && summary.cheapest !== summary.priciest && (
        <div style={{ ...card, marginBottom: 12 }}>
          <div style={noteStyle}>
            Cheapest per bbl is <strong>{summary.cheapest.name}</strong> at {money(summary.cheapest.costPerBbl)},
            dearest is <strong>{summary.priciest.name}</strong> at {money(summary.priciest.costPerBbl)}.
          </div>
        </div>
      )}

      <div style={card}>
        <div style={{ ...hdr, display: "flex", justifyContent: "space-between" }}>
          <span>🍺 Cost by Beer</span>
          <span style={{ fontWeight: 400, fontSize: 12, color: "#64748b" }}>per single batch</span>
        </div>
        {/* Six columns on a 900px page fits, but the recipe tables have been
            sliced by a card's overflow before now (see CLAUDE.md's 442px
            budget). Scroll rather than cut if a longer beer name pushes it. */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <SortableTh key={c.key} label={c.label} sortKey={c.key} align={c.align}
                    sort={sort} onSort={toggleSort} />
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.index} style={r.complete ? null : { background: "#fffbeb" }}>
                  <td style={cell}>
                    <button
                      onClick={() => openRecipeCost?.(r.index)}
                      title={`Open ${r.name}'s cost breakdown`}
                      style={{ background: "none", border: "none", padding: 0, font: "inherit", color: "#1e293b", cursor: "pointer", textAlign: "left", fontWeight: 600 }}>
                      {r.name}
                    </button>
                    {r.style && <span style={{ color: "#94a3b8", fontSize: 12 }}> ({r.style})</span>}
                    {/* Why this row's total is a floor, on the row itself — the
                        stat tiles say how many, not which. */}
                    {r.empty
                      ? <div style={{ fontSize: 11, color: "#b45309" }}>no ingredients yet</div>
                      : r.missingCount > 0 && (
                        <div style={{ fontSize: 11, color: "#b45309" }}>
                          {r.missingCount} unpriced: {r.missing.map((m) => m.name).join(", ")}
                        </div>
                      )}
                  </td>
                  <td style={num}>{r.kegs == null ? "—" : r.kegs.toFixed(1)}</td>
                  <td style={{ ...num, fontWeight: 600 }}>
                    {money(r.total)}{!r.complete && !r.empty && <span style={{ color: "#b45309" }}>+</span>}
                  </td>
                  <td style={num}>{money(r.costPerBbl)}</td>
                  <td style={num}>{money(r.costPerKeg)}</td>
                  <td style={num}>{money(r.costPerPint)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {blockers.length > 0 && (
        <div style={{ ...card, borderColor: "#fbbf24" }}>
          <div style={{ ...hdr, background: "#fffbeb", color: "#92400e" }}>
            ⚠️ Unpriced ingredients blocking {summary.incomplete} recipe{summary.incomplete === 1 ? "" : "s"}
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Ingredient</th>
                <th style={th}>Beers waiting on it</th>
                <th style={{ ...th, textAlign: "right" }}>Beers</th>
              </tr>
            </thead>
            <tbody>
              {blockers.map((b) => (
                <tr key={`${b.category} ${b.name}`}>
                  <td style={cell}>
                    {b.name} <span style={{ color: "#94a3b8", fontSize: 12 }}>({CAT_LABEL[b.category]})</span>
                  </td>
                  <td style={{ ...cell, color: "#64748b" }}>{b.recipes.join(", ")}</td>
                  <td style={{ ...num, fontWeight: 600 }}>{b.recipes.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={noteStyle}>
            Ranked by how many beers each one unlocks. Enter a price on the Inventory tab, or
            in any recipe's Cost view — prices live on the ingredient, so one entry fixes every
            beer listed beside it.
          </div>
        </div>
      )}

      <div style={card}>
        <div style={noteStyle}>
          <strong>Ingredients only</strong> — labor, rent, utilities and the rest of what a pint
          costs are in the <strong>Overhead</strong> view beside this one, which stacks them on
          top of these figures. Water salts are excluded here (dosed in grams, pennies per
          batch). Each beer is costed against <strong>its own</strong> yield, so a recipe with
          its own average keg count is not compared on the brewery default. A recipe with an
          unpriced ingredient shows what the priced part costs, marked <strong>+</strong>, and is
          left out of the averages above — a total that omits an ingredient is a floor, not a
          cost.
          {asOf && <> Prices as of <strong>{asOf}</strong>.</>}
        </div>
      </div>
    </div>
  );
}
