// Shared inline-style objects. Defined at module level so references are stable
// across renders. Color accent is amber (#f59e0b); neutrals from Tailwind slate.

export const cell = {padding:'6px 10px',borderBottom:'1px solid #e2e8f0',textAlign:'left',fontSize:13};
export const num = {...cell,textAlign:'right'};
export const inp = {width:70,padding:'4px 6px',border:'1px solid #cbd5e1',borderRadius:4,textAlign:'right',fontSize:13,background:'#fff',color:'#1e293b'};
export const th = {...cell,fontWeight:600,fontSize:12,textTransform:'uppercase',color:'#64748b',letterSpacing:'0.05em',position:'sticky',top:0,background:'#f8fafc',zIndex:1};
export const card = {background:'#fff',borderRadius:8,border:'1px solid #e2e8f0',overflow:'hidden',marginBottom:16};
export const hdr = {padding:'10px 14px',background:'#f1f5f9',fontWeight:600,fontSize:14,borderBottom:'1px solid #e2e8f0'};
export const badge = {display:'inline-block',padding:'2px 8px',borderRadius:10,fontSize:12,fontWeight:600};
export const btn = {padding:'6px 14px',fontSize:12,border:'1px solid #e2e8f0',borderRadius:6,background:'#fff',cursor:'pointer',color:'#64748b',fontWeight:500};
export const rmBtn = {background:'none',border:'none',cursor:'pointer',color:'#ef4444',fontSize:16,padding:'0 4px',lineHeight:1};
export const addRow = {display:'flex',gap:6,padding:'6px 10px',alignItems:'center',borderTop:'1px solid #e2e8f0'};
export const sel = {flex:1,padding:'4px 6px',fontSize:13,border:'1px solid #cbd5e1',borderRadius:4,background:'#fff',color:'#1e293b'};
export const addBtn = {padding:'4px 12px',fontSize:12,border:'1px solid #f59e0b',borderRadius:4,background:'#fef3c7',cursor:'pointer',color:'#92400e',fontWeight:600};
export const tabBtn = a=>({padding:'10px 20px',border:'none',borderBottom:a?'3px solid #f59e0b':'3px solid transparent',background:'none',cursor:'pointer',fontWeight:a?700:500,fontSize:14,color:a?'#f59e0b':'#475569',transition:'all 0.15s'});

// Segmented sub-nav within a tab (Recipes' four views of one recipe, Analytics'
// two views of the book). Distinct from `tabBtn` on purpose: the top nav is
// where you are in the app, this is which lens you're using on what's already
// selected, so it reads as a control rather than as navigation.
export const segWrap = {display:'flex',gap:4,padding:4,background:'#f1f5f9',borderRadius:8,marginBottom:12};
// ⚠️ The inactive color is slate-600, NOT the slate-500 used for muted text
// elsewhere: this sits on the #f1f5f9 track rather than on white, where
// slate-500 comes to 4.2:1 and misses AA for 13px text. An unselected segment
// is a control you are meant to be able to read and click, not a caption.
export const segBtn = a=>({flex:1,padding:'8px 12px',fontSize:13,border:'none',cursor:'pointer',borderRadius:6,fontWeight:a?700:500,background:a?'#fff':'transparent',color:a?'#92400e':'#475569',boxShadow:a?'0 1px 2px rgba(0,0,0,0.08)':'none'});

// The Analytics stat tile — a big number, a label above it, a note under it.
// Shared because all three Analytics views print the same row of them, and three
// copies of a color is three chances for one of them to drift. `minWidth` is the
// one part that is per-panel: it sets how many tiles fit on a row before they
// wrap, and a four-tile row of long labels needs more than a four-tile row of
// short ones, so panels spread their own over the base.
export const statBox = {flex:1,minWidth:150,padding:'12px 14px',background:'#fff',border:'1px solid #e2e8f0',borderRadius:8};
export const statLabel = {fontSize:11,fontWeight:600,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.05em'};
export const statValue = {fontSize:22,fontWeight:800,color:'#92400e',marginTop:2};
export const statNote = {fontSize:11,color:'#94a3b8',marginTop:2};
