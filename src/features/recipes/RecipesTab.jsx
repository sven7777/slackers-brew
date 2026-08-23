import { useState, useEffect, useMemo } from "react";
import RecEditTable from "../../components/RecEditTable";
import ScheduleEditTable from "../../components/ScheduleEditTable";
import ImportBeerSmith from "./ImportBeerSmith";
import BrewSheetPanel from "./BrewSheetPanel";
import CellarPanel from "./CellarPanel";
import CostPanel from "./CostPanel";
import StyleSelect from "../../components/StyleSelect";
import { defRecipes, maltNames, hopNames, yeastNames, adjNames, saltNames } from "../../lib/defaults";
import { sortedWithIndex } from "../../lib/sortNames";
import { card, hdr, btn, inp } from "../../styles";

// Sub-views of the Recipes tab, all driven by the one recipe dropdown below.
const SUBVIEWS = [
  { key: "edit", label: "Edit" },
  { key: "brew", label: "Brew Sheet" },
  { key: "cellar", label: "Cellar Sheet" },
  { key: "cost", label: "Cost" },
];
const segWrap = { display: "flex", gap: 4, padding: 4, background: "#f1f5f9", borderRadius: 8, marginBottom: 12 };
const segBtn = (active) => ({
  flex: 1, padding: "8px 12px", fontSize: 13, border: "none", cursor: "pointer", borderRadius: 6,
  fontWeight: active ? 700 : 500,
  background: active ? "#fff" : "transparent",
  color: active ? "#92400e" : "#64748b",
  boxShadow: active ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
});

// Recipes tab: pick a recipe once, then switch between editing it (targets, mash
// temp, ingredient lists with stage/time, water salts, cellar schedule), its
// printable Brew Sheet, and its printable Cellar Sheet. Reset to preset / import
// .bsmx live in the Edit view.
export default function RecipesTab({ recs, setRecs, selR, setSelR, malts, hops, yeast, adj, setInvCost, settings }) {
  const [addSel, setAddSel] = useState({ m: "", h: "", y: "", a: "", sa: "", sc: "" });
  const [importing, setImporting] = useState(false);
  const [view, setView] = useState("edit");
  const [costDbl, setCostDbl] = useState(false);
  const r = recs[selR];

  // The picker reads alphabetically; `selR` still indexes the stored list, so
  // each option carries the position it came from rather than its rank here.
  const picker = useMemo(() => sortedWithIndex(recs, (rec) => rec?.n?.trim() || ""), [recs]);

  // selR is device-local while recs is shared, so a stale index can point past
  // the list (e.g. the recipe list shrank, or shared data hasn't loaded yet).
  // Render nothing for that frame and snap the selection back to the first
  // recipe instead of crashing on r.og below.
  useEffect(() => {
    if (!r && recs.length) setSelR(0);
  }, [r, recs.length, setSelR]);
  if (!r) return null;

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
  // Name and style are free text, not numbers. Style especially: BeerSmith's own
  // names ("Belgian Dark Strong Ale") are what the brewer expects to read back,
  // and a fixed dropdown would just be a second catalog to maintain.
  const setText = (field, raw) =>
    setRecs((p) => p.map((rec, i) => (i === selR ? { ...rec, [field]: raw } : rec)));
  const labeledField = (label, control, htmlFor) => (
    <div style={{ fontSize: 12, color: "#64748b", display: "flex", flexDirection: "column", gap: 2, flex: "1 1 200px" }}>
      <label htmlFor={htmlFor}>{label}</label>
      {control}
    </div>
  );
  const textInput = (label, field, placeholder) => (
    <label style={{ fontSize: 12, color: "#64748b", display: "flex", flexDirection: "column", gap: 2, flex: "1 1 200px" }}>
      {label}
      <input type="text" value={r[field] ?? ""} placeholder={placeholder}
        onChange={(e) => setText(field, e.target.value)}
        style={{ ...inp, width: "100%", boxSizing: "border-box", textAlign: "left" }} />
    </label>
  );
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
          {/* The name is editable now, so it can be empty mid-edit. An option that
              renders as bare " — " is unpickable, so label it instead. */}
          {picker.map(({ item: rec, index: i }) => <option key={i} value={i}>{rec.n?.trim() || "(untitled)"} — {rec.s}</option>)}
        </select>
        {view === "edit" && !importing && <button style={{ ...btn, borderColor: "#f59e0b", color: "#92400e" }} onClick={() => setImporting(true)}>⬆️ Import .bsmx</button>}
        {view === "edit" && <button style={{ ...btn, borderColor: "#fca5a5", color: "#dc2626" }} onClick={() => resetRec(selR)}>Reset Recipe</button>}
      </div>

      <div style={segWrap}>
        {SUBVIEWS.map((v) => (
          <button key={v.key} style={segBtn(view === v.key)} onClick={() => setView(v.key)}>{v.label}</button>
        ))}
      </div>

      {view === "brew" && <BrewSheetPanel recipe={r} ri={selR} setRecs={setRecs} />}
      {view === "cellar" && <CellarPanel recipe={r} />}
      {view === "cost" && (
        <CostPanel recipe={r} ri={selR} setRecs={setRecs} dbl={costDbl} setDbl={setCostDbl}
          malts={malts} hops={hops} yeast={yeast} adj={adj}
          setInvCost={setInvCost} settings={settings} />
      )}

      {view === "edit" && <>
        {/* Two rows on purpose: the free-text identity fields want the width,
            the five numbers are fixed and narrow. One flex row wrapped them
            unevenly and left Ferm Temp stranded on a line of its own. */}
        <div style={{ ...card, padding: 12, marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 12 }}>
            {textInput("Name", "n", "Recipe name")}
            {labeledField("Style", <StyleSelect id="recipe-style" value={r.s} onChange={(v) => setText("s", v)} />, "recipe-style")}
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
            {metaInput("Target OG", "og", 0.001)}
            {metaInput("Target FG", "fg", 0.001)}
            {metaInput("Target ABV %", "abv", 0.1)}
            {metaInput("Mash Temp °F", "mt", 1)}
            {metaInput("Ferm Temp °F", "ft", 1)}
          </div>
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
      </>}
    </div>
  );
}
