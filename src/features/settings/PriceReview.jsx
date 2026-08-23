import { useState } from "react";
import { categoryLabels } from "../../lib/priceChanges";
import { btn } from "../../styles";

// The confirmation step every price import passes through.
//
// An import rewrites the numbers under every batch cost, for the whole brewery,
// straight into the shared database — so it is shown before it is done, never
// after. What is NOT covered gets equal billing: an ingredient the list doesn't
// carry is a gap in the costing, and a silent one is how a half-applied import
// passes for a complete one.

const money = (n) => (n == null ? "—" : `$${n.toFixed(2)}`);

const sect = { fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", color: "#64748b", padding: "10px 0 4px" };
const th = { textAlign: "left", fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", padding: "4px 8px", borderBottom: "1px solid #e2e8f0" };
const td = { fontSize: 13, padding: "5px 8px", borderBottom: "1px solid #f1f5f9", color: "#1e293b" };
const numTd = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };
const pill = { fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "#f1f5f9", color: "#475569" };

// Why an ingredient took no price, in the brewer's terms rather than the code's.
const REASONS = {
  absent: "not on this list",
  unmapped: "no vendor product",
  unconvertible: "units don't reconcile",
};

// One changed row. A rise is amber and a fall green: this is a cost, so cheaper
// is the good direction.
function ChangeRow({ c }) {
  const delta = c.from == null ? null : c.to - c.from;
  const up = delta != null && delta > 0;
  return (
    <tr>
      <td style={td}>{c.name}</td>
      <td style={numTd}>{money(c.from)}</td>
      <td style={{ ...numTd, fontWeight: 700 }}>{money(c.to)}</td>
      <td style={{ ...numTd, color: delta == null ? "#0369a1" : up ? "#b45309" : "#166534", fontWeight: 700 }}>
        {delta == null ? "new" : `${up ? "+" : "−"}${money(Math.abs(delta)).slice(1)}`}
      </td>
    </tr>
  );
}

export default function PriceReview({ source, result, onApply, onCancel }) {
  const [showRest, setShowRest] = useState(false);
  const { changes, unchanged, skipped } = result;

  // Group changes by category so the table reads like the inventory does.
  const byCategory = Object.keys(categoryLabels)
    .map((cat) => ({ cat, rows: changes.filter((c) => c.category === cat).sort((a, b) => a.name.localeCompare(b.name)) }))
    .filter((g) => g.rows.length > 0);

  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 14, marginTop: 12, background: "#f8fafc" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap", marginBottom: 4 }}>
        <strong style={{ fontSize: 14 }}>{source.label}</strong>
        {source.effective && <span style={pill}>dated {source.effective}</span>}
        {source.count != null && <span style={pill}>{source.count} products read</span>}
      </div>

      <p style={{ margin: "0 0 6px", fontSize: 13, color: "#475569" }}>
        {changes.length === 0
          ? "Nothing would change — every price in this list already matches what's stored."
          : `${changes.length} price${changes.length === 1 ? "" : "s"} would change. Nothing is saved until you apply.`}
      </p>

      {source.conflicts?.length > 0 && (
        <p style={{ margin: "0 0 8px", fontSize: 12, color: "#b45309" }}>
          ⚠️ {source.conflicts.length} SKU{source.conflicts.length === 1 ? "" : "s"} appeared twice at different prices
          ({source.conflicts.map((c) => c.sku).join(", ")}). The first was used — check those against the list.
        </p>
      )}

      {byCategory.map(({ cat, rows }) => (
        <div key={cat}>
          <div style={sect}>{categoryLabels[cat]}</div>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 6 }}>
            <thead><tr>
              <th style={th}>Ingredient</th>
              <th style={{ ...th, textAlign: "right" }}>Now</th>
              <th style={{ ...th, textAlign: "right" }}>New</th>
              <th style={{ ...th, textAlign: "right" }}>Change</th>
            </tr></thead>
            <tbody>{rows.map((c, i) => <ChangeRow key={i} c={c} />)}</tbody>
          </table>
        </div>
      ))}

      {/* The gaps, always reported — never folded into a success count. */}
      <p style={{ margin: "10px 0 0", fontSize: 12, color: "#64748b" }}>
        {unchanged.length} already up to date · {skipped.length} not priced by this file
        {(unchanged.length > 0 || skipped.length > 0) && (
          <button type="button" onClick={() => setShowRest((v) => !v)}
            style={{ ...btn, padding: "2px 8px", fontSize: 11, marginLeft: 8 }}>
            {showRest ? "Hide" : "Show"}
          </button>
        )}
      </p>

      {showRest && skipped.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, background: "#fff" }}>
          <tbody>
            {skipped.map((s, i) => (
              <tr key={i}>
                <td style={td}>{s.name}</td>
                <td style={{ ...td, color: "#94a3b8" }}>{REASONS[s.reason] ?? s.reason}</td>
                <td style={numTd}>{s.from != null ? `keeps ${money(s.from)}` : "unpriced"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button type="button" onClick={onApply} disabled={changes.length === 0}
          style={{ ...btn, borderColor: "#f59e0b", background: changes.length ? "#fef3c7" : "#f1f5f9",
                   color: changes.length ? "#92400e" : "#94a3b8", fontWeight: 700,
                   cursor: changes.length ? "pointer" : "not-allowed" }}>
          Apply {changes.length || "no"} change{changes.length === 1 ? "" : "s"}
        </button>
        <button type="button" onClick={onCancel} style={btn}>Cancel</button>
      </div>
    </div>
  );
}
