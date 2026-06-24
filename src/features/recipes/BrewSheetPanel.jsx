import { useState } from "react";
import { buildBrewSheet } from "../../lib/brewSheet";
import { card, btn } from "../../styles";

// Brew Sheet panel (Recipes ▸ Brew Sheet): for the recipe selected in the
// Recipes tab, choose single/double batch, preview the printable Brew Day sheet
// on screen, and print it (landscape US Letter). A double batch prints two pages
// (#1, #2) at single-batch amounts. Print-only — no saved log.

// Process readings carried 1:1 from the paper Brew Day template, grouped by
// phase and laid out two-up. `ref` is the pre-printed reference value from the
// template (shown on the line); no `ref` = a blank write-in line. Order matches
// the paper sheet top-to-bottom.
const READING_GROUPS = [
  { title: "Mash", fields: [
    { label: "Mill Time" }, { label: "Water pH (hot)", ref: "8.4" },
    { label: "Water Cycled" }, { label: "pH Calibrated" },
    { label: "Strike Temp" }, { label: "Mash Volume" },
    { label: "Mash Temp" }, { label: "Sparge Volume" },
    { label: "Vorlauf Time" }, { label: "pH Vorlauf" },
    { label: "Runoff Time" },
  ] },
  { title: "Boil", fields: [
    { label: "Pre-Boil (SG)" }, { label: "Pre-Boil Yield" },
    { label: "pH Mid-Boil" }, { label: "Boil Time" },
    { label: "Post-Boil (SG)" }, { label: "Post-Boil Yield" },
  ] },
  { title: "Whirlpool / Knockout", fields: [
    { label: "WP Time", ref: "5 active / 15 not" }, { label: "WP Temp" },
    { label: "Knockout Time", ref: "20" }, { label: "Knockout Temp", ref: "80" },
    { label: "pH Final", ref: "5.2" },
  ] },
];

// Salt rows the paper template pre-prints for each stage; the recipe's actual
// amounts fill in where present, the rest stay blank write-ins (matching the
// form the brewers know). Sparge salts, when a recipe has them, render in their
// own box from the recipe data.
const MASH_SALTS = ["Lactic Acid", "CaCl2", "CaSo4", "Epsom", "Chalk", "Baking Soda"];
const BOIL_SALTS = ["CaCl2", "CaSo4", "Epsom", "Chalk", "Baking Soda"];

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
const tbl = { width: "100%", borderCollapse: "collapse" };

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

// One compact reading cell: small caps label over a value/write-in line. A
// template default value prints on the line; otherwise the line is blank.
function Reading({ label, value }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <span style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", color: "#64748b", whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 700, borderBottom: "1px solid #94a3b8", minHeight: 16 }}>{value ||" "}</span>
    </div>
  );
}

// A stage's salt additions: the template's pre-printed rows with recipe amounts
// filled in where present, plus a couple of blank rows for hand-written extras.
function SaltBox({ title, rows, extraBlanks = 2 }) {
  return (
    <div style={sheetBox}>
      <div style={sectTitle}>{title}</div>
      <table style={tbl}><tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td style={miniTd}>{r.name}</td>
            <td style={{ ...miniTd, textAlign: "right", fontWeight: 700, width: 50 }}>{r.qty != null ? r.qty : " "}</td>
          </tr>
        ))}
        {Array.from({ length: extraBlanks }).map((_, i) => (
          <tr key={`b${i}`}><td style={miniTd}>&nbsp;</td><td style={miniTd}>&nbsp;</td></tr>
        ))}
      </tbody></table>
    </div>
  );
}

function BrewSheetPage({ sheet, batchLabel }) {
  const target = (v) => (v == null ? "" : v);

  // Pre-print the template's salt rows for a stage, filling amounts the recipe
  // specifies. Recipe salts not on the template list are appended so nothing is lost.
  const saltRows = (stage, template) => {
    const recipeSalts = sheet.saltsByStage.find((g) => g.stage === stage)?.salts ?? [];
    const byName = new Map(recipeSalts.map((s) => [s.name, s.qty]));
    const extra = recipeSalts.filter((s) => !template.includes(s.name));
    return [
      ...template.map((name) => ({ name, qty: byName.has(name) ? byName.get(name) : null })),
      ...extra.map((s) => ({ name: s.name, qty: s.qty })),
    ];
  };
  const spargeSalts = sheet.saltsByStage.find((g) => g.stage === "sparge")?.salts ?? [];

  const GRAIN_BLANKS = 3;
  const HOP_BLANKS = 4;

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

      {/* Three-column body — mirrors the paper template: adds + notes | grain +
          hops | the full readings stack. */}
      <div style={{ display: "grid", gridTemplateColumns: "0.85fr 1.15fr 1.25fr", gap: 12, alignItems: "start" }}>
        {/* Col 1 — Mash Adds / Sparge Adds / Boil Adds + Notes */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <SaltBox title="Mash Adds (g)" rows={saltRows("mash", MASH_SALTS)} />
          {spargeSalts.length > 0 && (
            <SaltBox title="Sparge Adds (g)" rows={spargeSalts.map((s) => ({ name: s.name, qty: s.qty }))} extraBlanks={1} />
          )}
          <SaltBox title="Boil Adds (g)" rows={saltRows("boil", BOIL_SALTS)} />
          <div style={{ ...sheetBox, flex: 1, minHeight: 120 }}>
            <div style={sectTitle}>Notes</div>
          </div>
        </div>

        {/* Col 2 — Grain bill + hops/additions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={sheetBox}>
            <div style={sectTitle}>Grain Bill (lbs)</div>
            <table style={tbl}>
              <tbody>
                {sheet.grainBill.map((g, i) => (
                  <tr key={i}>
                    <td style={miniTd}>{g.name}</td>
                    <td style={{ ...miniTd, textAlign: "right", fontWeight: 700, width: 60 }}>{g.qty}</td>
                  </tr>
                ))}
                {Array.from({ length: GRAIN_BLANKS }).map((_, i) => (
                  <tr key={`b${i}`}><td style={miniTd}>&nbsp;</td><td style={miniTd}>&nbsp;</td></tr>
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
            <table style={tbl}>
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
                {Array.from({ length: HOP_BLANKS }).map((_, i) => (
                  <tr key={`b${i}`}>
                    <td style={miniTd}>&nbsp;</td><td style={miniTd}>&nbsp;</td><td style={miniTd}>&nbsp;</td><td style={miniTd}>&nbsp;</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Col 3 — Process readings (Mash / Boil / Whirlpool-Knockout), 1:1 with
            the paper template, laid out two-up. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {READING_GROUPS.map((group) => (
            <div key={group.title} style={sheetBox}>
              <div style={sectTitle}>{group.title}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 12px" }}>
                {group.fields.map((f, i) => <Reading key={i} label={f.label} value={f.ref} />)}
              </div>
            </div>
          ))}
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
