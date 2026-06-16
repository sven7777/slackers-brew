// Pure order-calculation logic, extracted from App.jsx so it can be unit-tested
// independently of React rendering.

// Aggregate the ingredient needs of all selected recipes, compare against
// current inventory, and return per-ingredient {n, need, have, order} rows.
//
// Inputs:
//   orders — [{sel, dbl}] aligned by index with recs
//   recs   — [{m[], h[], y[], a[]}] recipe ingredient tuples
//   malts/hops/yeast/adj — inventory [{n, q, u?}]
//
// Returns { malts, hops, yeast, adj } arrays.
export function computeOrder({ orders, recs, malts, hops, yeast, adj }) {
  const need = { malts: {}, hops: {}, yeast: {}, adj: {} };
  orders.forEach((o, i) => {
    if (!o.sel) return;
    const mult = o.dbl ? 2 : 1, r = recs[i];
    r.m.forEach(([n, q]) => { need.malts[n] = (need.malts[n] || 0) + q * mult; });
    r.h.forEach(([n, q]) => { need.hops[n] = (need.hops[n] || 0) + q * mult; });
    r.y.forEach(([n, q]) => { need.yeast[n] = (need.yeast[n] || 0) + q * mult; });
    r.a.forEach(([n, q]) => { need.adj[n] = (need.adj[n] || 0) + q * mult; });
  });
  const inv = { malts: {}, hops: {}, yeast: {}, adj: {} };
  malts.forEach(i => inv.malts[i.n] = i.q);
  hops.forEach(i => inv.hops[i.n] = i.q);
  yeast.forEach(i => inv.yeast[i.n] = i.q);
  adj.forEach(i => inv.adj[i.n] = i.q);
  const res = { malts: [], hops: [], yeast: [], adj: [] };
  Object.entries(need.malts).forEach(([n, q]) => { const h = inv.malts[n] || 0; res.malts.push({ n, need: q, have: h, order: Math.max(0, q - h) }); });
  Object.entries(need.hops).forEach(([n, q]) => { const h = inv.hops[n] || 0; res.hops.push({ n, need: q, have: h, order: Math.max(0, q - h) }); });
  Object.entries(need.yeast).forEach(([n, q]) => { const h = inv.yeast[n] || 0; res.yeast.push({ n, need: q, have: h, order: Math.max(0, q - h) }); });
  Object.entries(need.adj).forEach(([n, q]) => { const h = inv.adj[n] || 0; const u = adj.find(a => a.n === n)?.u || ''; res.adj.push({ n, need: q, have: h, order: Math.max(0, q - h), u }); });
  return res;
}

// Number of 55 lb bags required to cover a malt order quantity.
export const maltBags = (order) => order > 0 ? Math.ceil(order / 55) : 0;
