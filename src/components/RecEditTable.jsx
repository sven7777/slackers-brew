import { adjUnits } from "../lib/defaults";
import { cell, num, th, inp, rmBtn, addRow, sel, addBtn } from "../styles";

// Set the quantity of one ingredient in a recipe category.
const updRecField = (setRecs, ri, cat, ii, val) => {
  setRecs(p => p.map((r,i) => {
    if (i!==ri) return r;
    const c = [...r[cat]];
    c[ii] = [...c[ii]];
    c[ii][1] = parseFloat(val)||0;
    return {...r, [cat]:c};
  }));
};
const rmRecItem = (setRecs, ri, cat, ii) => {
  setRecs(p => p.map((r,i) => {
    if (i!==ri) return r;
    return {...r, [cat]: r[cat].filter((_,j)=>j!==ii)};
  }));
};
const addRecItem = (setRecs, ri, cat, name, unit) => {
  if (!name) return;
  setRecs(p => p.map((r,i) => {
    if (i!==ri) return r;
    const entry = unit !== undefined ? [name, 0, unit] : [name, 0];
    return {...r, [cat]: [...r[cat], entry]};
  }));
};

// Editable ingredient table for one recipe category, with an add-ingredient row.
export default function RecEditTable({ items, cat, names, unit, ri, showUnit, setRecs, addSel, setAddSel }) {
  const used = new Set(items.map(x=>x[0]));
  const avail = names.filter(n=>!used.has(n));
  return (
    <div>
      <table style={{width:'100%',borderCollapse:'collapse'}}>
        <thead><tr><th style={th}>Ingredient</th><th style={{...th,textAlign:'right'}}>{unit}</th><th style={{...th,width:36}}></th></tr></thead>
        <tbody>{items.map((it,i)=>(
          <tr key={i}>
            <td style={cell}>{it[0]}{showUnit && it[2] ? <span style={{color:'#94a3b8',fontSize:11}}> ({it[2]})</span> : null}</td>
            <td style={num}><input type="number" step={cat==='y'?1:0.5} value={it[1]} onChange={e=>updRecField(setRecs,ri,cat,i,e.target.value)} style={inp}/></td>
            <td style={{...cell,textAlign:'center'}}><button style={rmBtn} onClick={()=>rmRecItem(setRecs,ri,cat,i)} title="Remove">×</button></td>
          </tr>
        ))}</tbody>
      </table>
      {avail.length > 0 && (
        <div style={addRow}>
          <select value={addSel[cat]} onChange={e=>setAddSel(p=>({...p,[cat]:e.target.value}))} style={sel}>
            <option value="">Add ingredient...</option>
            {avail.map(n=><option key={n} value={n}>{n}</option>)}
          </select>
          <button style={addBtn} onClick={()=>{
            const name = addSel[cat];
            if (!name) return;
            const u = cat==='a' ? (adjUnits[name]||'each') : undefined;
            addRecItem(setRecs, ri, cat, name, u);
            setAddSel(p=>({...p,[cat]:''}));
          }}>+ Add</button>
        </div>
      )}
    </div>
  );
}
