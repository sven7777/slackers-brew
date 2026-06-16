import InvTable from "../../components/InvTable";
import { card, hdr, btn } from "../../styles";

// Inventory tab: editable on-hand quantities for each ingredient category.
export default function InventoryTab({ malts, setMalts, hops, setHops, yeast, setYeast, adj, setAdj }) {
  const clearAll = () => {
    if (window.confirm("Clear all inventory quantities?")) {
      setMalts(p=>p.map(it=>({...it,q:0})));
      setHops(p=>p.map(it=>({...it,q:0})));
      setYeast(p=>p.map(it=>({...it,q:0})));
      setAdj(p=>p.map(it=>({...it,q:0})));
    }
  };
  return (
    <div>
      <div style={{display:'flex',justifyContent:'flex-end',marginBottom:8}}>
        <button style={btn} onClick={clearAll}>Clear Inventory</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <div style={card}><div style={hdr}>🌾 Malts</div><InvTable items={malts} setter={setMalts} unit="lbs"/></div>
        <div style={card}><div style={hdr}>🌿 Hops</div><InvTable items={hops} setter={setHops} unit="oz"/></div>
        <div style={card}><div style={hdr}>🧫 Yeast</div><InvTable items={yeast} setter={setYeast} unit="packs"/></div>
        <div style={card}><div style={hdr}>🧪 Adjuncts</div><InvTable items={adj} setter={setAdj} unit=""/></div>
      </div>
    </div>
  );
}
