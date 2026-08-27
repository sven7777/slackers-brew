import { useMemo } from "react";
import InvTable from "../../components/InvTable";
import { inventoryValue, priceAsOf } from "../../lib/inventoryValue";
import { card, hdr, btn } from "../../styles";

const money = (n) => n == null ? "—" : `$${n.toFixed(2)}`;

// Subtotal shown beside a card's title. An unpriced row is left out of the sum,
// so the count of what's missing goes right next to it — a total that silently
// covered half the shelf would read as if it covered all of it.
const CatTotal = ({ v }) => (
  <span>
    {money(v.total)}
    {v.unpriced > 0 && <span style={{fontWeight:400,color:'#b45309',fontSize:12}}> · {v.unpriced} unpriced</span>}
  </span>
);

// Inventory tab: on-hand quantities and ingredient prices, side by side, with
// what the stock is worth.
//
// The price column edits the SAME value as the Recipes ▸ Cost view and the
// Settings price import: it lives on the ingredient, so a change here moves
// every recipe's COGS. The footer says so.
export default function InventoryTab({ malts, setMalts, hops, setHops, yeast, setYeast, adj, setAdj, setInvCost }) {
  const val = useMemo(() => inventoryValue({ malts, hops, yeast, adj }), [malts, hops, yeast, adj]);
  const asOf = useMemo(() => priceAsOf({ malts, hops, yeast, adj }), [malts, hops, yeast, adj]);

  // Quantities only — prices survive, since a cleared shelf is still priced.
  const clearAll = () => {
    if (window.confirm("Clear all inventory quantities? Prices are kept.")) {
      setMalts(p=>p.map(it=>({...it,q:0})));
      setHops(p=>p.map(it=>({...it,q:0})));
      setYeast(p=>p.map(it=>({...it,q:0})));
      setAdj(p=>p.map(it=>({...it,q:0})));
    }
  };
  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap',marginBottom:8}}>
        <div style={{fontSize:13,color:'#475569'}}>
          <strong style={{fontSize:16,color:'#92400e'}}>{money(val.total)}</strong> on hand
          <span style={{color:'#64748b'}}>
            {' '}— {val.priced} of {val.priced + val.unpriced} ingredients priced
            {asOf && <> · as of {asOf}</>}
          </span>
        </div>
        <button style={btn} onClick={clearAll}>Clear Inventory</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(430px,1fr))',gap:12}}>
        <div style={card}>
          <div style={{...hdr,display:'flex',justifyContent:'space-between'}}><span>🌾 Malts</span><CatTotal v={val.byCategory.malt}/></div>
          <InvTable items={malts} setter={setMalts} unit="lbs" category="malt" setInvCost={setInvCost} costUnit="lb"/>
        </div>
        <div style={card}>
          <div style={{...hdr,display:'flex',justifyContent:'space-between'}}><span>🌿 Hops</span><CatTotal v={val.byCategory.hop}/></div>
          <InvTable items={hops} setter={setHops} unit="oz" category="hop" setInvCost={setInvCost} costUnit="oz"/>
        </div>
        <div style={card}>
          <div style={{...hdr,display:'flex',justifyContent:'space-between'}}><span>🧫 Yeast</span><CatTotal v={val.byCategory.yeast}/></div>
          <InvTable items={yeast} setter={setYeast} unit="packs" category="yeast" setInvCost={setInvCost} costUnit="pack"/>
        </div>
        <div style={card}>
          <div style={{...hdr,display:'flex',justifyContent:'space-between'}}><span>🧪 Adjuncts</span><CatTotal v={val.byCategory.adj}/></div>
          {/* No single unit: each adjunct carries its own (lbs/oz/ml/each), so
              the price column takes the row's rather than the table's. */}
          <InvTable items={adj} setter={setAdj} unit="" category="adj" setInvCost={setInvCost}/>
        </div>
      </div>
      <div style={{fontSize:12,color:'#64748b',padding:'0 2px 8px'}}>
        Value is what's on the shelf at the price beside it; an ingredient with no price is
        left out of the total rather than counted as free. Editing a price here changes it for{" "}
        <strong>every</strong> recipe's cost, since prices live on the ingredient, not the
        recipe — the same field the Settings price import writes.
      </div>
    </div>
  );
}
