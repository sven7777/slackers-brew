import { useMemo, useState } from "react";
import { parseBeerSmith } from "../../lib/beersmith";
import { unmappedInRecipe, applyMappings, summarizeRecipe, diffRecipes, mappingKey, FIELD_LABELS } from "../../lib/importRecipe";
import { maltNames, hopNames, yeastNames, adjNames, saltNames } from "../../lib/defaults";
import { card, hdr, btn, addBtn, sel, inp } from "../../styles";

const CAT_NAMES = { malt: maltNames, hop: hopNames, yeast: yeastNames, adj: adjNames, salt: saltNames };

// Import a BeerSmith .bsmx: parse → pick recipe → map unknown ingredients →
// preview (a diff when updating) → create a new recipe or replace an existing
// one. Reuses the shared parser (lib/beersmith.js) entirely in the browser.
export default function ImportBeerSmith({ recs, setRecs, onImported, onClose }) {
  const [parsed, setParsed] = useState(null); // {recipes, unmapped} | {error}
  const [recipeIdx, setRecipeIdx] = useState(0);
  const [mode, setMode] = useState("create"); // "create" | "update"
  const [targetIdx, setTargetIdx] = useState(0);
  const [mappings, setMappings] = useState({});
  const [newName, setNewName] = useState("");

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = parseBeerSmith(await file.text());
      if (!result.recipes.length) { setParsed({ error: "No recipes found in this file." }); return; }
      setParsed(result);
      pickRecipe(result, 0);
    } catch (err) {
      setParsed({ error: `Could not read this file: ${err.message}` });
    }
  };

  const pickRecipe = (result, idx) => {
    setRecipeIdx(idx);
    setMappings({});
    setNewName(result.recipes[idx].n);
  };

  const srcRecipes = parsed && !parsed.error ? parsed.recipes : null;
  const src = srcRecipes ? srcRecipes[recipeIdx] : null;
  const unmapped = useMemo(() => (src ? unmappedInRecipe(src) : []), [src]);
  const mapped = useMemo(() => (src ? applyMappings(src, mappings) : null), [src, mappings]);

  const final = mapped && (mode === "update" && recs[targetIdx]
    ? { ...mapped, n: recs[targetIdx].n }
    : { ...mapped, n: (newName || mapped.n).trim() });

  const diff = mode === "update" && final && recs[targetIdx] ? diffRecipes(recs[targetIdx], final) : null;
  const stillNew = unmapped.filter((u) => !mappings[mappingKey(u.category, u.raw)]);

  const apply = () => {
    if (!final) return;
    if (mode === "create") {
      const idx = recs.length;
      setRecs((p) => [...p, final]);
      onImported(idx);
    } else {
      setRecs((p) => p.map((r, i) => (i === targetIdx ? final : r)));
      onImported(targetIdx);
    }
  };

  return (
    <div style={{ ...card, marginBottom: 12 }}>
      <div style={{ ...hdr, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>⬆️ Import from BeerSmith</span>
        <button style={btn} onClick={onClose}>Close</button>
      </div>

      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
        <input type="file" accept=".bsmx,.xml" onChange={onFile} style={{ fontSize: 13 }} />

        {parsed?.error && <div style={{ color: "#dc2626", fontSize: 13 }}>{parsed.error}</div>}

        {src && (
          <>
            {srcRecipes.length > 1 && (
              <label style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 4 }}>
                Recipe in file ({srcRecipes.length} found)
                <select value={recipeIdx} onChange={(e) => pickRecipe(parsed, +e.target.value)} style={sel}>
                  {srcRecipes.map((r, i) => <option key={i} value={i}>{r.n} — {r.s}</option>)}
                </select>
              </label>
            )}

            {/* Target: create new or replace existing */}
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600 }}>
                <input type="radio" checked={mode === "create"} onChange={() => setMode("create")} style={{ accentColor: "#f59e0b" }} />
                Create new
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600 }}>
                <input type="radio" checked={mode === "update"} onChange={() => setMode("update")} style={{ accentColor: "#f59e0b" }} />
                Update existing
              </label>
              {mode === "create"
                ? <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New recipe name" style={{ ...inp, width: 220, textAlign: "left" }} />
                : <select value={targetIdx} onChange={(e) => setTargetIdx(+e.target.value)} style={{ ...sel, flex: 1, minWidth: 200 }}>
                    {recs.map((r, i) => <option key={i} value={i}>{r.n} — {r.s}</option>)}
                  </select>}
            </div>

            {/* Map unknown ingredients */}
            {unmapped.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e", marginBottom: 6 }}>
                  Unrecognized ingredients — map each to a catalog item, or keep as new:
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {unmapped.map((u) => {
                    const key = mappingKey(u.category, u.raw);
                    return (
                      <div key={key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                        <span style={{ flex: 1 }}><b>{u.raw}</b> <span style={{ color: "#94a3b8" }}>({u.category})</span></span>
                        <select value={mappings[key] || ""} onChange={(e) => setMappings((p) => ({ ...p, [key]: e.target.value }))} style={{ ...sel, flex: 1 }}>
                          <option value="">Keep as new</option>
                          {(CAT_NAMES[u.category] || []).map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {stillNew.length > 0 && (
              <div style={{ fontSize: 12, color: "#92400e" }}>
                {stillNew.length} ingredient{stillNew.length > 1 ? "s" : ""} will be added as new (not in your inventory catalog).
              </div>
            )}

            {/* Preview */}
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: 10, background: "#f8fafc" }}>
              {mode === "create"
                ? <CreatePreview recipe={final} />
                : <UpdatePreview diff={diff} name={recs[targetIdx]?.n} />}
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button style={btn} onClick={onClose}>Cancel</button>
              <button style={addBtn} onClick={apply}>
                {mode === "create" ? "Create Recipe" : `Update "${recs[targetIdx]?.n}"`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CreatePreview({ recipe }) {
  const summary = summarizeRecipe(recipe);
  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>
        {recipe.n} <span style={{ color: "#94a3b8", fontWeight: 400 }}>— {recipe.s}</span>
        {recipe.mt ? <span style={{ color: "#64748b", fontSize: 12, fontWeight: 400 }}> · mash {recipe.mt}°F</span> : null}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {Object.entries(FIELD_LABELS).map(([f, label]) => summary[f].length > 0 && (
          <div key={f}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>{label}</div>
            {summary[f].map((l, i) => <div key={i} style={{ fontSize: 12 }}>{l}</div>)}
          </div>
        ))}
      </div>
    </div>
  );
}

function UpdatePreview({ diff, name }) {
  if (!diff) return null;
  const changedFields = Object.entries(diff.fields).filter(([, d]) => d.added.length || d.removed.length);
  if (!changedFields.length && !diff.header.length) {
    return <div style={{ fontSize: 13, color: "#16a34a" }}>No changes — the import matches “{name}”.</div>;
  }
  return (
    <div style={{ fontSize: 13 }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Changes to “{name}”:</div>
      {diff.header.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          {diff.header.map((h, i) => (
            <div key={i} style={{ fontSize: 12 }}>{h.label}: <span style={{ color: "#dc2626" }}>{h.from ?? "—"}</span> → <span style={{ color: "#16a34a" }}>{h.to ?? "—"}</span></div>
          ))}
        </div>
      )}
      {changedFields.map(([f, d]) => (
        <div key={f} style={{ marginBottom: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>{FIELD_LABELS[f]}</span>
          {d.added.map((l, i) => <div key={`a${i}`} style={{ fontSize: 12, color: "#16a34a" }}>+ {l}</div>)}
          {d.removed.map((l, i) => <div key={`r${i}`} style={{ fontSize: 12, color: "#dc2626" }}>− {l}</div>)}
        </div>
      ))}
    </div>
  );
}
