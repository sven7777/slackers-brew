import { useMemo } from "react";
import { computeOrder, maltBags } from "../../lib/orderCalc";
import { card, hdr, badge, btn, cell, num, th } from "../../styles";

// Order Calculator tab: select recipes (single/double), then show how much of
// each ingredient must be ordered given current inventory.
export default function OrderTab({ orders, setOrders, recs, malts, hops, yeast, adj }) {
  const orderCalc = useMemo(
    () => computeOrder({ orders, recs, malts, hops, yeast, adj }),
    [orders, malts, hops, yeast, adj, recs]
  );

  // orders is device-local and aligned to recs by index, so it can be shorter
  // than the shared recipe list (e.g. after an import added a recipe). Read
  // through ord() and pad on write instead of crashing on a missing entry.
  const ord = (i) => orders[i] ?? {sel:false,dbl:false};
  const toggleOrd = (i,f) => setOrders(p=>recs.map((_,idx)=>{
    const o = p[idx] ?? {sel:false,dbl:false};
    return idx===i?{...o,[f]:!o[f]}:o;
  }));
  const anySel = orders.some(o=>o.sel);
  const needOrd = its => its.some(i=>i.order>0);

  return (
    <div>
      <div style={card}>
        <div style={{...hdr,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span>Select Recipes to Brew</span>
          {anySel && <button style={btn} onClick={()=>setOrders(recs.map(()=>({sel:false,dbl:false})))}>Clear All</button>}
        </div>
        <div style={{padding:8}}>
          {recs.map((r,i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'6px 8px',borderBottom:'1px solid #f1f5f9'}}>
              <input type="checkbox" checked={ord(i).sel} onChange={()=>toggleOrd(i,'sel')} style={{width:18,height:18,accentColor:'#f59e0b'}}/>
              <span style={{flex:1,fontSize:14,fontWeight:ord(i).sel?600:400}}>{r.n} <span style={{color:'#94a3b8',fontSize:12}}>({r.s})</span></span>
              {ord(i).sel && (
                <label style={{display:'flex',alignItems:'center',gap:4,fontSize:12,cursor:'pointer',background:ord(i).dbl?'#fef3c7':'#f1f5f9',padding:'3px 10px',borderRadius:12,fontWeight:600,color:ord(i).dbl?'#92400e':'#64748b'}}>
                  <input type="checkbox" checked={ord(i).dbl} onChange={()=>toggleOrd(i,'dbl')} style={{accentColor:'#f59e0b'}}/>
                  {ord(i).dbl?'Double':'Single'}
                </label>
              )}
            </div>
          ))}
        </div>
      </div>

      {anySel && (
        <div>
          <h3 style={{fontSize:16,fontWeight:700,margin:'16px 0 8px'}}>📋 Order Summary</h3>
          {orderCalc.malts.length>0 && (
            <div style={{...card,marginBottom:12}}>
              <div style={{...hdr,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span>🌾 Malts</span>
                {needOrd(orderCalc.malts)?<span style={{...badge,background:'#fef2f2',color:'#dc2626'}}>Needs Order</span>:<span style={{...badge,background:'#f0fdf4',color:'#16a34a'}}>Stocked</span>}
              </div>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr><th style={th}>Ingredient</th><th style={{...th,textAlign:'right'}}>Need (lbs)</th><th style={{...th,textAlign:'right'}}>Have (lbs)</th><th style={{...th,textAlign:'right'}}>Order (lbs)</th><th style={{...th,textAlign:'right'}}>Bags (55lb)</th></tr></thead>
                <tbody>{orderCalc.malts.map((it,i)=>{
                  const bags=maltBags(it.order);
                  return(<tr key={i} style={{background:it.order>0?'#fff7ed':'transparent'}}>
                    <td style={cell}>{it.n}</td><td style={num}>{it.need}</td><td style={num}>{it.have}</td>
                    <td style={{...num,fontWeight:it.order>0?700:400,color:it.order>0?'#ea580c':'#16a34a'}}>{it.order}</td>
                    <td style={{...num,fontWeight:bags>0?700:400,color:bags>0?'#ea580c':'#16a34a'}}>{bags}</td>
                  </tr>);
                })}</tbody>
              </table>
            </div>
          )}
          {[["🌿 Hops (oz)",orderCalc.hops,"oz"],["🧫 Yeast (packs)",orderCalc.yeast,"packs"],["🧪 Adjuncts",orderCalc.adj,""]].map(([title,items,unit],gi)=>items.length>0&&(
            <div key={gi} style={{...card,marginBottom:12}}>
              <div style={{...hdr,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span>{title}</span>
                {needOrd(items)?<span style={{...badge,background:'#fef2f2',color:'#dc2626'}}>Needs Order</span>:<span style={{...badge,background:'#f0fdf4',color:'#16a34a'}}>Stocked</span>}
              </div>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr><th style={th}>Ingredient</th><th style={{...th,textAlign:'right'}}>Need</th><th style={{...th,textAlign:'right'}}>Have</th><th style={{...th,textAlign:'right'}}>Order</th></tr></thead>
                <tbody>{items.map((it,i)=>(
                  <tr key={i} style={{background:it.order>0?'#fff7ed':'transparent'}}>
                    <td style={cell}>{it.n}</td>
                    <td style={num}>{it.need} {unit||it.u||''}</td>
                    <td style={num}>{it.have} {unit||it.u||''}</td>
                    <td style={{...num,fontWeight:it.order>0?700:400,color:it.order>0?'#ea580c':'#16a34a'}}>{it.order} {unit||it.u||''}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ))}
        </div>
      )}
      {!anySel && <p style={{textAlign:'center',color:'#94a3b8',padding:40,fontSize:14}}>Select one or more recipes above to calculate your order.</p>}
    </div>
  );
}
