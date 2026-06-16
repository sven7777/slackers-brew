import { useState, useMemo, useEffect } from "react";

const defMalts = [
  ["Pils",0],["2-Row",0],["Maris Otter",0],["Caramunich I",0],
  ["Carafoam",0],["Chocolate",0],["Black Patent",0],["Roasted Barley",0],
  ["White Wheat",0],["Aromatic",0],["Flaked Wheat",0],["Flaked Corn",0],
  ["Vienna",0],["Munich",0],["Carafe III",0],["Biscuit Malt",0],
  ["Crystal 80",0],["Flaked Oat",0],["Midnight Wheat",0]
];
const defHops = [
  ["Pink Boots 2025",0],["Saaz",0],["CTZ",0],["Willamette",0],
  ["Amarillo",0],["Simcoe",0],["Crystal",0],["Chinook",0],
  ["Cascade",0],["Mosaic",0],["Centennial",0],["Citra",0],
  ["Idaho 7",0],["Lemondrop",0]
];
const defYeast = [
  ["K97",0],["BE-134",0],["S-04",0],["US-05",0],
  ["WB-06",0],["BE-256",0],["KVEIK VOSS",0],["DA-16",0]
];
const defAdj = [
  ["Candi Syrup",0,"lbs"],["Lactose",0,"lbs"],["Ghost Peppers",0,"each"],
  ["Straw/Rhubarb",0,"oz"],["Orange Peel",0,"oz"],["Coffee",0,"lbs"],
  ["Honey",0,"lbs"],["Lemon",0,"oz"],["Coriander",0,"oz"],["Mango Puree",0,"lbs"],
  ["Clarity Ferm",0,"ml"],["Brewzyme D",0,"ml"]
];

const defRecipes = [
  {n:"All Y'alls",s:"NEIPA",m:[["2-Row",185],["White Wheat",55],["Flaked Wheat",35],["Flaked Oat",15]],h:[["Cascade",84],["Amarillo",40],["Chinook",8],["Mosaic",48],["Simcoe",16]],y:[["K97",1]],a:[]},
  {n:"Beachcomber",s:"Belgian Blond",m:[["Pils",110],["White Wheat",55],["Vienna",15],["Flaked Wheat",15],["Carafoam",10]],h:[["Amarillo",15],["Crystal",8]],y:[["BE-134",1]],a:[["Candi Syrup",5,"lbs"]]},
  {n:"Coffee Snout",s:"Baltic Porter",m:[["Maris Otter",165],["2-Row",110],["Munich",40],["Caramunich I",15],["Chocolate",12],["Roasted Barley",8],["Carafoam",5]],h:[["CTZ",12],["Willamette",12]],y:[["S-04",1]],a:[["Coffee",5,"lbs"]]},
  {n:"Hefelump",s:"Weissbier",m:[["Pils",110],["White Wheat",110],["Caramunich I",15],["Carafoam",10],["Vienna",10]],h:[["Saaz",20]],y:[["WB-06",1]],a:[["Orange Peel",3,"oz"]]},
  {n:"James",s:"American Brown",m:[["2-Row",110],["Maris Otter",110],["Caramunich I",35],["Chocolate",15],["Carafoam",10]],h:[["CTZ",10],["Willamette",4]],y:[["S-04",1]],a:[["Clarity Ferm",125,"ml"]]},
  {n:"Leder Jörtsen",s:"Festbier",m:[["Munich",110],["Pils",110],["Vienna",15],["Carafoam",10],["Caramunich I",10]],h:[["Amarillo",18],["Saaz",18]],y:[["K97",1]],a:[["Clarity Ferm",125,"ml"]]},
  {n:"Mango Unchained",s:"Double IPA",m:[["2-Row",330],["Flaked Wheat",20],["Carafoam",20],["Caramunich I",20]],h:[["CTZ",36],["Cascade",70],["Amarillo",60]],y:[["K97",1]],a:[["Lactose",15,"lbs"],["Mango Puree",18,"lbs"]]},
  {n:"Night Jörts",s:"Czech Dark Lager",m:[["Pils",185],["Carafe III",15],["Carafoam",8],["Caramunich I",8]],h:[["Centennial",22]],y:[["K97",1]],a:[["Clarity Ferm",125,"ml"]]},
  {n:"Pinkety Drinkety",s:"Cream Ale",m:[["Pils",165],["Flaked Corn",20],["Carafoam",5]],h:[["CTZ",5],["Saaz",5]],y:[["K97",10]],a:[["Straw/Rhubarb",62,"oz"],["Clarity Ferm",125,"ml"]]},
  {n:"Red Panda",s:"Belgian Tripel",m:[["Pils",300],["Caramunich I",20],["Aromatic",15],["Carafoam",12],["Roasted Barley",2]],h:[["CTZ",14],["Saaz",8]],y:[["BE-256",1]],a:[["Honey",18,"lbs"]]},
  {n:"Scarlett",s:"Red IPA",m:[["2-Row",110],["Maris Otter",110],["Munich",55],["Caramunich I",30],["Roasted Barley",4]],h:[["Chinook",18],["Centennial",60],["Cascade",54]],y:[["DA-16",1]],a:[]},
  {n:"Sheriff Bart IPA",s:"Black IPA",m:[["2-Row",275],["Caramunich I",22],["Midnight Wheat",22],["Chocolate",5]],h:[["CTZ",76],["Chinook",16],["Cascade",32]],y:[["US-05",1]],a:[]},
  {n:"Shortea Jörts",s:"Kölsch",m:[["Pils",165],["Vienna",15],["Carafoam",5]],h:[["Citra",14]],y:[["K97",1]],a:[["Lemon",32,"oz"],["Clarity Ferm",125,"ml"]]},
  {n:"Situation IPA",s:"American IPA",m:[["2-Row",235],["Caramunich I",30],["White Wheat",20],["Carafoam",15],["Aromatic",10],["Roasted Barley",1]],h:[["Chinook",27],["CTZ",20],["Cascade",8],["Amarillo",24],["Centennial",48]],y:[["K97",1]],a:[["Clarity Ferm",125,"ml"]]},
  {n:"Spruced Up",s:"American Pale Ale",m:[["2-Row",110],["Pils",110],["Caramunich I",25],["Carafoam",10],["Aromatic",8]],h:[["CTZ",12],["Cascade",104]],y:[["K97",1]],a:[["Clarity Ferm",125,"ml"]]},
  {n:"Stretchy Jörts",s:"Kölsch",m:[["Pils",165],["Vienna",20],["Carafoam",5]],h:[["Saaz",26]],y:[["K97",1]],a:[["Clarity Ferm",125,"ml"]]},
  {n:"Wicked Tickle",s:"American Porter",m:[["2-Row",110],["Maris Otter",110],["Caramunich I",55],["Black Patent",12],["Chocolate",10],["Carafoam",8],["Roasted Barley",8]],h:[["CTZ",14],["Willamette",16]],y:[["S-04",1]],a:[["Lactose",5,"lbs"],["Ghost Peppers",1,"each"]]},
  {n:"Wit's End",s:"Witbier",m:[["Pils",220],["White Wheat",55],["Flaked Wheat",22],["Carafoam",10]],h:[["CTZ",4],["Cascade",84],["Amarillo",76]],y:[["BE-256",1]],a:[["Coriander",1,"oz"],["Orange Peel",1,"oz"]]},
];

