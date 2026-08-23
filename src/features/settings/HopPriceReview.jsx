import { useState } from "react";
import { productsBySku } from "../../lib/products";
import { costPerUnit } from "../../lib/pricing";
import { btn } from "../../styles";

// Confirmation screen for the OCR'd spot hop list.
//
// Every number here was READ OFF AN IMAGE by tesseract, so none of it is trusted
// until a person says so. The screen is built for checking rather than for
// accepting: each hop shows the row OCR matched it to, the price it read, and —
// underneath — the actual page it came from, so a doubtful number can be
// compared against the source without leaving the app. Every price is editable,
// and a low-confidence read is flagged rather than quietly used.
//
// Prices are entered the way the list quotes them ($/lb) and shown converted to
// what inventory stores ($/oz), because a brewer reading the sheet should never
// have to do that division in their head to check a number.

// Below this, tesseract itself is unsure; the row gets flagged for a look.
const LOW_CONFIDENCE = 80;

const th = { textAlign: "left", fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", padding: "4px 8px", borderBottom: "1px solid #e2e8f0" };
const td = { fontSize: 13, padding: "6px 8px", borderBottom: "1px solid #f1f5f9", color: "#1e293b", verticalAlign: "middle" };
const numTd = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };
const priceInp = { width: 78, textAlign: "right", padding: "4px 6px", fontSize: 13, borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", color: "#1e293b", fontVariantNumeric: "tabular-nums" };
const chip = { fontSize: 11, fontWeight: 700, padding: "1px 6px", borderRadius: 999, border: "1px solid #cbd5e1", background: "#fff", color: "#475569", cursor: "pointer", marginRight: 4 };
const note = { fontSize: 11, color: "#94a3b8" };

const money = (n) => (n == null ? "—" : `$${n.toFixed(2)}`);

// $/lb as typed → $/oz as stored, through the same conversion the rest of the
// app uses, so what this screen previews is exactly what gets saved.
const perOunce = (sku, perLb) => {
  const product = productsBySku[sku];
  if (!product || !Number.isFinite(perLb)) return null;
  const raw = costPerUnit({ ...product, price: perLb }, "oz");
  return raw == null ? null : Math.round(raw * 100) / 100;
};

export default function HopPriceReview({ hops, pages, currentByName, effective, onApply, onCancel }) {
  // One editable $/lb per hop, seeded from OCR (blank where it found nothing).
  const [entered, setEntered] = useState(() =>
    Object.fromEntries(hops.map((h) => [h.name, h.price != null ? String(h.price) : ""])));
  const [showPages, setShowPages] = useState(false);

  const set = (name, value) => setEntered((p) => ({ ...p, [name]: value }));

  const rows = hops.map((h) => {
    const perLb = Number(entered[h.name]);
    const to = Number.isFinite(perLb) && perLb > 0 ? perOunce(h.sku, perLb) : null;
    const from = currentByName?.[h.name] ?? null;
    return { ...h, perLb, to, from, changed: to != null && to !== from };
  });
  const changes = rows.filter((r) => r.changed);

  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 14, marginTop: 12, background: "#f8fafc" }}>
      <div style={{ marginBottom: 6 }}>
        <strong style={{ fontSize: 14 }}>Spot hop list</strong>
        {effective && <span style={{ ...note, marginLeft: 8 }}>dated {effective}</span>}
      </div>
      <p style={{ margin: "0 0 10px", fontSize: 13, color: "#475569" }}>
        This list is a scan, so every price below was <strong>read off the image</strong> — check them against
        the page before applying. Prices are per pound, as the list quotes them.
      </p>

      <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 6 }}>
        <thead><tr>
          <th style={th}>Hop</th>
          <th style={th}>Crop</th>
          <th style={{ ...th, textAlign: "right" }}>$ / lb</th>
          <th style={{ ...th, textAlign: "right" }}>Now / oz</th>
          <th style={{ ...th, textAlign: "right" }}>New / oz</th>
          <th style={th}>Read from</th>
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td style={{ ...td, fontWeight: 600 }}>{r.name}</td>
              <td style={{ ...td, color: "#64748b" }}>{r.cropYear ?? "—"}</td>
              <td style={numTd}>
                <input style={priceInp} inputMode="decimal" value={entered[r.name]}
                  onChange={(e) => set(r.name, e.target.value)} placeholder="—" />
              </td>
              <td style={{ ...numTd, color: "#94a3b8" }}>{money(r.from)}</td>
              <td style={{ ...numTd, fontWeight: 700, color: r.changed ? "#92400e" : "#94a3b8" }}>{money(r.to)}</td>
              <td style={td}>
                {r.matchedLabel
                  ? (
                    <span style={note}>
                      {r.matchedLabel}
                      {r.year != null && r.cropYear != null && r.year !== r.cropYear && ` · ${r.year} crop`}
                      {r.ambiguous && (
                        <strong style={{ color: "#b45309" }}> · crop years unclear, read them off the page</strong>
                      )}
                      {!r.ambiguous && r.confidence != null && r.confidence < LOW_CONFIDENCE && (
                        <strong style={{ color: "#b45309" }}> · unsure, check this one</strong>
                      )}
                    </span>
                  )
                  : <span style={{ ...note, fontStyle: "italic" }}>not found on this list</span>}
                {/* Our crop year wasn't quoted, but other years were — offered as
                    a choice rather than substituted silently. */}
                {r.price == null && !r.ambiguous && r.available?.length > 0 && (
                  <div style={{ marginTop: 3 }}>
                    {r.available.map((p) => (
                      <button key={p.year} type="button" style={chip} onClick={() => set(r.name, String(p.price))}>
                        use {p.year}: {money(p.price)}
                      </button>
                    ))}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" onClick={() => onApply(rows.filter((r) => r.to != null))}
          disabled={changes.length === 0}
          style={{ ...btn, borderColor: "#f59e0b", background: changes.length ? "#fef3c7" : "#f1f5f9",
                   color: changes.length ? "#92400e" : "#94a3b8", fontWeight: 700,
                   cursor: changes.length ? "pointer" : "not-allowed" }}>
          Apply {changes.length || "no"} hop price{changes.length === 1 ? "" : "s"}
        </button>
        <button type="button" onClick={onCancel} style={btn}>Cancel</button>
        {pages?.length > 0 && (
          <button type="button" onClick={() => setShowPages((v) => !v)} style={btn}>
            {showPages ? "Hide" : "Show"} the list ({pages.length} page{pages.length === 1 ? "" : "s"})
          </button>
        )}
      </div>

      {/* The source, right here: checking a suspect number shouldn't mean digging
          the PDF out of a downloads folder. */}
      {showPages && (
        <div style={{ marginTop: 12, maxHeight: 520, overflow: "auto", border: "1px solid #e2e8f0", borderRadius: 6, background: "#fff" }}>
          {pages.map((src, i) => (
            <img key={i} src={src} alt={`Spot hop list page ${i + 1}`} style={{ display: "block", width: "100%" }} />
          ))}
        </div>
      )}
    </div>
  );
}
