import { usePersistentState } from "./hooks/usePersistentState";
import { defMalts, defHops, defYeast, defAdj, defRecipes, defSettings, tabNames } from "./lib/defaults";
import { tabBtn } from "./styles";
import InventoryTab from "./features/inventory/InventoryTab";
import RecipesTab from "./features/recipes/RecipesTab";
import OrderTab from "./features/order/OrderTab";
import BrewDayTab from "./features/brewday/BrewDayTab";
import CellarSummaryTab from "./features/cellar/CellarSummaryTab";
import SettingsTab from "./features/settings/SettingsTab";

export default function App() {
  const [tab, setTab] = usePersistentState("tab", 0);
  const [malts, setMalts] = usePersistentState("malts", () => defMalts.map(([n,q])=>({n,q})));
  const [hops, setHops] = usePersistentState("hops", () => defHops.map(([n,q])=>({n,q})));
  const [yeast, setYeast] = usePersistentState("yeast", () => defYeast.map(([n,q])=>({n,q})));
  const [adj, setAdj] = usePersistentState("adj", () => defAdj.map(([n,q,u])=>({n,q,u})));
  const [selR, setSelR] = usePersistentState("selR", 0);
  const [orders, setOrders] = usePersistentState("orders", () => defRecipes.map(()=>({sel:false,dbl:false})));
  const [recs, setRecs] = usePersistentState("recipes", () => structuredClone(defRecipes));
  const [settings, setSettings] = usePersistentState("settings", { ...defSettings });

  return (
    <div style={{fontFamily:'-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif',color:'#1e293b',maxWidth:900,margin:'0 auto',padding:'0 16px'}}>
      <div style={{textAlign:'center',padding:'16px 0 8px'}}>
        <h1 style={{margin:0,fontSize:22,fontWeight:800,color:'#f59e0b',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
          {settings.logo
            ? <img src={settings.logo} alt="" style={{height:28,width:28,objectFit:'contain'}}/>
            : <span>{settings.emoji}</span>}
          {settings.name}
        </h1>
        {settings.tagline && <p style={{margin:'2px 0 0',fontSize:13,color:'#64748b'}}>{settings.tagline}</p>}
      </div>
      <div style={{display:'flex',justifyContent:'center',borderBottom:'1px solid #e2e8f0',marginBottom:16}}>
        {tabNames.map((t,i)=><button key={i} style={tabBtn(tab===i)} onClick={()=>setTab(i)}>{t}</button>)}
      </div>

      {tab===0 && <InventoryTab malts={malts} setMalts={setMalts} hops={hops} setHops={setHops} yeast={yeast} setYeast={setYeast} adj={adj} setAdj={setAdj}/>}
      {tab===1 && <RecipesTab recs={recs} setRecs={setRecs} selR={selR} setSelR={setSelR}/>}
      {tab===2 && <OrderTab orders={orders} setOrders={setOrders} recs={recs} malts={malts} hops={hops} yeast={yeast} adj={adj}/>}
      {tab===3 && <BrewDayTab recs={recs}/>}
      {tab===4 && <CellarSummaryTab recs={recs}/>}
      {tab===5 && <SettingsTab settings={settings} setSettings={setSettings}/>}
    </div>
  );
}
