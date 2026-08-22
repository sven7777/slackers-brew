import { breweryEmojis, defSettings } from "../../lib/defaults";
import { batchVolume } from "../../lib/cogs";
import { card, hdr, btn, inp } from "../../styles";
import DataBackup from "./DataBackup";
import PriceImport from "./PriceImport";

// Largest logo we'll store. localStorage is small (~5MB) and base64 inflates
// the file ~33%, so we cap raw uploads well under that.
const MAX_LOGO_BYTES = 500 * 1024;

const field = { display:'flex', flexDirection:'column', gap:4, marginBottom:14 };
const label = { fontSize:12, fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em' };
const textInp = { ...inp, width:'100%', textAlign:'left' };

// Settings tab: edit brewery identity (name, tagline, icon). The icon is either
// a picked emoji or an uploaded logo image (stored as a base64 data URL).
export default function SettingsTab({ settings, setSettings, malts, setMalts, hops, setHops, yeast, setYeast, adj, setAdj }) {
  const set = (patch) => setSettings(p => ({ ...p, ...patch }));

  const pickEmoji = (emoji) => set({ emoji, logo: null });

  const uploadLogo = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      window.alert("Please choose an image file.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      window.alert(`That image is too large (max ${Math.round(MAX_LOGO_BYTES / 1024)} KB). Please pick a smaller file.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => set({ logo: reader.result });
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <div style={card}>
        <div style={hdr}>🏭 Brewery Identity</div>
        <div style={{ padding: 16 }}>
          <div style={field}>
            <label style={label} htmlFor="brewery-name">Brewery name</label>
            <input id="brewery-name" style={textInp} value={settings.name}
              onChange={e => set({ name: e.target.value })} placeholder={defSettings.name} />
          </div>

          <div style={field}>
            <label style={label} htmlFor="brewery-tagline">Tagline</label>
            <input id="brewery-tagline" style={textInp} value={settings.tagline}
              onChange={e => set({ tagline: e.target.value })} placeholder={defSettings.tagline} />
          </div>

          <div style={field}>
            <span style={label}>Icon</span>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:4 }}>
              {breweryEmojis.map(em => {
                const active = !settings.logo && settings.emoji === em;
                return (
                  <button key={em} type="button" onClick={() => pickEmoji(em)} title={em}
                    style={{ fontSize:22, width:44, height:44, cursor:'pointer', borderRadius:8,
                      background: active ? '#fef3c7' : '#fff',
                      border: active ? '2px solid #f59e0b' : '1px solid #e2e8f0' }}>
                    {em}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={field}>
            <span style={label}>Custom logo</span>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginTop:4 }}>
              {settings.logo && (
                <img src={settings.logo} alt="Brewery logo"
                  style={{ width:44, height:44, objectFit:'contain', borderRadius:8, border:'2px solid #f59e0b', background:'#fff' }} />
              )}
              <label style={{ ...btn, cursor:'pointer' }}>
                {settings.logo ? 'Replace logo' : 'Upload logo'}
                <input type="file" accept="image/*" onChange={uploadLogo} style={{ display:'none' }} />
              </label>
              {settings.logo && (
                <button type="button" style={{ ...btn, borderColor:'#fca5a5', color:'#dc2626' }}
                  onClick={() => set({ logo: null })}>Remove logo</button>
              )}
            </div>
            <span style={{ fontSize:11, color:'#94a3b8', marginTop:6 }}>
              PNG or SVG works best. Max 500 KB. A custom logo overrides the emoji above.
            </span>
          </div>

          <button type="button" style={{ ...btn, borderColor:'#fca5a5', color:'#dc2626' }}
            onClick={() => { if (window.confirm("Reset brewery identity to defaults?")) setSettings(defSettings); }}>
            Reset to defaults
          </button>
        </div>
      </div>

      <div style={card}>
        <div style={hdr}>🛢️ Batch Volume</div>
        <div style={{ padding: 16 }}>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "#64748b" }}>
            Used for cost per barrel and per keg. A recipe's own Post-Boil Yield on its Brew
            Sheet wins when set; this is the fallback. Loss covers everything between the kettle
            and the keg — trub, yeast, dry-hop absorption, transfer.
          </p>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div style={{ ...field, marginBottom: 0 }}>
              <label style={label} htmlFor="post-boil-yield">Default post-boil yield (gal)</label>
              <input id="post-boil-yield" type="number" step="1" min="0" style={{ ...inp, width: 110 }}
                value={settings.postBoilYield ?? ""} placeholder={String(defSettings.postBoilYield)}
                onChange={e => set({ postBoilYield: e.target.value === "" ? null : parseFloat(e.target.value) })} />
            </div>
            <div style={{ ...field, marginBottom: 0 }}>
              <label style={label} htmlFor="loss-pct">Brewhouse loss (%)</label>
              <input id="loss-pct" type="number" step="1" min="0" max="99" style={{ ...inp, width: 110 }}
                value={settings.lossPct ?? ""} placeholder={String(defSettings.lossPct)}
                onChange={e => set({ lossPct: e.target.value === "" ? null : parseFloat(e.target.value) })} />
            </div>
          </div>
          <p style={{ margin: "12px 0 0", fontSize: 12, color: "#94a3b8" }}>
            {(() => {
              // Same resolution the Cost panel uses, so the two can't disagree.
              const { kettleGal: gal, lossPct: loss } = batchVolume({ settings });
              const kegs = (gal * (1 - loss / 100)) / 15.5;
              return Number.isFinite(kegs) && kegs > 0
                ? `${gal} gal less ${loss}% ≈ ${kegs.toFixed(1)} kegs per batch.`
                : "Set a yield and loss to see the keg count.";
            })()}
          </p>
        </div>
      </div>

      <PriceImport malts={malts} setMalts={setMalts} hops={hops} setHops={setHops}
        yeast={yeast} setYeast={setYeast} adj={adj} setAdj={setAdj} />

      <DataBackup />
    </div>
  );
}
