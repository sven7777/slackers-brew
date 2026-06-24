import { useState } from "react";
import { buildBrewSheet } from "../../lib/brewSheet";
import { card, btn } from "../../styles";

// Brew Sheet panel (Recipes ▸ Brew Sheet): for the recipe selected in the
// Recipes tab, choose single/double batch, preview the printable Brew Day sheet
// on screen, and print it (landscape US Letter). A double batch prints two pages
// (#1, #2) at single-batch amounts. Print-only — no saved log.

// Measured-reading boxes the brewer fills in by hand. `ref` is the static
// reference value carried over from the paper template; blank `ref` = write-in.
const READINGS = [
  { label: "Strike Temp", ref: "" },
  { label: "Mash pH", ref: "8.4" },
  { label: "Final pH", ref: "5.2" },
  { label: "Pre-Boil Gravity", ref: "" },
  { label: "Pre-Boil Volume", ref: "" },
  { label: "OG", ref: "" },
  { label: "Volume to Fermenter", ref: "" },
  { label: "Whirlpool", ref: "5 active / 15 not" },
  { label: "Knockout", ref: "20 / 80" },
];

// Scoped print rules, injected inline (no CSS file per project convention).
// visibility trick hides the app chrome and lifts the sheet to the page top.
const PRINT_CSS = `
@media print {
  @page { size: letter landscape; margin: 0.4in; }
  body * { visibility: hidden; }
  .brew-print, .brew-print * { visibility: visible; }
  .brew-print { position: absolute; left: 0; top: 0; width: 100%; }
  .brew-page { border: none !important; border-radius: 0 !important; margin: 0 !important; padding: 0 !important; max-width: none !important; page-break-after: always; }
  .brew-page:last-child { page-break-after: auto; }
  .no-print { display: none !important; }
}`;

const sheetBox = { border: "1px solid #000", borderRadius: 4, padding: 8, background: "#fff" };
const sectTitle = { fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", margin: "0 0 4px", color: "#000" };
const miniTh = { textAlign: "left", fontSize: 9, fontWeight: 700, color: "#475569", borderBottom: "1px solid #000", padding: "2px 4px" };
const miniTd = { fontSize: 11, padding: "2px 4px", borderBottom: "1px solid #e2e8f0", color: "#000" };
const fieldInp = { border: "none", borderBottom: "1px solid #94a3b8", fontSize: 12, padding: "1px 2px", width: "100%", background: "transparent", color: "#000" };

const STAGE_LABEL = { mash: "Mash Adds", sparge: "Sparge Adds", boil: "Boil Adds" };

// One labeled header field (write-in on the printout).
function Field({ label, value }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 90, flex: 1 }}>
      <span style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#64748b" }}>{label}</span>
      {value != null
        ? <span style={{ fontSize: 13, fontWeight: 700, borderBottom: "1px solid #94a3b8", minHeight: 18 }}>{value}</span>
        : <input type="text" style={fieldInp} />}
    </div>
  );
}

