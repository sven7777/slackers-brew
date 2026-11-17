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
const round2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;

export function computeOrder({ orders, recs, malts, hops, yeast, adj }) {
  const need = { malts: {}, hops: {}, yeast: {}, adj: {} };
  orders.forEach((o, i) => {
    if (!o.sel) return;
    const r = recs[i];
    if (!r) return; // stale device-local selection past the shared recipe list
    const mult = o.dbl ? 2 : 1;
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
  // Quantities are rounded to 2 decimals: binary floats make 65 - 55.1 come out
  // as 9.899999999999999, which printed verbatim on the Order Calculator.
  const row = (cat, n, q) => {
    const h = inv[cat][n] || 0;
    return { n, need: round2(q), have: round2(h), order: round2(Math.max(0, q - h)) };
  };
  const res = { malts: [], hops: [], yeast: [], adj: [] };
  ['malts', 'hops', 'yeast'].forEach(cat => {
    Object.entries(need[cat]).forEach(([n, q]) => { res[cat].push(row(cat, n, q)); });
  });
  Object.entries(need.adj).forEach(([n, q]) => { const u = adj.find(a => a.n === n)?.u || ''; res.adj.push({ ...row('adj', n, q), u }); });
  return res;
}

// Number of 55 lb bags required to cover a malt order quantity.
export const maltBags = (order) => order > 0 ? Math.ceil(order / 55) : 0;
