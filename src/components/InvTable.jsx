import { cell, num, th, inp } from "../styles";

// Update one inventory row's quantity by index.
const updInv = (setter, i, val) =>
  setter(p => p.map((it, idx) => idx === i ? { ...it, q: parseFloat(val) || 0 } : it));

// Editable inventory table for one ingredient category.
export default function InvTable({ items, setter, unit }) {
  return (
    <div style={{overflowX:'auto'}}>
      <table style={{width:'100%',borderCollapse:'collapse'}}>
        <thead><tr><th style={th}>Ingredient</th><th style={{...th,textAlign:'right'}}>On Hand ({unit})</th></tr></thead>
        <tbody>{items.map((it,i)=>(
          <tr key={i}><td style={cell}>{it.n}{it.u?<span style={{color:'#94a3b8',fontSize:11}}> ({it.u})</span>:null}</td>
          <td style={num}><input type="number" step="0.5" value={it.q} onChange={e=>updInv(setter,i,e.target.value)} style={inp}/></td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}
