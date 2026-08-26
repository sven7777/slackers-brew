import { describe, it, expect } from 'vitest';
import { rowValue, categoryValue, inventoryValue, priceAsOf } from './inventoryValue';

describe('rowValue', () => {
  it('multiplies quantity by the stored price', () => {
    expect(rowValue({ n: '2-Row', q: 100, cpu: 0.72 })).toBe(72);
  });

  it('rounds up to the cent, without float noise', () => {
    // 185 × 0.724 = 133.94 exactly, but lands on 133.94000000000003 in binary.
    expect(rowValue({ n: '2-Row', q: 185, cpu: 0.724 })).toBe(133.94);
    expect(rowValue({ n: 'Citra', q: 3, cpu: 0.871 })).toBe(2.62); // 2.613 → up
  });

  it('is null, never 0, for an unpriced row', () => {
    expect(rowValue({ n: 'K97', q: 4 })).toBeNull();
    expect(rowValue({ n: 'K97', q: 4, cpu: null })).toBeNull();
  });

  it('values an empty shelf at $0 when the price is known', () => {
    expect(rowValue({ n: 'Citra', q: 0, cpu: 0.87 })).toBe(0);
  });

  it('treats a blank or missing quantity as an empty shelf, not an unknown one', () => {
    expect(rowValue({ n: 'Citra', q: '', cpu: 0.87 })).toBe(0);
    expect(rowValue({ n: 'Citra', cpu: 0.87 })).toBe(0);
  });

  it('is null when the quantity is not a number at all', () => {
    expect(rowValue({ n: 'Citra', q: 'a few', cpu: 0.87 })).toBeNull();
  });
});

describe('categoryValue', () => {
  const malts = [
    { n: '2-Row', q: 100, cpu: 0.72 },
    { n: 'Munich', q: 55, cpu: 0.9 },
    { n: 'Carafa III', q: 10 },        // unpriced
  ];

  it('sums the priced rows and counts the rest', () => {
    expect(categoryValue(malts)).toEqual({ total: 121.5, priced: 2, unpriced: 1 });
  });

  it('sums the ROUNDED rows, so the column adds up to the total', () => {
    const rows = [{ n: 'a', q: 1, cpu: 0.011 }, { n: 'b', q: 1, cpu: 0.011 }];
    // Each row shows $0.02, so the total must be $0.04 — not $0.03 from
    // rounding 0.022 once at the end.
    expect(categoryValue(rows).total).toBe(0.04);
  });

  it('handles an empty category', () => {
    expect(categoryValue()).toEqual({ total: 0, priced: 0, unpriced: 0 });
  });
});

describe('inventoryValue', () => {
  const inv = {
    malts: [{ n: '2-Row', q: 100, cpu: 0.72 }],
    hops: [{ n: 'Citra', q: 16, cpu: 0.87 }],
    yeast: [{ n: 'K97', q: 2 }],                       // unpriced
    adj: [{ n: 'Lactose', q: 5, cpu: 1.33, u: 'lbs' }],
  };

  it('totals every category and reports the coverage', () => {
    const v = inventoryValue(inv);
    expect(v.byCategory.malt.total).toBe(72);
    expect(v.byCategory.hop.total).toBe(13.92);
    expect(v.byCategory.adj.total).toBe(6.65);
    expect(v.total).toBe(92.57);
    expect(v.priced).toBe(3);
    expect(v.unpriced).toBe(1);
  });

  it('excludes the unpriced row rather than costing it at $0', () => {
    const withPrice = inventoryValue({ ...inv, yeast: [{ n: 'K97', q: 2, cpu: 80 }] });
    expect(withPrice.total).toBe(252.57);
    expect(withPrice.unpriced).toBe(0);
  });

  it('survives being called with nothing', () => {
    expect(inventoryValue().total).toBe(0);
  });
});

describe('priceAsOf', () => {
  it('returns the oldest effective date among priced rows', () => {
    const d = priceAsOf({
      malts: [{ n: '2-Row', q: 1, cpu: 0.72, pricedAt: '2026-04-01' }],
      hops: [{ n: 'Citra', q: 1, cpu: 0.87, pricedAt: '2025-07-19' }],
    });
    expect(d).toBe('2025-07-19');
  });

  it('ignores dates on rows whose price was removed', () => {
    const d = priceAsOf({
      malts: [{ n: '2-Row', q: 1, cpu: null, pricedAt: '2024-01-01' }],
      hops: [{ n: 'Citra', q: 1, cpu: 0.87, pricedAt: '2026-04-01' }],
    });
    expect(d).toBe('2026-04-01');
  });

  it('is null when nothing carries a date', () => {
    expect(priceAsOf({ malts: [{ n: '2-Row', q: 1, cpu: 0.72 }] })).toBeNull();
    expect(priceAsOf()).toBeNull();
  });
});
