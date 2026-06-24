import { useState } from "react";
import RecEditTable from "../../components/RecEditTable";
import ScheduleEditTable from "../../components/ScheduleEditTable";
import ImportBeerSmith from "./ImportBeerSmith";
import { defRecipes, maltNames, hopNames, yeastNames, adjNames, saltNames } from "../../lib/defaults";
import { card, hdr, btn, inp } from "../../styles";

// Recipes tab: pick a recipe and edit its targets, mash temp, ingredient lists
// (with addition stage/time), and water salts; reset to preset; import .bsmx.
export default function RecipesTab({ recs, setRecs, selR, setSelR }) {
  const [addSel, setAddSel] = useState({ m: "", h: "", y: "", a: "", sa: "", sc: "" });
  const [importing, setImporting] = useState(false);
  const r = recs[selR];

  const resetRec = (ri) => {
    if (window.confirm(`Reset "${recs[ri].n}" to original recipe?`)) {
      setRecs((p) => p.map((rec, i) => (i === ri ? structuredClone(defRecipes[ri]) : rec)));
    }
  };

  // Update a scalar recipe field (targets / mash temp). Empty input clears it.
  const setMeta = (field, raw) => {
    const val = raw === "" ? null : parseFloat(raw);
    setRecs((p) => p.map((rec, i) => (i === selR ? { ...rec, [field]: Number.isNaN(val) ? null : val } : rec)));
  };
  const metaInput = (label, field, step) => (
    <label style={{ fontSize: 12, color: "#64748b", display: "flex", flexDirection: "column", gap: 2 }}>
      {label}
      <input type="number" step={step} value={r[field] ?? ""} placeholder="—"
        onChange={(e) => setMeta(field, e.target.value)} style={{ ...inp, width: 90 }} />
    </label>
  );

  return (
    <div>
      {importing && (
        <ImportBeerSmith
          recs={recs}
          setRecs={setRecs}
          onImported={(idx) => { setSelR(idx); setImporting(false); }}
          onClose={() => setImporting(false)}
        />
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <select value={selR} onChange={(e) => { setSelR(+e.target.value); setAddSel({ m: "", h: "", y: "", a: "", sa: "", sc: "" }); }}
          style={{ flex: 1, padding: "10px 12px", fontSize: 15, fontWeight: 600, borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", color: "#1e293b" }}>
          {recs.map((rec, i) => <option key={i} value={i}>{rec.n} — {rec.s}</option>)}
        </select>
        {!importing && <button style={{ ...btn, borderColor: "#f59e0b", color: "#92400e" }} onClick={() => setImporting(true)}>⬆️ Import .bsmx</button>}
        <button style={{ ...btn, borderColor: "#fca5a5", color: "#dc2626" }} onClick={() => resetRec(selR)}>Reset Recipe</button>
      </div>

      <div style={{ ...card, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 12 }}>
        {metaInput("Target OG", "og", 0.001)}
        {metaInput("Target FG", "fg", 0.001)}
        {metaInput("Target ABV %", "abv", 0.1)}
        {metaInput("Mash Temp °F", "mt", 1)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={card}><div style={hdr}>🌾 Malts (lbs)</div>
          <RecEditTable items={r.m} cat="m" names={maltNames} unit="lbs" ri={selR} setRecs={setRecs} addSel={addSel} setAddSel={setAddSel} />
        </div>
        <div style={card}><div style={hdr}>🌿 Hops (oz)</div>
          <RecEditTable items={r.h} cat="h" names={hopNames} unit="oz" ri={selR} setRecs={setRecs} addSel={addSel} setAddSel={setAddSel} />
        </div>
        <div style={card}><div style={hdr}>🧫 Yeast (packs)</div>
          <RecEditTable items={r.y} cat="y" names={yeastNames} unit="packs" ri={selR} setRecs={setRecs} addSel={addSel} setAddSel={setAddSel} />
        </div>
        <div style={card}><div style={hdr}>🧪 Adjuncts</div>
          <RecEditTable items={r.a} cat="a" names={adjNames} unit="" ri={selR} showUnit setRecs={setRecs} addSel={addSel} setAddSel={setAddSel} />
        </div>
      </div>

      <div style={{ ...card, marginTop: 12 }}><div style={hdr}>🧂 Water Salts (g)</div>
        <RecEditTable items={r.sa} cat="sa" names={saltNames} unit="g" ri={selR} setRecs={setRecs} addSel={addSel} setAddSel={setAddSel} />
      </div>

      <div style={{ ...card, marginTop: 12 }}><div style={hdr}>📅 Cellar Schedule (days from brew)</div>
        <ScheduleEditTable items={r.sc} ri={selR} setRecs={setRecs} addSel={addSel} setAddSel={setAddSel} />
      </div>
    </div>
  );
}
