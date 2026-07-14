import { useState } from "react";
import { buildCellarSheet } from "../../lib/cellarSheet";
import { card, btn } from "../../styles";

// Cellar panel (Recipes ▸ Cellar Sheet): for the recipe selected in the Recipes
// tab, enter a brew date, and the printable cellar log auto-fills every dated box
// from the recipe's day-offset schedule (cold crash, bung, dry hop, rouse,
// transfer, carb, keg) plus its yeast / dry-hop / cellar additions. This sheet hangs on
// a clipboard on the fermenter, so it prints PORTRAIT US Letter.
//
// Every scheduled step follows the Brew Day sheet's Target/Actual convention: the
// computed (planned) date fills the TARGET column and an ACTUAL column stays blank
// for the brewer to record what really happened on the tank.

// Scoped print rules, injected inline (no CSS file per project convention).
const PRINT_CSS = `
@media print {
  @page { size: letter portrait; margin: 0.4in; }
  body * { visibility: hidden; }
  .cellar-print, .cellar-print * { visibility: visible; }
  .cellar-print { position: absolute; left: 0; top: 0; width: 100%; }
  .cellar-page { border: none !important; border-radius: 0 !important; margin: 0 !important; padding: 0 !important; max-width: none !important; }
  .no-print { display: none !important; }
}`;

const sheetBox = { border: "1px solid #000", borderRadius: 4, padding: 8, background: "#fff" };
const sectTitle = { fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", margin: "0 0 4px", color: "#000" };
const miniTh = { textAlign: "left", fontSize: 9, fontWeight: 700, color: "#475569", borderBottom: "1px solid #000", padding: "2px 4px" };
const miniTd = { fontSize: 11, padding: "2px 4px", borderBottom: "1px solid #e2e8f0", color: "#000" };
const tbl = { width: "100%", borderCollapse: "collapse" };
const blank = { ...miniTd, color: "#cbd5e1" }; // a write-in cell

// Target/Actual convention borrowed 1:1 from the Brew Sheet: a label column, a
// Target cell (pre-filled from the schedule where known) and an always-blank
// Actual cell for the brew-day record.
const taTh = { textAlign: "center", fontSize: 8, fontWeight: 700, color: "#475569", borderBottom: "1px solid #000", padding: "2px 4px", textTransform: "uppercase", letterSpacing: "0.03em" };
const taLabelTd = { fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.02em", color: "#64748b", whiteSpace: "nowrap", padding: "3px 8px 3px 0", verticalAlign: "bottom" };
const taCell = { padding: "2px 4px", borderLeft: "1px solid #e2e8f0", verticalAlign: "bottom" };
const taVal = { display: "block", fontSize: 11, fontWeight: 700, borderBottom: "1px solid #94a3b8", minHeight: 15, color: "#000" };

// One labeled header field; `value` set → printed, else a write-in line.
function Field({ label, value }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 70, flex: 1 }}>
      <span style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#64748b" }}>{label}</span>
      {value != null
        ? <span style={{ fontSize: 13, fontWeight: 700, borderBottom: "1px solid #94a3b8", minHeight: 18 }}>{value}</span>
        : <span style={{ borderBottom: "1px solid #94a3b8", minHeight: 18 }}>&nbsp;</span>}
    </div>
  );
}

// A Target/Actual reading row: left label, Target cell (pre-filled where known),
// blank Actual cell. Mirrors the Brew Sheet's ReadingRow.
function TARow({ label, target }) {
  return (
    <tr>
      <td style={taLabelTd}>{label}</td>
      <td style={taCell}><span style={target != null ? taVal : { ...taVal, color: "#cbd5e1" }}>{target != null ? target : " "}</span></td>
      <td style={taCell}><span style={taVal}>&nbsp;</span></td>
    </tr>
  );
}

// A titled box wrapping a Target/Actual table. `rows` are {label, target}.
function TABox({ title, rows, empty }) {
  return (
    <div style={sheetBox}>
      <div style={sectTitle}>{title}</div>
      <table style={{ ...tbl, tableLayout: "fixed" }}>
        <colgroup><col /><col style={{ width: 72 }} /><col style={{ width: 72 }} /></colgroup>
        <thead><tr><th style={{ ...taTh, textAlign: "left" }} /><th style={taTh}>Target</th><th style={taTh}>Actual</th></tr></thead>
        <tbody>
          {rows.length === 0
            ? <tr><td style={{ ...blank, fontStyle: "italic" }} colSpan={3}>{empty || "—"}</td></tr>
            : rows.map((r, i) => <TARow key={i} label={r.label} target={r.target} />)}
        </tbody>
      </table>
    </div>
  );
}

// A labeled write-in row (left label, blank line right) for the Yeast / Transfer
// blocks filled by hand. `value` pre-fills when known.
function LabeledRow({ label, value }) {
  return (
    <tr>
      <td style={{ ...miniTd, fontWeight: 700, color: "#475569", whiteSpace: "nowrap", width: "45%" }}>{label}</td>
      <td style={value != null ? { ...miniTd, fontWeight: 700 } : blank}>{value != null ? value : " "}</td>
    </tr>
  );
}