const SK = "slackers_brew_";
function load(k, fb) { try { const r = localStorage.getItem(SK+k); return r ? JSON.parse(r) : fb; } catch { return fb; } }
function save(k, v) { try { localStorage.setItem(SK+k, JSON.stringify(v)); } catch {} }

const tabNames = ["Inventory", "Recipes", "Order Calculator"];
const maltNames = defMalts.map(m=>m[0]);
const hopNames = defHops.map(h=>h[0]);
const yeastNames = defYeast.map(y=>y[0]);
const adjNames = defAdj.map(a=>a[0]);
const adjUnits = Object.fromEntries(defAdj.map(([n,,u])=>[n,u]));

// Styles at module level so component references are stable across renders
const cell = {padding:'6px 10px',borderBottom:'1px solid #e2e8f0',textAlign:'left',fontSize:13};
const num = {...cell,textAlign:'right'};
const inp = {width:70,padding:'4px 6px',border:'1px solid #cbd5e1',borderRadius:4,textAlign:'right',fontSize:13,background:'#fff',color:'#1e293b'};
const th = {...cell,fontWeight:600,fontSize:12,textTransform:'uppercase',color:'#64748b',letterSpacing:'0.05em',position:'sticky',top:0,background:'#f8fafc',zIndex:1};
const card = {background:'#fff',borderRadius:8,border:'1px solid #e2e8f0',overflow:'hidden',marginBottom:16};
const hdr = {padding:'10px 14px',background:'#f1f5f9',fontWeight:600,fontSize:14,borderBottom:'1px solid #e2e8f0'};
const badge = {display:'inline-block',padding:'2px 8px',borderRadius:10,fontSize:12,fontWeight:600};
const btn = {padding:'6px 14px',fontSize:12,border:'1px solid #e2e8f0',borderRadius:6,background:'#fff',cursor:'pointer',color:'#64748b',fontWeight:500};
const rmBtn = {background:'none',border:'none',cursor:'pointer',color:'#ef4444',fontSize:16,padding:'0 4px',lineHeight:1};
const addRow = {display:'flex',gap:6,padding:'6px 10px',alignItems:'center',borderTop:'1px solid #e2e8f0'};
const sel = {flex:1,padding:'4px 6px',fontSize:13,border:'1px solid #cbd5e1',borderRadius:4,background:'#fff',color:'#1e293b'};
const addBtn = {padding:'4px 12px',fontSize:12,border:'1px solid #f59e0b',borderRadius:4,background:'#fef3c7',cursor:'pointer',color:'#92400e',fontWeight:600};
const tabBtn = a=>({padding:'10px 20px',border:'none',borderBottom:a?'3px solid #f59e0b':'3px solid transparent',background:'none',cursor:'pointer',fontWeight:a?700:500,fontSize:14,color:a?'#f59e0b':'#475569',transition:'all 0.15s'});

