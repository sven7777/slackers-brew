import { cellarActions } from "../lib/defaults";
import { sortedNames } from "../lib/sortNames";
import { cell, num, th, inp, rmBtn, addRow, sel, addBtn } from "../styles";

// The rows stay in day order (that's the schedule), so the alphabetical list is
// the picker: `cellarActions` is grouped by process order in defaults.js, which
// is the wrong shape for finding "Rouse" in a list of fourteen.
const ACTION_OPTIONS = sortedNames(cellarActions);

// Editable cellar schedule for one recipe. A row is [dayOffset, action]; the
// Cellar Summary sheet turns each into a calendar date (brewDate + day) and
// routes it to the matching box. Duplicate actions are expected (e.g. several
// "Blow Off" days), so there is no de-dup. Rows re-sort by day when a day
// input is committed (blur, not keystroke, so rows don't jump mid-typing);
// same-day rows keep their edit order.

const setField = (setRecs, ri, ii, idx, val) =>
  setRecs((p) => p.map((r, i) => {
    if (i !== ri) return r;
    return { ...r, sc: r.sc.map((row, j) => (j !== ii ? row : row.map((v, k) => (k === idx ? val : v)))) };
  }));

const sortRows = (setRecs, ri) =>
  setRecs((p) => {
    const sc = [...p[ri].sc].sort((a, b) => a[0] - b[0]);
    if (!sc.some((row, j) => row !== p[ri].sc[j])) return p; // already in order
    return p.map((r, i) => (i !== ri ? r : { ...r, sc }));
  });

const rmRow = (setRecs, ri, ii) =>
  setRecs((p) => p.map((r, i) => (i !== ri ? r : { ...r, sc: r.sc.filter((_, j) => j !== ii) })));

const addRowFor = (setRecs, ri, action) => {
  if (!action) return;
  setRecs((p) => p.map((r, i) => (i !== ri ? r : { ...r, sc: [...(r.sc || []), [0, action]] })));
};

export default function ScheduleEditTable({ items = [], ri, setRecs, addSel, setAddSel }) {
  return (
    <div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ ...th, width: 70, textAlign: "right" }}>Day</th>
            <th style={th}>Action</th>
            <th style={{ ...th, width: 36 }}></th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i}>
              <td style={num}>
                <input type="number" step={1} value={it[0]}
                  onChange={(e) => setField(setRecs, ri, i, 0, parseInt(e.target.value, 10) || 0)}
                  onBlur={() => sortRows(setRecs, ri)} style={inp} />
              </td>
              <td style={cell}>
                <select value={it[1]} style={{ ...sel, width: "100%" }}
                  onChange={(e) => setField(setRecs, ri, i, 1, e.target.value)}>
                  {/* Tolerate a stored action that's no longer in the catalog. */}
                  {!cellarActions.includes(it[1]) && <option value={it[1]}>{it[1]}</option>}
                  {ACTION_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </td>
              <td style={{ ...cell, textAlign: "center" }}>
                <button style={rmBtn} onClick={() => rmRow(setRecs, ri, i)} title="Remove">×</button>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr><td style={{ ...cell, color: "#94a3b8" }} colSpan={3}>No schedule yet — add steps below.</td></tr>
          )}
        </tbody>
      </table>
      <div style={addRow}>
        <select value={addSel.sc || ""} onChange={(e) => setAddSel((p) => ({ ...p, sc: e.target.value }))} style={sel}>
          <option value="">Add step...</option>
          {ACTION_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <button style={addBtn} onClick={() => { addRowFor(setRecs, ri, addSel.sc); setAddSel((p) => ({ ...p, sc: "" })); }}>+ Add</button>
      </div>
    </div>
  );
}
