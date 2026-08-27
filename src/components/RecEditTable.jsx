import { brewDayStages, cellarStages, saltStages, stageLabels } from "../lib/defaults";
import { addIngredient } from "../lib/recipeRows";
import { sortedNames, sortedWithIndex } from "../lib/sortNames";
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

// The picker's last entry, when a catalog browser is wired up. It is a VALUE
// rather than a name so it can never collide with an ingredient called
// something similar.
const BROWSE = "\u0000browse";

// Editable ingredient table for one recipe category. Hops/adjuncts/salts gain
// Stage (and, for hops/adjuncts, Time) columns; staged categories allow the
// same ingredient to be added multiple times. A recipe saved before a category
// existed (stale localStorage) has no array for it at all, so default to empty.
//
// Rows and the picker both read alphabetically — a 20-malt catalog and a
// 9-row grain bill are both things you scan for a name. The sort is a DISPLAY
// order only: the stored array keeps its own order (which is what the printable
// sheets group by stage and time), so every edit still addresses `row.index`,
// the position in that array, not the position on screen.
export default function RecEditTable({ items = [], cat, names, unit, ri, showUnit, setRecs, addSel, setAddSel, onBrowse }) {
  const cfg = CFG[cat];
  const used = new Set(items.map((x) => x[0]));
  const avail = sortedNames(cfg.dups ? names : names.filter((n) => !used.has(n)));
  const rows = sortedWithIndex(items, (t) => t[0]);
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
          {rows.map(({ item: it, index: i }) => (
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
                  {/* minWidth, not a column width: with auto table layout the
                      column sized to whatever fit and clipped the label. Fine
                      when it read "whirlp", not fine when "Dry Hop 1" and
                      "Dry Hop 2" clip to the same "Dry H". */}
                  <select value={it[cfg.stageAt] || ""} style={{ ...sel, width: "100%", minWidth: 96 }}
                    onChange={(e) => setField(setRecs, ri, cat, i, cfg.stageAt, e.target.value)}>
                    {cfg.stages.map((s) => <option key={s} value={s}>{stageLabels[s] ?? s}</option>)}
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
      {(avail.length > 0 || onBrowse) && (
        <div style={addRow}>
          {/* ⚠️ The picker stays what it was: the brewery's own ingredients, in
              alphabetical order. Dumping the vendor's 563 products in here would
              undo exactly what that sort was for. Browsing the catalog is one
              entry at the BOTTOM, and it goes through the adopt dialog, which is
              where a vendor product acquires a name we would put on a brew
              sheet. */}
          <select value={addSel[cat]} style={sel}
            onChange={(e) => {
              const v = e.target.value;
              if (v === BROWSE) { setAddSel((p) => ({ ...p, [cat]: "" })); onBrowse(cat); return; }
              setAddSel((p) => ({ ...p, [cat]: v }));
            }}>
            <option value="">Add {cat === "sa" ? "salt" : "ingredient"}...</option>
            {avail.map((n) => <option key={n} value={n}>{n}</option>)}
            {onBrowse && <option value={BROWSE}>Browse catalog…</option>}
          </select>
          <button style={addBtn} onClick={() => { addIngredient(setRecs, ri, cat, addSel[cat]); setAddSel((p) => ({ ...p, [cat]: "" })); }}>+ Add</button>
        </div>
      )}
    </div>
  );
}
