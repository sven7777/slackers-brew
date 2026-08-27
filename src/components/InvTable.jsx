import { cell, num, th, inp } from "../styles";
import PriceInput from "./PriceInput";
import { rowValue } from "../lib/inventoryValue";
import { isArchived } from "../lib/archive";
import { isLinkable, productSku } from "../lib/adopt";

// Update one inventory row's quantity by index.
const updInv = (setter, i, val) =>
  setter(p => p.map((it, idx) => idx === i ? { ...it, q: parseFloat(val) || 0 } : it));

// Archive or restore one row. The row keeps its quantity and its price — the
// flag only decides whether the shelf lists it.
const setArchived = (setter, i, archived) =>
  setter(p => p.map((it, idx) => idx !== i ? it : { ...it, archived }));

const money = (n) => n == null ? "—" : `$${n.toFixed(2)}`;

// ⚠️ NOT a red "×". That glyph already means permanent removal in this app —
// it's `rmBtn`, which deletes a recipe ingredient — and archiving is the
// opposite promise: the row and, more to the point, its price both survive.
// Reusing the delete icon for it would either scare a brewer off a harmless
// button or have them expect the row to disappear for good.
// Faint by default: this column is an affordance, not data, and a stack of 55
// full-strength icons pulls the eye off the quantities the screen exists for.
// The restore arrow on an archived row is not dimmed — there are only ever a
// few, and that one you are looking for.
const iconBtn = {
  border: '1px solid #e2e8f0', background: '#fff', borderRadius: 6, cursor: 'pointer',
  color: '#94a3b8', fontSize: 12, lineHeight: 1, padding: '3px 6px',
};
const archiveBtn = { ...iconBtn, opacity: 0.4 };

// Reads as the value it sets, not as a command: an unlinked row says "Link…",
// a linked one shows the SKU an import will price it by.
const linkBtn = {
  border: '1px solid #e2e8f0', background: '#fff', borderRadius: 6, cursor: 'pointer',
  color: '#64748b', fontSize: 11, lineHeight: 1, padding: '3px 7px', fontFamily: 'inherit',
};

// Editable inventory table for one ingredient category: quantity on hand, the
// price per unit, and what that stock is worth.
//
// The price is the SAME field the Recipes ▸ Cost view edits and the Settings
// price import writes — it lives on the ingredient, not on a recipe — so
// `category` and `setInvCost` are wired straight through to App's one writer.
// `costUnit` is the singular unit a price is quoted in ("lb" to inventory's
// "lbs"); adjuncts have no single unit and pass none, taking each row's own.
export default function InvTable({ items, setter, unit, category, setInvCost, costUnit, showArchived = false, onLink }) {
  // ⚠️ Pair each row with its index in the STORED array before filtering, and
  // address every edit by that index — exactly the rule the alphabetical sorts
  // keep (see sortNames.js `sortedWithIndex`). Filtering first and using the
  // position on screen would write the wrong row the moment anything is hidden.
  const rows = items
    .map((it, index) => ({ it, index }))
    .filter(({ it }) => showArchived || !isArchived(it));

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
          {/* Which vendor product this ingredient IS. It has always been stored
              and never shown, so a row pointing at nothing — and therefore
              costed at nothing forever — was invisible. */}
          {onLink && <th style={th}>Product</th>}
          <th style={{...th,width:32}} aria-label="Archive"></th>
        </tr></thead>
        <tbody>{rows.map(({it,index})=>{
          const u = costUnit || it.u || 'unit';
          const val = rowValue(it);
          const archived = isArchived(it);
          const sku = productSku(category, it);
          return (
          <tr key={index} style={archived ? {background:'#f8fafc',color:'#94a3b8'}
                                          : Number.isFinite(it.cpu) ? null : {background:'#fffbeb'}}>
            <td style={cell}>
              {it.n}{it.u?<span style={{color:'#94a3b8',fontSize:11}}> ({it.u})</span>:null}
              {archived && <span style={{color:'#94a3b8',fontSize:11,fontStyle:'italic'}}> · archived</span>}
            </td>
            <td style={num}><input type="number" step="0.5" value={it.q} onChange={e=>updInv(setter,index,e.target.value)} style={inp} aria-label={`On hand, ${it.n}`}/></td>
            <td style={num}><PriceInput value={it.cpu} onCommit={v=>setInvCost(category, it.n, v, it.u)} style={{width:80}} aria-label={`Cost per ${u} of ${it.n}`}/></td>
            <td style={{...num,fontWeight:600}}>{val == null ? <span style={{color:'#b45309'}}>unpriced</span> : money(val)}</td>
            {onLink && <td style={cell}>{
              // A button only where the row's own SKU is what decides — the
              // curated map in products.js wins everywhere else, so offering to
              // change those would be offering something that does nothing.
              isLinkable(category, it)
                ? <button type="button" style={linkBtn} onClick={()=>onLink(category, it)}
                    title={`Say which vendor product ${it.n} is`}>
                    {sku ? sku : 'Link…'}
                  </button>
                : <span style={{color:'#94a3b8',fontSize:11}}>{sku || '—'}</span>
            }</td>}
            <td style={{...cell,textAlign:'right'}}>
              <button type="button" style={archived ? iconBtn : archiveBtn}
                onClick={()=>setArchived(setter,index,!archived)}
                title={archived ? `Restore ${it.n} to the shelf` : `Archive ${it.n} — keeps its price`}
                aria-label={archived ? `Restore ${it.n}` : `Archive ${it.n}`}>
                {archived ? '↩' : '📦'}
              </button>
            </td>
          </tr>
        );})}</tbody>
      </table>
    </div>
  );
}