function BrewSheetPage({ sheet, batchLabel }) {
  const target = (v) => (v == null ? "" : v);
  return (
    <div className="brew-page" style={{ width: "100%", maxWidth: 1040, margin: "0 auto 24px", border: "1px solid #cbd5e1", borderRadius: 8, padding: 16, background: "#fff", color: "#000" }}>
      {/* Header band */}
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", borderBottom: "2px solid #000", paddingBottom: 8, marginBottom: 10 }}>
        <div style={{ flex: 2 }}>
          <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.1 }}>{sheet.name}</div>
          <div style={{ fontSize: 13, color: "#475569", fontWeight: 600 }}>{sheet.style}</div>
        </div>
        <div style={{ flex: 3, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Field label="Serial" />
          <Field label="Batch" value={batchLabel ?? undefined} />
          <Field label="Date" />
          <Field label="Brewer" />
        </div>
        <div style={{ flex: 2, display: "flex", gap: 10 }}>
          <Field label="Target OG" value={target(sheet.og)} />
          <Field label="Target FG" value={target(sheet.fg)} />
          <Field label="ABV %" value={target(sheet.abv)} />
          <Field label="Mash °F" value={target(sheet.mashTemp)} />
        </div>
      </div>

      {/* Three-column body */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 1fr", gap: 12, alignItems: "start" }}>
        {/* Col 1 — Water salts by stage */}
        <div style={{ ...sheetBox, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={sectTitle}>Water Salts (g)</div>
          {sheet.saltsByStage.length === 0 && <div style={{ fontSize: 11, color: "#94a3b8" }}>None</div>}
          {sheet.saltsByStage.map((g) => (
            <div key={g.stage}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", marginBottom: 2 }}>{STAGE_LABEL[g.stage] || g.stage}</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  {g.salts.map((s, i) => (
                    <tr key={i}>
                      <td style={miniTd}>{s.name}</td>
                      <td style={{ ...miniTd, textAlign: "right", fontWeight: 700, width: 50 }}>{s.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        {/* Col 2 — Grain bill + hops/additions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={sheetBox}>
            <div style={sectTitle}>Grain Bill (lbs)</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {sheet.grainBill.map((g, i) => (
                  <tr key={i}>
                    <td style={miniTd}>{g.name}</td>
                    <td style={{ ...miniTd, textAlign: "right", fontWeight: 700, width: 60 }}>{g.qty}</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ ...miniTd, fontWeight: 800, borderBottom: "none" }}>Total</td>
                  <td style={{ ...miniTd, textAlign: "right", fontWeight: 800, borderBottom: "none" }}>{sheet.totalGrain}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style={sheetBox}>
            <div style={sectTitle}>Hops &amp; Additions</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={miniTh}>Item</th>
                  <th style={{ ...miniTh, textAlign: "right" }}>Amt</th>
                  <th style={miniTh}>Stage</th>
                  <th style={{ ...miniTh, textAlign: "right" }}>Min</th>
                </tr>
              </thead>
              <tbody>
                {sheet.additions.map((a, i) => (
                  <tr key={i}>
                    <td style={miniTd}>{a.name}</td>
                    <td style={{ ...miniTd, textAlign: "right", fontWeight: 700 }}>{a.qty} {a.unit}</td>
                    <td style={{ ...miniTd, textTransform: "capitalize" }}>{a.stage}</td>
                    <td style={{ ...miniTd, textAlign: "right" }}>{a.time}</td>
                  </tr>
                ))}
                {sheet.additions.length === 0 && (
                  <tr><td style={{ ...miniTd, color: "#94a3b8" }} colSpan={4}>None</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Col 3 — Measured readings + notes */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={sheetBox}>
            <div style={sectTitle}>Measured Readings</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {READINGS.map((r, i) => (
                  <tr key={i}>
                    <td style={{ ...miniTd, whiteSpace: "nowrap" }}>
                      {r.label}{r.ref && <span style={{ color: "#94a3b8", fontWeight: 400 }}> ({r.ref})</span>}
                    </td>
                    <td style={{ ...miniTd, width: 70 }}>&nbsp;</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ ...sheetBox, minHeight: 120 }}>
            <div style={sectTitle}>Notes</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BrewSheetPanel({ recipe }) {
  const [dbl, setDbl] = useState(false);
  const sheet = buildBrewSheet(recipe);
  const pages = dbl ? [1, 2] : [null];

  return (
    <div>
      <style>{PRINT_CSS}</style>

      <div className="no-print" style={{ ...card, display: "flex", gap: 8, alignItems: "center", padding: 10, flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", background: dbl ? "#fef3c7" : "#f1f5f9", color: dbl ? "#92400e" : "#64748b", padding: "8px 14px", borderRadius: 8 }}>
          <input type="checkbox" checked={dbl} onChange={() => setDbl((v) => !v)} style={{ accentColor: "#f59e0b" }} />
          {dbl ? "Double (2 pages)" : "Single"}
        </label>
        <button style={{ ...btn, borderColor: "#f59e0b", color: "#92400e", background: "#fef3c7", fontWeight: 700 }} onClick={() => window.print()}>🖨️ Print</button>
      </div>

      <div className="brew-print">
        {sheet
          ? pages.map((b, i) => <BrewSheetPage key={i} sheet={sheet} batchLabel={b} />)
          : <p className="no-print" style={{ textAlign: "center", color: "#94a3b8", padding: 40 }}>No recipe selected.</p>}
      </div>
    </div>
  );
}
