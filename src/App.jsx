import { usePersistentState } from "./hooks/usePersistentState";
import { defMalts, defHops, defYeast, defAdj, defRecipes, defSettings, tabNames } from "./lib/defaults";
import { tabBtn } from "./styles";
import ErrorBoundary from "./components/ErrorBoundary";
import SaveErrorBanner from "./components/SaveErrorBanner";
import InventoryTab from "./features/inventory/InventoryTab";
import RecipesTab from "./features/recipes/RecipesTab";
import OrderTab from "./features/order/OrderTab";
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

  // Ingredient prices live on inventory rows, so the Cost view edits inventory
  // even though it renders inside a recipe. One setter keeps that in App.jsx
  // rather than threading four setters through the Recipes tab.
  //
  // A recipe can name an ingredient that has no inventory row — seeded recipes
  // did exactly that with Whirlfloc, and any hand-typed name does it too. This
  // used to map over the list, match nothing, and silently do nothing, so the
  // price field simply refused to accept input. Create the row instead.
  const SETTER = { malt: setMalts, hop: setHops, yeast: setYeast, adj: setAdj };
  const setInvCost = (category, name, raw, unit) => {
    const v = raw === "" ? null : parseFloat(raw);
    // Prices are money: two decimals, so what's shown is what's stored.
    const cpu = Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
    SETTER[category]?.(prev => prev.some(it => it.n === name)
      ? prev.map(it => it.n === name ? { ...it, cpu } : it)
      : [...prev, { n: name, q: 0, ...(unit ? { u: unit } : null), cpu }]);
  };

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

      <SaveErrorBanner/>

      {/* Keyed by tab so switching tabs clears a crashed panel — the nav stays
          outside the boundary, so a broken tab is always escapable. */}
      <ErrorBoundary key={tab}>
        {tab===0 && <InventoryTab malts={malts} setMalts={setMalts} hops={hops} setHops={setHops} yeast={yeast} setYeast={setYeast} adj={adj} setAdj={setAdj}/>}
        {tab===1 && <RecipesTab recs={recs} setRecs={setRecs} selR={selR} setSelR={setSelR} malts={malts} hops={hops} yeast={yeast} adj={adj} setInvCost={setInvCost} settings={settings}/>}
        {tab===2 && <OrderTab orders={orders} setOrders={setOrders} recs={recs} malts={malts} hops={hops} yeast={yeast} adj={adj}/>}
        {tab===3 && <SettingsTab settings={settings} setSettings={setSettings} malts={malts} setMalts={setMalts} hops={hops} setHops={setHops} yeast={yeast} setYeast={setYeast} adj={adj} setAdj={setAdj}/>}
      </ErrorBoundary>
    </div>
  );
}
