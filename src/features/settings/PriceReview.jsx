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

// What ingesting the rest of the file would do to the vendor catalog.
//
// The price table above concerns the ~30 SKUs the brewery buys. This concerns
// the other five hundred rows on the same page — the products it *could* buy —
// and it reports the same way: what is new, what the vendor renamed or
// repacked, and what it has stopped selling.
function CatalogSummary({ catalog }) {
  const { added, renamed, repacked, discontinued, counts, next } = catalog;
  const nothing = added.length + renamed.length + repacked.length === 0;

  return (
    <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #e2e8f0" }}>
      <div style={sect}>Product catalog</div>
      <p style={{ margin: "0 0 6px", fontSize: 13, color: "#475569" }}>
        {nothing
          ? `No new products — the catalog already lists all ${counts.total} on this file.`
          : `${added.length} new product${added.length === 1 ? "" : "s"} would be added, for ${next.length} in total. These are what you can pick from when building a recipe.`}
      </p>

      {/* A pack size that moved is a price change wearing a cosmetic disguise:
          it is the denominator every derived cost is divided by. */}
      {repacked.length > 0 && (
        <p style={{ margin: "0 0 6px", fontSize: 12, color: "#b45309" }}>
          ⚠️ {repacked.length} product{repacked.length === 1 ? " has" : "s have"} been repacked
          ({repacked.slice(0, 3).map((r) => `${r.name} ${r.from.qty ?? "?"}${r.from.unit ?? ""} → ${r.to.qty ?? "?"}${r.to.unit ?? ""}`).join("; ")}
          {repacked.length > 3 ? `; and ${repacked.length - 3} more` : ""}). Pack size sets the per-unit
          cost, so check these.
        </p>
      )}

      {/* The failure this whole section exists to make impossible to miss. A
          SKU that quietly stops appearing freezes its price at the last quote
          and reads, everywhere else, as simply "not on this list". */}
      {discontinued.length > 0 && (
        <p style={{ margin: "0 0 6px", fontSize: 12, color: "#b91c1c", fontWeight: 600 }}>
          ⚠️ {discontinued.length} product{discontinued.length === 1 ? "" : "s"} you buy{" "}
          {discontinued.length === 1 ? "is" : "are"} no longer on this list:{" "}
          {discontinued.map((d) => d.name).join(", ")}.{" "}
          {discontinued.length === 1 ? "Its price" : "Their prices"} will stay frozen at the last quote
          until you pick a replacement.
        </p>
      )}

      <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
        {counts.total} products read · {Object.entries(counts.byCategory).map(([c, n]) => `${n} ${c}`).join(" · ")}
        {counts.unclassified > 0 && ` · ${counts.unclassified} not yet sorted into a category`}
        {renamed.length > 0 && ` · ${renamed.length} renamed by the vendor`}
      </p>
    </div>
  );
}

export default function PriceReview({ source, result, catalog, onApply, onCancel }) {
  const [showRest, setShowRest] = useState(false);
  const { changes, unchanged, skipped } = result;
  // The catalog can have work to do when no price moved at all — re-importing
  // the same file the day after applying its prices is exactly that — so the
  // button follows both, not just the price count.
  const catalogWork = catalog
    ? catalog.added.length + catalog.renamed.length + catalog.repacked.length
    : 0;
  const total = changes.length + catalogWork;

  // Name the two kinds of change rather than summing them. "Apply 586 changes"
  // is arithmetically true and useless: 23 repriced ingredients and 563 new
  // catalog products are different acts with different consequences, and a
  // single number invites the brewer to read the small one as the big one.
  const applyLabel = () => {
    if (total === 0) return "Apply no changes";
    const parts = [];
    if (changes.length) parts.push(`${changes.length} price change${changes.length === 1 ? "" : "s"}`);
    if (catalogWork) parts.push(`${catalogWork} product${catalogWork === 1 ? "" : "s"}`);
    return `Apply ${parts.join(" + ")}`;
  };

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

      {catalog && <CatalogSummary catalog={catalog} />}

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button type="button" onClick={onApply} disabled={total === 0}
          style={{ ...btn, borderColor: "#f59e0b", background: total ? "#fef3c7" : "#f1f5f9",
                   color: total ? "#92400e" : "#94a3b8", fontWeight: 700,
                   cursor: total ? "pointer" : "not-allowed" }}>
          {applyLabel()}
        </button>
        <button type="button" onClick={onCancel} style={btn}>Cancel</button>
      </div>
    </div>
  );
}
