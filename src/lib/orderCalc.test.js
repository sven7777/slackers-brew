import { describe, it, expect } from 'vitest';
import { computeOrder, maltBags } from './orderCalc';

// Minimal fixtures: two recipes sharing one malt, so we can check aggregation,
// doubling, inventory subtraction, and the order floor at zero.
const recs = [
  { m: [['2-Row', 100], ['Munich', 20]], h: [['Citra', 10]], y: [['US-05', 1]], a: [['Lactose', 5]] },
  { m: [['2-Row', 50]], h: [['Saaz', 8]], y: [['US-05', 1]], a: [] },
];

const emptyInv = { malts: [], hops: [], yeast: [], adj: [] };

function calc(orders, inv = emptyInv) {
  return computeOrder({ orders, recs, ...inv });
}

describe('computeOrder', () => {
  it('returns no rows when nothing is selected', () => {
    const res = calc([{ sel: false, dbl: false }, { sel: false, dbl: false }]);
    expect(res).toEqual({ malts: [], hops: [], yeast: [], adj: [] });
  });

  it('sums a single selected recipe with no inventory (order === need)', () => {
    const res = calc([{ sel: true, dbl: false }, { sel: false, dbl: false }]);
    expect(res.malts).toEqual([
      { n: '2-Row', need: 100, have: 0, order: 100 },
      { n: 'Munich', need: 20, have: 0, order: 20 },
    ]);
    expect(res.hops).toEqual([{ n: 'Citra', need: 10, have: 0, order: 10 }]);
    expect(res.yeast).toEqual([{ n: 'US-05', need: 1, have: 0, order: 1 }]);
    expect(res.adj).toEqual([{ n: 'Lactose', need: 5, have: 0, order: 5, u: '' }]);
  });

  it('doubles quantities when dbl is set', () => {
    const res = calc([{ sel: true, dbl: true }, { sel: false, dbl: false }]);
    expect(res.malts.find(m => m.n === '2-Row').need).toBe(200);
    expect(res.hops[0].need).toBe(20);
  });

  it('aggregates shared ingredients across multiple selected recipes', () => {
    const res = calc([{ sel: true, dbl: false }, { sel: true, dbl: false }]);
    // 2-Row appears in both recipes: 100 + 50
    expect(res.malts.find(m => m.n === '2-Row').need).toBe(150);
    // US-05 yeast appears in both: 1 + 1
    expect(res.yeast.find(y => y.n === 'US-05').need).toBe(2);
  });

  it('subtracts inventory on hand and never goes below zero', () => {
    const inv = {
      malts: [{ n: '2-Row', q: 120 }, { n: 'Munich', q: 5 }],
      hops: [], yeast: [], adj: [],
    };
    const res = calc([{ sel: true, dbl: false }, { sel: false, dbl: false }], inv);
    // have exceeds need -> order floored at 0
    expect(res.malts.find(m => m.n === '2-Row')).toMatchObject({ need: 100, have: 120, order: 0 });
    // partial coverage -> order is the remainder
    expect(res.malts.find(m => m.n === 'Munich')).toMatchObject({ need: 20, have: 5, order: 15 });
  });

  it('carries the adjunct unit through from inventory', () => {
    const inv = { malts: [], hops: [], yeast: [], adj: [{ n: 'Lactose', q: 2, u: 'lbs' }] };
    const res = calc([{ sel: true, dbl: false }, { sel: false, dbl: false }], inv);
    expect(res.adj[0]).toEqual({ n: 'Lactose', need: 5, have: 2, order: 3, u: 'lbs' });
  });
});

describe('maltBags', () => {
  it('is 0 for a zero or negative order', () => {
    expect(maltBags(0)).toBe(0);
    expect(maltBags(-10)).toBe(0);
  });

  it('rounds up to whole 55 lb bags', () => {
    expect(maltBags(1)).toBe(1);
    expect(maltBags(55)).toBe(1);
    expect(maltBags(56)).toBe(2);
    expect(maltBags(110)).toBe(2);
    expect(maltBags(111)).toBe(3);
  });
});
