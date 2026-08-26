import { cell, num, th, inp } from "../styles";
import PriceInput from "./PriceInput";
import { rowValue } from "../lib/inventoryValue";

// Update one inventory row's quantity by index.
const updInv = (setter, i, val) =>
  setter(p => p.map((it, idx) => idx === i ? { ...it, q: parseFloat(val) || 0 } : it));

const money = (n) => n == null ? "—" : `$${n.toFixed(2)}`;

// Editable inventory table for one ingredient category: quantity on hand, the
// price per unit, and what that stock is worth.
//
// The price is the SAME field the Recipes ▸ Cost view edits and the Settings
// price import writes — it lives on the ingredient, not on a recipe — so
// `category` and `setInvCost` are wired straight through to App's one writer.
// `costUnit` is the singular unit a price is quoted in ("lb" to inventory's
// "lbs"); adjuncts have no single unit and pass none, taking each row's own.
export default function InvTable({ items, setter, unit, category, setInvCost, costUnit }) {
  return (
    <div style={{overflowX:'auto'}}>
      <table style={{width:'100%',borderCollapse:'collapse'}}>
        <thead><tr>
          <th style={th}>Ingredient</th>
          {/* Adjuncts have no table-wide unit (each row carries its own), so the
              header drops the parens rather than printing an empty pair. */}
          <th style={{...th,textAlign:'right'}}>On Hand{unit ? ` (${unit})` : ''}</th>
          <th style={{...th,textAlign:'right'}}>Cost / {costUnit || 'unit'}</th>
          <th style={{...th,textAlign:'right'}}>Value</th>
        </tr></thead>
        <tbody>{items.map((it,i)=>{
          const u = costUnit || it.u || 'unit';
          const val = rowValue(it);
          return (
          <tr key={i} style={Number.isFinite(it.cpu) ? null : {background:'#fffbeb'}}>
            <td style={cell}>{it.n}{it.u?<span style={{color:'#94a3b8',fontSize:11}}> ({it.u})</span>:null}</td>
            <td style={num}><input type="number" step="0.5" value={it.q} onChange={e=>updInv(setter,i,e.target.value)} style={inp} aria-label={`On hand, ${it.n}`}/></td>
            <td style={num}><PriceInput value={it.cpu} onCommit={v=>setInvCost(category, it.n, v, it.u)} style={{width:80}} aria-label={`Cost per ${u} of ${it.n}`}/></td>
            <td style={{...num,fontWeight:600}}>{val == null ? <span style={{color:'#b45309'}}>unpriced</span> : money(val)}</td>
          </tr>
        );})}</tbody>
      </table>
    </div>
  );
}