function CellarSheetPage({ sheet }) {
  const GRAVITY_ROWS = 4;      // blank gravity-log rows
  const PACKAGING_ROWS = 3;    // blank packaging rows

  return (
    <div className="cellar-page" style={{ width: "100%", maxWidth: 760, margin: "0 auto", border: "1px solid #cbd5e1", borderRadius: 8, padding: 16, background: "#fff", color: "#000" }}>
      {/* Header band */}
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", borderBottom: "2px solid #000", paddingBottom: 8, marginBottom: 10 }}>
        <div style={{ flex: "0 1 auto", maxWidth: 240 }}>
          <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.1 }}>{sheet.name}</div>
          <div style={{ fontSize: 12, color: "#475569", fontWeight: 600 }}>{sheet.style}</div>
        </div>
        <div style={{ flex: 1, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Field label="Date Brewed" value={sheet.dateBrewed ?? undefined} />
          <Field label="Serial" />
          <Field label="Tank" />
          <Field label="Target OG" value={sheet.og ?? undefined} />
          <Field label="Target FG" value={sheet.fg ?? undefined} />
        </div>
      </div>

      {/* Two-column body (portrait) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }}>
        {/* Col 1 — Yeast, Cold Crash, Bung, Temp Raising, Dry Hop, Transfer/Carb */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={sheetBox}>
            <div style={sectTitle}>Yeast</div>
            <table style={tbl}><tbody>
              <LabeledRow label="K.O. Temp" />
              <LabeledRow label="Ferm Temp" value={sheet.fermTemp != null ? `${sheet.fermTemp}°F` : undefined} />
              <LabeledRow label="Time of Pitch" />
              <LabeledRow label="Gen / Type" value={sheet.yeast.length ? sheet.yeast.map((x) => x.name).join(", ") : undefined} />
            </tbody></table>
          </div>

          {/* Temp Raising is a hand-written step (no recipe/BeerSmith source yet). */}
          <TABox title="Temp Raising"
            rows={[{ label: "Rs. 64", target: null }]} />

          <TABox title="Bung" rows={[{ label: "Bung", target: sheet.bung }]} />

          {/* Always three fixed crash steps; Target fills from the schedule where
              a matching temp exists, otherwise stays a blank write-in line. */}
          <TABox title="Cold Crashing"
            rows={[55, 40, 33].map((t) => ({
              label: `CC ${t}`,
              target: sheet.coldCrash.find((c) => c.temp === t)?.date ?? null,
            }))} />

          {/* Dry Hop keeps a variety/amount table but adds a Target/Actual date pair. */}
          <div style={sheetBox}>
            <div style={sectTitle}>Dry Hop</div>
            <table style={{ ...tbl, tableLayout: "fixed" }}>
              <colgroup><col /><col style={{ width: 40 }} /><col style={{ width: 60 }} /><col style={{ width: 60 }} /></colgroup>
              <thead><tr>
                <th style={miniTh}>Type</th><th style={{ ...miniTh, textAlign: "right" }}>Amt</th>
                <th style={taTh}>Target</th><th style={taTh}>Actual</th>
              </tr></thead>
              <tbody>
                {sheet.dryHop.items.map((it, i) => (
                  <tr key={i}>
                    <td style={miniTd}>{it.name}</td>
                    <td style={{ ...miniTd, textAlign: "right", fontWeight: 700 }}>{it.qty} oz</td>
                    <td style={taCell}><span style={i === 0 && sheet.dryHop.dates[0] ? taVal : { ...taVal, color: "#cbd5e1" }}>{i === 0 && sheet.dryHop.dates[0] ? sheet.dryHop.dates[0] : " "}</span></td>
                    <td style={taCell}><span style={taVal}>&nbsp;</span></td>
                  </tr>
                ))}
                {sheet.dryHop.items.length === 0 && <tr><td style={{ ...blank, fontStyle: "italic" }} colSpan={4}>No dry hop.</td></tr>}
              </tbody>
            </table>
          </div>

          <TABox title="Rousing" empty="No rouse."
            rows={sheet.rouse.map((d) => ({ label: "Rouse", target: d }))} />

          <div style={sheetBox}>
            <div style={sectTitle}>Misc. Additions</div>
            <table style={tbl}>
              <thead><tr><th style={miniTh}>Date</th><th style={miniTh}>Type</th><th style={{ ...miniTh, textAlign: "right" }}>Amt</th></tr></thead>
              <tbody>
                {sheet.misc.map((m, i) => (
                  <tr key={i}>
                    <td style={blank}>&nbsp;</td>
                    <td style={miniTd}>{m.name}</td>
                    <td style={{ ...miniTd, textAlign: "right", fontWeight: 700 }}>{m.qty} {m.unit}</td>
                  </tr>
                ))}
                {sheet.misc.length === 0 && <tr><td style={{ ...blank, fontStyle: "italic" }} colSpan={3}>None.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Col 2 — Gravity Log, Blow Offs, Transfer/Carb, Packaging, Misc Additions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={sheetBox}>
            <div style={{ ...sectTitle, display: "flex", justifyContent: "space-between" }}>
              <span>Gravity Log</span>
              <span style={{ fontWeight: 700, color: "#475569" }}>Target FG {sheet.fg ?? "—"}</span>
            </div>
            <table style={tbl}>
              <thead><tr>
                <th style={miniTh}>Date</th><th style={miniTh}>Gravity</th><th style={miniTh}>Temp</th><th style={miniTh}>Initial</th>
              </tr></thead>
              <tbody>
                {Array.from({ length: GRAVITY_ROWS }).map((_, i) => (
                  <tr key={i}><td style={blank}>&nbsp;</td><td style={blank}>&nbsp;</td><td style={blank}>&nbsp;</td><td style={blank}>&nbsp;</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={sheetBox}>
            <div style={sectTitle}>Blow Offs</div>
            <table style={{ ...tbl, tableLayout: "fixed" }}>
              <colgroup><col /><col /></colgroup>
              <thead><tr><th style={taTh}>Target</th><th style={taTh}>Actual</th></tr></thead>
              <tbody>
                {/* Always at least 5 rows; Target fills from the schedule, rest blank. */}
                {Array.from({ length: Math.max(5, sheet.blowOffs.length) }).map((_, i) => {
                  const date = sheet.blowOffs[i]?.date;
                  return (
                    <tr key={i}>
                      <td style={{ ...taCell, borderLeft: "none" }}><span style={date ? taVal : { ...taVal, color: "#cbd5e1" }}>{date || " "}</span></td>
                      <td style={taCell}><span style={taVal}>&nbsp;</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={sheetBox}>
            <div style={sectTitle}>Transfer / Carb</div>
            <table style={tbl}><tbody>
              <LabeledRow label="Tanks Involved" />
            </tbody></table>
            <table style={{ ...tbl, tableLayout: "fixed", marginTop: 4 }}>
              <colgroup><col /><col style={{ width: 72 }} /><col style={{ width: 72 }} /></colgroup>
              <thead><tr><th style={{ ...taTh, textAlign: "left" }} /><th style={taTh}>Target</th><th style={taTh}>Actual</th></tr></thead>
              <tbody>
                <TARow label="Transfer" target={sheet.transfer} />
                <TARow label="Carb Date" target={sheet.carb} />
                <TARow label="Carb Level" target={null} />
                <TARow label="Carb Time" target={null} />
                <TARow label="Finished Beer" target={null} />
              </tbody>
            </table>
          </div>

          <div style={sheetBox}>
            <div style={sectTitle}>Packaging Summary</div>
            <table style={tbl}>
              <thead><tr>
                <th style={miniTh}>Date</th><th style={miniTh}>1/2 BBL</th><th style={miniTh}>1/4 BBL</th><th style={miniTh}>1/6 BBL</th>
              </tr></thead>
              <tbody>
                {Array.from({ length: PACKAGING_ROWS }).map((_, i) => (
                  <tr key={i}>
                    {/* First row's date pre-fills from the schedule's "Keg" step. */}
                    <td style={i === 0 && sheet.keg ? { ...miniTd, fontWeight: 700 } : blank}>{i === 0 && sheet.keg ? sheet.keg : " "}</td>
                    <td style={blank}>&nbsp;</td><td style={blank}>&nbsp;</td><td style={blank}>&nbsp;</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div style={{ ...sheetBox, minHeight: 80, marginTop: 12 }}>
        <div style={sectTitle}>Notes</div>
      </div>
    </div>
  );
}

export default function CellarPanel({ recipe }) {
  const [brewDate, setBrewDate] = useState("");
  const sheet = buildCellarSheet(recipe, brewDate || null);

  return (
    <div>
      <style>{PRINT_CSS}</style>

      <div className="no-print" style={{ ...card, display: "flex", gap: 8, alignItems: "center", padding: 10, flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#64748b" }}>
          Brew date
          <input type="date" value={brewDate} onChange={(e) => setBrewDate(e.target.value)}
            style={{ padding: "8px 10px", fontSize: 14, borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", color: "#1e293b" }} />
        </label>
        <button style={{ ...btn, borderColor: "#f59e0b", color: "#92400e", background: "#fef3c7", fontWeight: 700 }} onClick={() => window.print()}>🖨️ Print</button>
      </div>

      <div className="cellar-print">
        {sheet
          ? <CellarSheetPage sheet={sheet} />
          : <p className="no-print" style={{ textAlign: "center", color: "#94a3b8", padding: 40 }}>No recipe selected.</p>}
      </div>
    </div>
  );
}
