import { describe, it, expect } from 'vitest';
import { priceChanges } from './priceChanges';

// ⚠️ Fabricated prices only — see parsePriceList.test.js. Round numbers also keep
// the arithmetic obvious: 2-Row is quoted per lb and used per lb, so $1/lb in is
// $1/lb out; a 500 g yeast brick is one pack, so $40 a brick is $40 a pack.
const inventory = {
  malts: [{ n: '2-Row', q: 0 }, { n: 'Pils', q: 0, cpu: 5 }],
  hops: [{ n: 'Cascade', q: 0 }],
  yeast: [{ n: 'K97', q: 0 }],
  adj: [{ n: 'Honey', q: 0 }],
};

const priceBySku = {
  MRAH1102: { price: 1, effective: '2025-06-19' },   // 2-Row → new price
  MRAH1105: { price: 5, effective: '2025-06-19' },   // Pils  → unchanged
  BZZZ1971: { price: 40, effective: '2025-06-19' },  // K97   → new price
};

describe('priceChanges', () => {
  it('reports a newly priced ingredient as a change from nothing', () => {
    const { changes } = priceChanges(inventory, priceBySku);
    expect(changes).toContainEqual(
      expect.objectContaining({ category: 'malt', name: '2-Row', sku: 'MRAH1102', from: null, to: 1 }),
    );
  });

  it('separates a price that did not move from one that did', () => {
    const { changes, unchanged } = priceChanges(inventory, priceBySku);
    expect(unchanged).toContainEqual(expect.objectContaining({ name: 'Pils', from: 5, to: 5 }));
    expect(changes.map((c) => c.name)).not.toContain('Pils');
  });

  it('reports a repriced ingredient with both numbers', () => {
    const dearer = { ...priceBySku, MRAH1105: { price: 6 } };
    const { changes } = priceChanges(inventory, dearer);
    expect(changes).toContainEqual(expect.objectContaining({ name: 'Pils', from: 5, to: 6 }));
  });

  it('lists an ingredient the file does not carry as skipped, not as unchanged', () => {
    const { skipped, unchanged } = priceChanges(inventory, priceBySku);
    expect(skipped).toContainEqual(expect.objectContaining({ name: 'Cascade', reason: 'absent' }));
    expect(unchanged.map((u) => u.name)).not.toContain('Cascade');
  });

  it('distinguishes an ingredient with no vendor product at all', () => {
    const { skipped } = priceChanges({ ...inventory, adj: [{ n: 'Brewzyme D', q: 0 }] }, priceBySku);
    expect(skipped).toContainEqual(expect.objectContaining({ name: 'Brewzyme D', reason: 'unmapped' }));
  });

  it('converts vendor pack pricing into the recipe unit', () => {
    // One 500 g brick = one pack, so a $40 brick is $40 a pack.
    const { changes } = priceChanges(inventory, priceBySku);
    expect(changes).toContainEqual(expect.objectContaining({ name: 'K97', to: 40 }));
  });

  it('returns inventory ready to save, with the old rows untouched where skipped', () => {
    const { next } = priceChanges(inventory, priceBySku);
    expect(next.malts[0]).toMatchObject({ n: '2-Row', cpu: 1, sku: 'MRAH1102' });
    expect(next.hops[0]).toEqual({ n: 'Cascade', q: 0 });
  });

  it('changes nothing when the file is empty', () => {
    const { changes, unchanged, skipped } = priceChanges(inventory, {});
    expect(changes).toEqual([]);
    expect(unchanged).toEqual([]);
    expect(skipped).toHaveLength(5);
  });
});
