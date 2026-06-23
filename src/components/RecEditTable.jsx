import { adjUnits, brewDayStages, cellarStages, saltStages } from "../lib/defaults";
import { cell, num, th, inp, rmBtn, addRow, sel, addBtn } from "../styles";

const ALL_STAGES = [...brewDayStages, ...cellarStages];

// Per-category tuple layout. `stageAt`/`timeAt` are the tuple indices a staged
// category edits; `dups` allows the same ingredient to appear more than once
// (a hop added at several times); `unitAt` marks where an adjunct's unit lives.
const CFG = {
  m:  { step: 0.5 },
  y:  { step: 1 },
  h:  { step: 0.5, stages: ALL_STAGES, stageAt: 2, timeAt: 3, dups: true },
  a:  { step: 0.5, stages: ALL_STAGES, unitAt: 2, stageAt: 3, timeAt: 4, dups: true },
  sa: { step: 1, stages: saltStages, stageAt: 2, dups: true },
};

// Set one tuple field (by index) of one ingredient row, immutably.
const setField = (setRecs, ri, cat, ii, idx, val) =>
  setRecs((p) => p.map((r, i) => {
    if (i !== ri) return r;
    return { ...r, [cat]: r[cat].map((row, j) => (j !== ii ? row : row.map((v, k) => (k === idx ? val : v)))) };
  }));

const rmItem = (setRecs, ri, cat, ii) =>
  setRecs((p) => p.map((r, i) => (i !== ri ? r : { ...r, [cat]: r[cat].filter((_, j) => j !== ii) })));

// New rows are seeded with the category's default stage/time so they print
// somewhere sensible until edited.
const newRow = (cat, name) => {
  if (cat === "h") return [name, 0, "boil", 0];
  if (cat === "a") return [name, 0, adjUnits[name] || "each", "boil", 0];
  if (cat === "sa") return [name, 0, "mash"];
  return [name, 0];
};
const addItem = (setRecs, ri, cat, name) => {
  if (!name) return;
  setRecs((p) => p.map((r, i) => (i !== ri ? r : { ...r, [cat]: [...r[cat], newRow(cat, name)] })));
};

// Editable ingredient table for one recipe category. Hops/adjuncts/salts gain
// Stage (and, for hops/adjuncts, Time) columns; staged categories allow the
// same ingredient to be added multiple times.
export default function RecEditTable({ items, cat, names, unit, ri, showUnit, setRecs, addSel, setAddSel }) {
  const cfg = CFG[cat];
  const used = new Set(items.map((x) => x[0]));
  const avail = cfg.dups ? names : names.filter((n) => !used.has(n));
  const hasStage = cfg.stageAt != null;
  const hasTime = cfg.timeAt != null;

  return (
    <div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={th}>Ingredient</th>
            <th style={{ ...th, textAlign: "right" }}>{unit}</th>
            {hasStage && <th style={th}>Stage</th>}
            {hasTime && <th style={{ ...th, textAlign: "right" }}>Min</th>}
            <th style={{ ...th, width: 36 }}></th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i}>
              <td style={cell}>
                {it[0]}
                {showUnit && it[cfg.unitAt] ? (
                  <span style={{ color: "#94a3b8", fontSize: 11 }}> ({it[cfg.unitAt]})</span>
                ) : null}
              </td>
              <td style={num}>
                <input type="number" step={cfg.step} value={it[1]}
                  onChange={(e) => setField(setRecs, ri, cat, i, 1, parseFloat(e.target.value) || 0)} style={inp} />
              </td>
              {hasStage && (
                <td style={cell}>
                  <select value={it[cfg.stageAt] || ""} style={{ ...sel, width: "100%" }}
                    onChange={(e) => setField(setRecs, ri, cat, i, cfg.stageAt, e.target.value)}>
                    {cfg.stages.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
              )}
              {hasTime && (
                <td style={num}>
                  <input type="number" step={1} value={it[cfg.timeAt] ?? 0}
                    onChange={(e) => setField(setRecs, ri, cat, i, cfg.timeAt, parseFloat(e.target.value) || 0)} style={inp} />
                </td>
              )}
              <td style={{ ...cell, textAlign: "center" }}>
                <button style={rmBtn} onClick={() => rmItem(setRecs, ri, cat, i)} title="Remove">×</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {avail.length > 0 && (
        <div style={addRow}>
          <select value={addSel[cat]} onChange={(e) => setAddSel((p) => ({ ...p, [cat]: e.target.value }))} style={sel}>
            <option value="">Add {cat === "sa" ? "salt" : "ingredient"}...</option>
            {avail.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <button style={addBtn} onClick={() => { addItem(setRecs, ri, cat, addSel[cat]); setAddSel((p) => ({ ...p, [cat]: "" })); }}>+ Add</button>
        </div>
      )}
    </div>
  );
}
