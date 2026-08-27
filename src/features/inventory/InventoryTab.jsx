import { useMemo, useState } from "react";
import InvTable from "../../components/InvTable";
import CatalogBrowser from "../../components/CatalogBrowser";
import { inventoryValue, priceAsOf } from "../../lib/inventoryValue";
import { totalArchived, visibleInventory } from "../../lib/archive";
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
export default function InventoryTab({ malts, setMalts, hops, setHops, yeast, setYeast, adj, setAdj, setInvCost, adopt, link }) {
  // Local state, not persisted — like the Recipes sub-nav. "Show me the ones I
  // stopped buying" is a thing you do for a moment, not a preference.
  const [showArchived, setShowArchived] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const [linking, setLinking] = useState(null); // {category, item} being pointed at a product

  // ⚠️ Value is computed over the rows that are actually SHOWN, so the column
  // adds up to the total beside it — the same invariant inventoryValue.js and
  // cogs.js keep by rounding lines before summing them. Toggling therefore
  // moves the total, which is correct: it is the value of what you are looking
  // at, and the archived count below says what is missing from it.
  const shown = useMemo(() => visibleInventory({ malts, hops, yeast, adj }, showArchived),
    [malts, hops, yeast, adj, showArchived]);
  const val = useMemo(() => inventoryValue(shown), [shown]);
  const asOf = useMemo(() => priceAsOf(shown), [shown]);
  const nArchived = useMemo(() => totalArchived({ malts, hops, yeast, adj }), [malts, hops, yeast, adj]);

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
            {nArchived > 0 && !showArchived && <> · {nArchived} archived, not counted</>}
          </span>
        </div>
        <div style={{display:'flex',gap:8}}>
          {nArchived > 0 && (
            <button style={btn} onClick={()=>setShowArchived(v=>!v)}>
              {showArchived ? 'Hide archived' : `Show archived (${nArchived})`}
            </button>
          )}
          <button style={btn} onClick={()=>setBrowsing(true)}>+ Add ingredient</button>
          <button style={btn} onClick={clearAll}>Clear Inventory</button>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(430px,1fr))',gap:12}}>
        <div style={card}>
          <div style={{...hdr,display:'flex',justifyContent:'space-between'}}><span>🌾 Malts</span><CatTotal v={val.byCategory.malt}/></div>
          <InvTable items={malts} setter={setMalts} unit="lbs" category="malt" setInvCost={setInvCost} onLink={link ? (c,it)=>setLinking({category:c,item:it}) : undefined} costUnit="lb" showArchived={showArchived}/>
        </div>
        <div style={card}>
          <div style={{...hdr,display:'flex',justifyContent:'space-between'}}><span>🌿 Hops</span><CatTotal v={val.byCategory.hop}/></div>
          <InvTable items={hops} setter={setHops} unit="oz" category="hop" setInvCost={setInvCost} onLink={link ? (c,it)=>setLinking({category:c,item:it}) : undefined} costUnit="oz" showArchived={showArchived}/>
        </div>
        <div style={card}>
          <div style={{...hdr,display:'flex',justifyContent:'space-between'}}><span>🧫 Yeast</span><CatTotal v={val.byCategory.yeast}/></div>
          <InvTable items={yeast} setter={setYeast} unit="packs" category="yeast" setInvCost={setInvCost} onLink={link ? (c,it)=>setLinking({category:c,item:it}) : undefined} costUnit="pack" showArchived={showArchived}/>
        </div>
        <div style={card}>
          <div style={{...hdr,display:'flex',justifyContent:'space-between'}}><span>🧪 Adjuncts</span><CatTotal v={val.byCategory.adj}/></div>
          {/* No single unit: each adjunct carries its own (lbs/oz/ml/each), so
              the price column takes the row's rather than the table's. */}
          <InvTable items={adj} setter={setAdj} unit="" category="adj" setInvCost={setInvCost} onLink={link ? (c,it)=>setLinking({category:c,item:it}) : undefined} showArchived={showArchived}/>
        </div>
      </div>
      {/* The shelf is a counting sheet; the vendor catalog is 563 products.
          Adopting one is the only way a row gets on here, and it is where the
          name, the category and the pack size get decided. */}
      <CatalogBrowser open={browsing} inventory={{malts,hops,yeast,adj}}
        onAdopt={(category,row)=>{ adopt(category,row); setBrowsing(false); }}
        onClose={()=>setBrowsing(false)}/>

      {/* Same panel, other direction: a row that is already on the shelf being
          told which vendor product it is. Until now that link could only be
          made in code, so a hand-typed ingredient was uncostable for good. */}
      <CatalogBrowser open={!!linking} category={linking?.category} linkTo={linking?.item}
        inventory={{malts,hops,yeast,adj}}
        onLink={(category,name,fields)=>{ link(category,name,fields); setLinking(null); }}
        onClose={()=>setLinking(null)}/>
      <div style={{fontSize:12,color:'#64748b',padding:'0 2px 8px'}}>
        Value is what's on the shelf at the price beside it; an ingredient with no price is
        left out of the total rather than counted as free. Archiving one (📦) hides it here
        and keeps its price — it stays available to recipes and still counts on the Order
        Calculator, because a beer that calls for it still needs it. Editing a price here changes it for{" "}
        <strong>every</strong> recipe's cost, since prices live on the ingredient, not the
        recipe — the same field the Settings price import writes.
      </div>
    </div>
  );
}
