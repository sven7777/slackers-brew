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

// Inventory sits two cards to a 900px page, so each of these tables gets ~442px
// for five columns, two of which hold fixed-width inputs. That is the whole
// width budget, and the Adjuncts table was 7px over it before today — enough to
// clip the archive button off the right edge. 2px off each side of every cell
// buys 20px back and is imperceptible.
const c = { ...cell, padding: '6px 8px' };
const n = { ...num, padding: '6px 8px' };
const h = { ...th, padding: '6px 8px' };

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

// A row that needs an answer asks for one: "Link…", in words, because nothing
// else on screen says this ingredient is priced by nothing.
//
// ⚠️ Once it HAS an answer the words go away. Printing the resolved SKU here
// turned every linked and every adopted row into a permanent `AZZZ1771` button
// sitting in the name cell — a vendor's internal code, shown as a control, in
// the one column a brewer scans for ingredient names. The SKU is an attribute
// of the row, not a thing to read off the shelf; it belongs in the tooltip,
// exactly where a `defaultProductMap` row has always carried it. What stays is
// the faint chain, in the archive button's idiom: an affordance, not data, so a
// link pointed at the wrong product is still fixable without reading as a
// column of codes.
const linkBtn = {
  border: '1px solid #e2e8f0', background: '#fff', borderRadius: 6, cursor: 'pointer',
  color: '#64748b', fontSize: 11, lineHeight: 1, padding: '3px 7px', fontFamily: 'inherit',
};
const relinkBtn = { ...linkBtn, opacity: 0.4, padding: '3px 5px' };

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
          <th style={h}>Ingredient</th>
          {/* Adjuncts have no table-wide unit (each row carries its own), so the
              header drops the parens rather than printing an empty pair. */}
          <th style={{...h,textAlign:'right'}}>On Hand{unit ? ` (${unit})` : ''}</th>
          <th style={{...h,textAlign:'right'}}>Cost / {costUnit || 'unit'}</th>
          <th style={{...h,textAlign:'right'}}>Value</th>
          <th style={{...h,width:32}} aria-label="Archive"></th>
        </tr></thead>
        <tbody>{rows.map(({it,index})=>{
          const u = costUnit || it.u || 'unit';
          const val = rowValue(it);
          const archived = isArchived(it);
          const sku = productSku(category, it);
          return (
          <tr key={index} style={archived ? {background:'#f8fafc',color:'#94a3b8'}
                                          : Number.isFinite(it.cpu) ? null : {background:'#fffbeb'}}>
            {/* ⚠️ The product goes in the NAME cell and only where there is
                something to do about it. Two earlier tries were both wrong on
                screen: a column of its own pushed these tables from 442px to
                ~525 and shoved the archive button off the right edge (two cards
                on a 900px page is the whole width budget), and printing the SKU
                beside every name wrapped 53 of 55 rows onto two lines and broke
                `HOP-CAS` across the line break. So a row that HAS its product
                — mapped in code, adopted, or linked — shows exactly what it
                always showed and carries the SKU in the tooltip; the words are
                spent only on a row that still has no product at all. */}
            <td style={c} title={sku ? `Priced as ${sku}` : undefined}>
              {it.n}{it.u?<span style={{color:'#94a3b8',fontSize:11}}> ({it.u})</span>:null}
              {archived && <span style={{color:'#94a3b8',fontSize:11,fontStyle:'italic'}}> · archived</span>}
              {onLink && isLinkable(category, it) && (
                <> <button type="button" style={sku ? relinkBtn : linkBtn} onClick={()=>onLink(category, it)}
                     title={sku ? `Priced as ${sku} — change which product ${it.n} is`
                                : `Say which vendor product ${it.n} is`}
                     aria-label={sku ? `Change the vendor product for ${it.n}` : `Link ${it.n} to a vendor product`}>
                     {sku ? '🔗' : 'Link…'}</button></>
              )}
            </td>
            <td style={n}><input type="number" step="0.5" value={it.q} onChange={e=>updInv(setter,index,e.target.value)} style={inp} aria-label={`On hand, ${it.n}`}/></td>
            <td style={n}><PriceInput value={it.cpu} onCommit={v=>setInvCost(category, it.n, v, it.u)} style={{width:80}} aria-label={`Cost per ${u} of ${it.n}`}/></td>
            <td style={{...n,fontWeight:600}}>{val == null ? <span style={{color:'#b45309'}}>unpriced</span> : money(val)}</td>
            <td style={{...c,textAlign:'right'}}>
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