const updInv = (setter, i, val) => setter(p => p.map((it,idx) => idx===i ? {...it,q:parseFloat(val)||0} : it));

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

function InvTable({items, setter, unit}) {
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

function RecEditTable({items, cat, names, unit, ri, showUnit, setRecs, addSel, setAddSel}) {
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

export default function App() {
  const [tab, setTab] = useState(()=>load("tab",0));
  const [malts, setMalts] = useState(()=>load("malts",defMalts.map(([n,q])=>({n,q}))));
  const [hops, setHops] = useState(()=>load("hops",defHops.map(([n,q])=>({n,q}))));
  const [yeast, setYeast] = useState(()=>load("yeast",defYeast.map(([n,q])=>({n,q}))));
  const [adj, setAdj] = useState(()=>load("adj",defAdj.map(([n,q,u])=>({n,q,u}))));
  const [selR, setSelR] = useState(()=>load("selR",0));
  const [orders, setOrders] = useState(()=>load("orders",defRecipes.map(()=>({sel:false,dbl:false}))));
  const [recs, setRecs] = useState(()=>load("recipes",JSON.parse(JSON.stringify(defRecipes))));

  useEffect(()=>{save("tab",tab)},[tab]);
  useEffect(()=>{save("malts",malts)},[malts]);
  useEffect(()=>{save("hops",hops)},[hops]);
  useEffect(()=>{save("yeast",yeast)},[yeast]);
  useEffect(()=>{save("adj",adj)},[adj]);
  useEffect(()=>{save("selR",selR)},[selR]);
  useEffect(()=>{save("orders",orders)},[orders]);
  useEffect(()=>{save("recipes",recs)},[recs]);

  const toggleOrd = (i,f) => setOrders(p=>p.map((o,idx)=>idx===i?{...o,[f]:!o[f]}:o));

  const resetRec = (ri) => {
    if (window.confirm(`Reset "${recs[ri].n}" to original recipe?`)) {
      setRecs(p => p.map((r,i) => i===ri ? JSON.parse(JSON.stringify(defRecipes[ri])) : r));
    }
  };

  const orderCalc = useMemo(() => {
    const need = {malts:{},hops:{},yeast:{},adj:{}};
    orders.forEach((o,i) => {
      if (!o.sel) return;
      const mult = o.dbl?2:1, r = recs[i];
      r.m.forEach(([n,q])=>{need.malts[n]=(need.malts[n]||0)+q*mult;});
      r.h.forEach(([n,q])=>{need.hops[n]=(need.hops[n]||0)+q*mult;});
      r.y.forEach(([n,q])=>{need.yeast[n]=(need.yeast[n]||0)+q*mult;});
      r.a.forEach(([n,q])=>{need.adj[n]=(need.adj[n]||0)+q*mult;});
    });
    const inv = {malts:{},hops:{},yeast:{},adj:{}};
    malts.forEach(i=>inv.malts[i.n]=i.q);
    hops.forEach(i=>inv.hops[i.n]=i.q);
    yeast.forEach(i=>inv.yeast[i.n]=i.q);
    adj.forEach(i=>inv.adj[i.n]=i.q);
    const res = {malts:[],hops:[],yeast:[],adj:[]};
    Object.entries(need.malts).forEach(([n,q])=>{const h=inv.malts[n]||0;res.malts.push({n,need:q,have:h,order:Math.max(0,q-h)});});
    Object.entries(need.hops).forEach(([n,q])=>{const h=inv.hops[n]||0;res.hops.push({n,need:q,have:h,order:Math.max(0,q-h)});});
    Object.entries(need.yeast).forEach(([n,q])=>{const h=inv.yeast[n]||0;res.yeast.push({n,need:q,have:h,order:Math.max(0,q-h)});});
    Object.entries(need.adj).forEach(([n,q])=>{const h=inv.adj[n]||0;const u=adj.find(a=>a.n===n)?.u||'';res.adj.push({n,need:q,have:h,order:Math.max(0,q-h),u});});
    return res;
  }, [orders, malts, hops, yeast, adj, recs]);

  const r = recs[selR];
  const anySel = orders.some(o=>o.sel);
  const needOrd = its => its.some(i=>i.order>0);

  const [addSel, setAddSel] = useState({m:'',h:'',y:'',a:''});

  return (
    <div style={{fontFamily:'-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif',color:'#1e293b',maxWidth:900,margin:'0 auto',padding:'0 16px'}}>
      <div style={{textAlign:'center',padding:'16px 0 8px'}}>
        <h1 style={{margin:0,fontSize:22,fontWeight:800,color:'#f59e0b'}}>🍺 Slackers Brewing</h1>
        <p style={{margin:'2px 0 0',fontSize:13,color:'#64748b'}}>Inventory & Order Manager</p>
      </div>
      <div style={{display:'flex',justifyContent:'center',borderBottom:'1px solid #e2e8f0',marginBottom:16}}>
        {tabNames.map((t,i)=><button key={i} style={tabBtn(tab===i)} onClick={()=>setTab(i)}>{t}</button>)}
      </div>

      {tab===0 && (
        <div>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:8}}>
            <button style={btn} onClick={()=>{if(window.confirm("Clear all inventory quantities?")){setMalts(p=>p.map(it=>({...it,q:0})));setHops(p=>p.map(it=>({...it,q:0})));setYeast(p=>p.map(it=>({...it,q:0})));setAdj(p=>p.map(it=>({...it,q:0})));}}}>Clear Inventory</button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div style={card}><div style={hdr}>🌾 Malts</div><InvTable items={malts} setter={setMalts} unit="lbs"/></div>
            <div style={card}><div style={hdr}>🌿 Hops</div><InvTable items={hops} setter={setHops} unit="oz"/></div>
            <div style={card}><div style={hdr}>🧫 Yeast</div><InvTable items={yeast} setter={setYeast} unit="packs"/></div>
            <div style={card}><div style={hdr}>🧪 Adjuncts</div><InvTable items={adj} setter={setAdj} unit=""/></div>
          </div>
        </div>
      )}

      {tab===1 && (
        <div>
          <div style={{display:'flex',gap:8,marginBottom:12}}>
            <select value={selR} onChange={e=>{setSelR(+e.target.value);setAddSel({m:'',h:'',y:'',a:''});}} style={{flex:1,padding:'10px 12px',fontSize:15,fontWeight:600,borderRadius:6,border:'1px solid #cbd5e1',background:'#fff',color:'#1e293b'}}>
              {recs.map((r,i)=><option key={i} value={i}>{r.n} — {r.s}</option>)}
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
      )}

      {tab===2 && (
        <div>
          <div style={card}>
            <div style={{...hdr,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span>Select Recipes to Brew</span>
              {anySel && <button style={btn} onClick={()=>setOrders(recs.map(()=>({sel:false,dbl:false})))}>Clear All</button>}
            </div>
            <div style={{padding:8}}>
              {recs.map((r,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'6px 8px',borderBottom:'1px solid #f1f5f9'}}>
                  <input type="checkbox" checked={orders[i].sel} onChange={()=>toggleOrd(i,'sel')} style={{width:18,height:18,accentColor:'#f59e0b'}}/>
                  <span style={{flex:1,fontSize:14,fontWeight:orders[i].sel?600:400}}>{r.n} <span style={{color:'#94a3b8',fontSize:12}}>({r.s})</span></span>
                  {orders[i].sel && (
                    <label style={{display:'flex',alignItems:'center',gap:4,fontSize:12,cursor:'pointer',background:orders[i].dbl?'#fef3c7':'#f1f5f9',padding:'3px 10px',borderRadius:12,fontWeight:600,color:orders[i].dbl?'#92400e':'#64748b'}}>
                      <input type="checkbox" checked={orders[i].dbl} onChange={()=>toggleOrd(i,'dbl')} style={{accentColor:'#f59e0b'}}/>
                      {orders[i].dbl?'Double':'Single'}
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
                      const bags=it.order>0?Math.ceil(it.order/55):0;
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
      )}
    </div>
  );
}
