import { useState } from "react";
import RecEditTable from "../../components/RecEditTable";
import { defRecipes, maltNames, hopNames, yeastNames, adjNames } from "../../lib/defaults";
import { card, hdr, btn } from "../../styles";

// Recipes tab: pick a recipe and edit its ingredient lists; reset to preset.
export default function RecipesTab({ recs, setRecs, selR, setSelR }) {
  const [addSel, setAddSel] = useState({m:'',h:'',y:'',a:''});
  const r = recs[selR];

  const resetRec = (ri) => {
    if (window.confirm(`Reset "${recs[ri].n}" to original recipe?`)) {
      setRecs(p => p.map((rec,i) => i===ri ? structuredClone(defRecipes[ri]) : rec));
    }
  };

  return (
    <div>
      <div style={{display:'flex',gap:8,marginBottom:12}}>
        <select value={selR} onChange={e=>{setSelR(+e.target.value);setAddSel({m:'',h:'',y:'',a:''});}} style={{flex:1,padding:'10px 12px',fontSize:15,fontWeight:600,borderRadius:6,border:'1px solid #cbd5e1',background:'#fff',color:'#1e293b'}}>
          {recs.map((rec,i)=><option key={i} value={i}>{rec.n} — {rec.s}</option>)}
        </select>
        <button style={{...btn,borderColor:'#fca5a5',color:'#dc2626'}} onClick={()=>resetRec(selR)}>Reset Recipe</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <div style={card}><div style={hdr}>🌾 Malts (lbs)</div>
          <RecEditTable items={r.m} cat="m" names={maltNames} unit="lbs" ri={selR} setRecs={setRecs} addSel={addSel} setAddSel={setAddSel}/>
        </div>
        <div style={card}><div style={hdr}>🌿 Hops (oz)</div>
          <RecEditTable items={r.h} cat="h" names={hopNames} unit="oz" ri={selR} setRecs={setRecs} addSel={addSel} setAddSel={setAddSel}/>
        </div>
        <div style={card}><div style={hdr}>🧫 Yeast (packs)</div>
          <RecEditTable items={r.y} cat="y" names={yeastNames} unit="packs" ri={selR} setRecs={setRecs} addSel={addSel} setAddSel={setAddSel}/>
        </div>
        <div style={card}><div style={hdr}>🧪 Adjuncts</div>
          <RecEditTable items={r.a} cat="a" names={adjNames} unit="" ri={selR} showUnit setRecs={setRecs} addSel={addSel} setAddSel={setAddSel}/>
        </div>
      </div>
    </div>
  );
}
