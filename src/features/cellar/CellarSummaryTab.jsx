import { useState } from "react";
import { buildCellarSheet } from "../../lib/cellarSheet";
import { card, btn } from "../../styles";

// Cellar Summary tab: pick a recipe, enter a brew date, and the printable cellar
// log auto-fills every dated box from the recipe's day-offset schedule (cold
// crash, bung, dry hop, rouse, transfer, keg) plus its yeast / dry-hop / cellar
// additions. Layout mirrors the paper "Cellar Summary" worksheet 1:1. Print-only
// (landscape US Letter) — readings/gravities/packaging stay blank for hand entry.

// Scoped print rules, injected inline (no CSS file per project convention).
const PRINT_CSS = `
@media print {
  @page { size: letter landscape; margin: 0.4in; }
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

// One labeled header field; `value` set → printed, else a write-in line.
function Field({ label, value }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 80, flex: 1 }}>
      <span style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#64748b" }}>{label}</span>
      {value != null
        ? <span style={{ fontSize: 13, fontWeight: 700, borderBottom: "1px solid #94a3b8", minHeight: 18 }}>{value}</span>
        : <span style={{ borderBottom: "1px solid #94a3b8", minHeight: 18 }}>&nbsp;</span>}
    </div>
  );
}

// A labeled write-in row (left label, blank line right) for the Yeast / Transfer
// blocks that are filled by hand on brew day. `value` pre-fills when known.
function LabeledRow({ label, value }) {
  return (
    <tr>
      <td style={{ ...miniTd, fontWeight: 700, color: "#475569", whiteSpace: "nowrap", width: "45%" }}>{label}</td>
      <td style={value != null ? { ...miniTd, fontWeight: 700 } : blank}>{value != null ? value : " "}</td>
    </tr>
  );
}

function CellarSheetPage({ sheet }) {
  const GRAVITY_ROWS = 12;     // blank gravity-log rows
  const PACKAGING_ROWS = 6;    // blank packaging rows
  return (
    <div className="cellar-page" style={{ width: "100%", maxWidth: 1040, margin: "0 auto", border: "1px solid #cbd5e1", borderRadius: 8, padding: 16, background: "#fff", color: "#000" }}>
      {/* Header band */}
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", borderBottom: "2px solid #000", paddingBottom: 8, marginBottom: 10 }}>
        <div style={{ flex: 2 }}>
          <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.1 }}>{sheet.name}</div>
          <div style={{ fontSize: 13, color: "#475569", fontWeight: 600 }}>{sheet.style}</div>
        </div>
        <div style={{ flex: 3, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Field label="Date Brewed" value={sheet.dateBrewed ?? undefined} />
          <Field label="Serial" />
          <Field label="Tank" />
        </div>
      </div>

      {/* Three-column body */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr 1fr", gap: 12, alignItems: "start" }}>
        {/* Col 1 — Yeast, Temp Raising, Cold Crash, Bung, Transfer/Carb */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={sheetBox}>
            <div style={sectTitle}>Yeast</div>
            <table style={tbl}><tbody>
              <LabeledRow label="K.O. Temp" />
              <LabeledRow label="Ferm Temp" />
              <LabeledRow label="Time of Pitch" />
              <LabeledRow label="Gen / Type" value={sheet.yeast.length ? sheet.yeast.map((x) => x.name).join(", ") : undefined} />
            </tbody></table>
          </div>
          <div style={sheetBox}>
            <div style={sectTitle}>Temp Raising</div>
            <table style={tbl}><tbody>
              <LabeledRow label="Date" />
              <LabeledRow label="Rouse" value={sheet.rouse[0] ?? undefined} />
            </tbody></table>
          </div>
          <div style={sheetBox}>
            <div style={sectTitle}>Cold Crashing</div>
            <table style={tbl}><tbody>
              {sheet.coldCrash.length === 0 && <tr><td style={blank} colSpan={2}>&nbsp;</td></tr>}
              {sheet.coldCrash.map((c, i) => (
                <tr key={i}>
                  <td style={{ ...miniTd, fontWeight: 700, color: "#475569", width: "45%" }}>Cr. {c.temp}</td>
                  <td style={c.date ? { ...miniTd, fontWeight: 700 } : blank}>{c.date || " "}</td>
                </tr>
              ))}
            </tbody></table>
          </div>
          <div style={sheetBox}>
            <div style={sectTitle}>Bung</div>
            <table style={tbl}><tbody>
              <LabeledRow label="Date" value={sheet.bung ?? undefined} />
            </tbody></table>
          </div>
          <div style={sheetBox}>
            <div style={sectTitle}>Transfer / Carb</div>
            <table style={tbl}><tbody>
              <LabeledRow label="Date" value={sheet.transfer ?? undefined} />
              <LabeledRow label="Tanks Involved" />
              <LabeledRow label="Carb Level" />
              <LabeledRow label="Carb Time" />
              <LabeledRow label="Finished Beer" />
            </tbody></table>
          </div>
        </div>

        {/* Col 2 — Gravity log, Blow Offs, Packaging Summary */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={sheetBox}>
            <div style={sectTitle}>Gravity / Temp Log</div>
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
            <table style={tbl}>
              <thead><tr><th style={miniTh}>Date</th><th style={miniTh}>Initial</th></tr></thead>
              <tbody>
                {sheet.blowOffs.map((b, i) => (
                  <tr key={i}>
                    <td style={b.date ? { ...miniTd, fontWeight: 700 } : blank}>{b.date || " "}</td>
                    <td style={blank}>&nbsp;</td>
                  </tr>
                ))}
                {sheet.blowOffs.length === 0 && <tr><td style={blank}>&nbsp;</td><td style={blank}>&nbsp;</td></tr>}
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
                  <tr key={i}><td style={blank}>&nbsp;</td><td style={blank}>&nbsp;</td><td style={blank}>&nbsp;</td><td style={blank}>&nbsp;</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Col 3 — Dry Hop, Rouse, Misc Additions, Schedule */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={sheetBox}>
            <div style={sectTitle}>Dry Hop</div>
            <table style={tbl}>
              <thead><tr><th style={miniTh}>Date</th><th style={miniTh}>Type</th><th style={{ ...miniTh, textAlign: "right" }}>Amt</th></tr></thead>
              <tbody>
                {sheet.dryHop.items.map((it, i) => (
                  <tr key={i}>
                    <td style={sheet.dryHop.dates[0] ? { ...miniTd, fontWeight: 700 } : blank}>{sheet.dryHop.dates[0] || " "}</td>
                    <td style={miniTd}>{it.name}</td>
                    <td style={{ ...miniTd, textAlign: "right", fontWeight: 700 }}>{it.qty} oz</td>
                  </tr>
                ))}
                {sheet.dryHop.items.length === 0 && <tr><td style={blank} colSpan={3}>&nbsp;</td></tr>}
              </tbody>
            </table>
          </div>
          <div style={sheetBox}>
            <div style={sectTitle}>Rouse</div>
            <table style={tbl}>
              <thead><tr><th style={miniTh}>Date</th><th style={miniTh}>Initial</th></tr></thead>
              <tbody>
                {sheet.rouse.map((d, i) => (
                  <tr key={i}><td style={{ ...miniTd, fontWeight: 700 }}>{d}</td><td style={blank}>&nbsp;</td></tr>
                ))}
                {sheet.rouse.length === 0 && <tr><td style={blank}>&nbsp;</td><td style={blank}>&nbsp;</td></tr>}
              </tbody>
            </table>
          </div>
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
                {sheet.misc.length === 0 && <tr><td style={blank} colSpan={3}>&nbsp;</td></tr>}
              </tbody>
            </table>
          </div>
          <div style={sheetBox}>
            <div style={sectTitle}>Schedule</div>
            <table style={tbl}>
              <thead><tr><th style={{ ...miniTh, textAlign: "right" }}>Day</th><th style={miniTh}>Action</th><th style={miniTh}>Date</th></tr></thead>
              <tbody>
                {sheet.schedule.map((row, i) => (
                  <tr key={i}>
                    <td style={{ ...miniTd, textAlign: "right", fontWeight: 700 }}>{row.day}</td>
                    <td style={miniTd}>{row.action}</td>
                    <td style={row.date ? { ...miniTd, fontWeight: 700 } : blank}>{row.date || " "}</td>
                  </tr>
                ))}
                {sheet.schedule.length === 0 && <tr><td style={{ ...blank, fontStyle: "italic" }} colSpan={3}>No schedule set for this recipe.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div style={{ ...sheetBox, minHeight: 90, marginTop: 12 }}>
        <div style={sectTitle}>Notes</div>
      </div>
    </div>
  );
}

export default function CellarSummaryTab({ recs }) {
  const [sel, setSel] = useState(0);
  const [brewDate, setBrewDate] = useState("");
  const sheet = buildCellarSheet(recs[sel], brewDate || null);

  return (
    <div>
      <style>{PRINT_CSS}</style>

      <div className="no-print" style={{ ...card, display: "flex", gap: 8, alignItems: "center", padding: 10, flexWrap: "wrap" }}>
        <select value={sel} onChange={(e) => setSel(+e.target.value)}
          style={{ flex: 1, minWidth: 200, padding: "10px 12px", fontSize: 15, fontWeight: 600, borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", color: "#1e293b" }}>
          {recs.map((r, i) => <option key={i} value={i}>{r.n} — {r.s}</option>)}
        </select>
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
