import { useState } from "react";
import { buildBrewSheet } from "../../lib/brewSheet";
import { card, btn } from "../../styles";

// Brew Sheet panel (Recipes ▸ Brew Sheet): for the recipe selected in the
// Recipes tab, choose single/double batch, preview the printable Brew Day sheet
// on screen, and print it (landscape US Letter). A double batch prints two pages
// (#1, #2) at single-batch amounts.
//
// Process readings (col 3) carried 1:1 from the paper Brew Day template. A field
// is one of three kinds:
//   key:    editable + persisted on the recipe's `process` map (planned Target
//           values the brewer sets once: strike temp, volumes, timings, pH and
//           gravity/yield targets, …). `def` is the pre-printed default shown
//           until it's overridden. The Actual column stays a blank write-in for
//           the brew-day measurement.
//   mirror: read-only, echoes a value already on the recipe (Mash Temp = mt).
//   check:  a prep step done on brew day (water cycled, pH meter calibrated) —
//           prints an empty checkbox to tick by pen; never stored.
const READING_GROUPS = [
  { title: "Mash", fields: [
    { label: "Mill Time", key: "millTime" }, { label: "Water pH (hot)", key: "waterPh", def: "8.4" },
    { label: "Water Cycled", check: true }, { label: "pH Calibrated", check: true },
    { label: "Strike Temp", key: "strikeTemp" }, { label: "Mash Volume", key: "mashVolume" },
    { label: "Mash Temp", mirror: "mashTemp" }, { label: "Sparge Volume", key: "spargeVolume" },
    { label: "Vorlauf Time", key: "vorlaufTime" }, { label: "pH Vorlauf", key: "phVorlauf" },
    { label: "Runoff Time", key: "runoffTime" },
  ] },
  { title: "Boil", fields: [
    { label: "Pre-Boil (SG)", key: "preBoilSg" }, { label: "Pre-Boil Yield", key: "preBoilYield" },
    { label: "pH Mid-Boil", key: "phMidBoil" }, { label: "Boil Time", key: "boilTime" },
    { label: "Post-Boil (SG)", key: "postBoilSg" }, { label: "Post-Boil Yield", key: "postBoilYield" },
  ] },
  { title: "Whirlpool / Knockout", fields: [
    { label: "WP Time", key: "wpTime" }, { label: "WP Temp", key: "wpTemp" },
    { label: "Knockout Time", key: "knockoutTime", def: "20" }, { label: "Knockout Temp", key: "knockoutTemp", def: "80" },
    { label: "pH Final", key: "phFinal", def: "5.2" },
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
// Reading rows are a 3-col table: label | Target | Actual. Target is prefilled
// from the recipe where known (editable+persisted for planned values, a mirror
// for Mash Temp); Actual is always a blank write-in for the brew-day measurement.
const taTh = { textAlign: "center", fontSize: 8, fontWeight: 700, color: "#475569", borderBottom: "1px solid #000", padding: "2px 4px", textTransform: "uppercase", letterSpacing: "0.03em" };
const taLabelTd = { fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.02em", color: "#64748b", whiteSpace: "nowrap", padding: "2px 8px 2px 0" };
const taCell = { padding: "2px 4px", borderLeft: "1px solid #e2e8f0", verticalAlign: "bottom" };
// Editable/value cells share the same underline as a write-in line so the
// printout is identical to the paper sheet.
const taVal = { display: "block", fontSize: 11, fontWeight: 700, borderBottom: "1px solid #94a3b8", minHeight: 15, color: "#000" };
const taInp = { border: "none", borderBottom: "1px solid #94a3b8", outline: "none", fontSize: 11, fontWeight: 700, padding: "0 2px", width: "100%", background: "transparent", color: "#000", boxSizing: "border-box" };

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

// One reading row: label + Target cell + Actual cell. `editable` binds the
// Target to the recipe's `process` map (persists, prints next time); otherwise
// Target shows a static value (a mirror) or a blank line. Actual is always blank.
function ReadingRow({ label, editable, value, placeholder, onChange }) {
  return (
    <tr>
      <td style={taLabelTd}>{label}</td>
      <td style={taCell}>
        {editable
          ? <input type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} style={taInp} />
          : <span style={taVal}>{value || " "}</span>}
      </td>
      <td style={taCell}><span style={taVal}>&nbsp;</span></td>
    </tr>
  );
}

// A brew-day prep step: label + an empty checkbox in the Actual column, ticked
// by pen on the printed sheet (like the blank write-in lines, never stored).
function CheckRow({ label }) {
  return (
    <tr>
      <td style={taLabelTd}>{label}</td>
      <td style={taCell} />
      <td style={{ ...taCell, textAlign: "center", verticalAlign: "middle" }}>
        <span style={{ display: "inline-block", width: 11, height: 11, border: "1.5px solid #000", borderRadius: 2 }} />
      </td>
    </tr>
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

function BrewSheetPage({ sheet, batchLabel, process, onProcess }) {
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
        <div style={{ flex: "0 1 auto", maxWidth: 260 }}>
          <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.1 }}>{sheet.name}</div>
          <div style={{ fontSize: 13, color: "#475569", fontWeight: 600 }}>{sheet.style}</div>
        </div>
        <div style={{ flex: 1, display: "flex", gap: 20, alignItems: "flex-start" }}>
          {/* Date / Brewer */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
            <Field label="Date" />
            <Field label="Brewer(s)" />
          </div>
          {/* Serial / Batch */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
            <Field label="Serial" />
            <Field label="Batch" value={batchLabel ?? undefined} />
          </div>
          {/* Right-aligned 2×2: OG · FG / Mash · ABV */}
          <div style={{ marginLeft: "auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 14px" }}>
            <Field label="Target OG" value={target(sheet.og)} />
            <Field label="Target FG" value={target(sheet.fg)} />
            <Field label="Mash °F" value={target(sheet.mashTemp)} />
            <Field label="ABV %" value={target(sheet.abv)} />
          </div>
        </div>
      </div>

      {/* Body — a left region (adds | grain + hops, with a Notes box spanning
          both along the bottom) beside the full readings stack. */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1.25fr", gap: 12, alignItems: "stretch" }}>
        {/* Left region — two columns up top, full-width Notes below (fills the
            dead space under the shorter column). */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "0.85fr 1.15fr", gap: 12, alignItems: "start" }}>
            {/* Col 1 — Mash Adds / Sparge Adds / Boil Adds */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <SaltBox title="Mash Adds (g)" rows={saltRows("mash", MASH_SALTS)} />
          {spargeSalts.length > 0 && (
            <SaltBox title="Sparge Adds (g)" rows={spargeSalts.map((s) => ({ name: s.name, qty: s.qty }))} extraBlanks={1} />
          )}
          <SaltBox title="Boil Adds (g)" rows={saltRows("boil", BOIL_SALTS)} />
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
                  <th style={miniTh}>Stage</th>
                  <th style={{ ...miniTh, textAlign: "right" }}>Min</th>
                  <th style={{ ...miniTh, textAlign: "right" }}>Amt</th>
                </tr>
              </thead>
              <tbody>
                {sheet.additions.map((a, i) => (
                  <tr key={i}>
                    <td style={miniTd}>{a.name}</td>
                    <td style={{ ...miniTd, textTransform: "capitalize" }}>{a.stage}</td>
                    <td style={{ ...miniTd, textAlign: "right" }}>{a.time}</td>
                    <td style={{ ...miniTd, textAlign: "right", fontWeight: 700 }}>{a.qty} {a.unit}</td>
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
          </div>
          {/* Notes — spans both columns of the left region, growing to fill the
              height left under the shorter column. */}
          <div style={{ ...sheetBox, flex: 1, minHeight: 120 }}>
            <div style={sectTitle}>Notes</div>
          </div>
        </div>

        {/* Col 3 — Process readings (Mash / Boil / Whirlpool-Knockout), 1:1 with
            the paper template. Each reading is a Target (planned, pre-filled from
            the recipe where known) + Actual (blank, filled on brew day) pair. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {READING_GROUPS.map((group) => (
            <div key={group.title} style={sheetBox}>
              <div style={sectTitle}>{group.title}</div>
              <table style={{ ...tbl, tableLayout: "fixed" }}>
                <colgroup>
                  <col />
                  <col style={{ width: 66 }} />
                  <col style={{ width: 66 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={{ ...taTh, textAlign: "left" }} />
                    <th style={taTh}>Target</th>
                    <th style={taTh}>Actual</th>
                  </tr>
                </thead>
                <tbody>
                  {group.fields.map((f, i) => {
                    if (f.key) {
                      const cur = f.key in process ? process[f.key] : (f.def ?? "");
                      return <ReadingRow key={i} label={f.label} editable value={cur} placeholder={f.def} onChange={(v) => onProcess(f.key, v)} />;
                    }
                    if (f.mirror) return <ReadingRow key={i} label={f.label} value={target(sheet[f.mirror])} />;
                    if (f.check) return <CheckRow key={i} label={f.label} />;
                    return <ReadingRow key={i} label={f.label} />;
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function BrewSheetPanel({ recipe, ri, setRecs }) {
  const [dbl, setDbl] = useState(false);
  const sheet = buildBrewSheet(recipe);
  const process = recipe?.process ?? {};
  // Editable readings persist into the recipe's `process` map (one JSONB column).
  const onProcess = (key, value) =>
    setRecs((p) => p.map((rec, i) => (i === ri ? { ...rec, process: { ...(rec.process || {}), [key]: value } } : rec)));
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
          ? pages.map((b, i) => <BrewSheetPage key={i} sheet={sheet} batchLabel={b} process={process} onProcess={onProcess} />)
          : <p className="no-print" style={{ textAlign: "center", color: "#94a3b8", padding: 40 }}>No recipe selected.</p>}
      </div>
    </div>
  );
}
