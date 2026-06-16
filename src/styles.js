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
