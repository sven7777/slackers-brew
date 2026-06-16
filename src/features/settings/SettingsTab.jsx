import { breweryEmojis, defSettings } from "../../lib/defaults";
import { card, hdr, btn, inp } from "../../styles";

// Largest logo we'll store. localStorage is small (~5MB) and base64 inflates
// the file ~33%, so we cap raw uploads well under that.
const MAX_LOGO_BYTES = 500 * 1024;

const field = { display:'flex', flexDirection:'column', gap:4, marginBottom:14 };
const label = { fontSize:12, fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em' };
const textInp = { ...inp, width:'100%', textAlign:'left' };

// Settings tab: edit brewery identity (name, tagline, icon). The icon is either
// a picked emoji or an uploaded logo image (stored as a base64 data URL).
export default function SettingsTab({ settings, setSettings }) {
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
    </div>
  );
}
