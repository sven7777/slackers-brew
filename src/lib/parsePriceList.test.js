import { describe, it, expect } from 'vitest';
import { parsePriceList, parsePriceLine, parseEffectiveDate } from './parsePriceList';

// ⚠️ Every price here is FABRICATED. The real vendor list is marked TRADE SECRET
// CONFIDENTIAL and this repo is public — never paste real quotes into a fixture.
// The SKUs are real catalog identifiers, which are public vendor information.
const lines = [
  'HOUSTON, TX                       UPDATED: 6/19/2025      TO PLACE AN ORDER: 1-800-000-0000',
  'Prices Subject to Change Without Notice',
  'All malt comes in 55lb bags unless specified          Pallet fee: $12.50 each',
  'Milling is available for an additional $0.10 per lb',
  '',
  '     SKU              North American Malts            1+ Bags     40+ Bags    200+ Bags',
  '  MRAH1102 Rahr Standard 2-Row              price / lb    $1.000      $0.900      $0.800',
  '  MRAH1105 Rahr Premium Pilsner             price / lb    $2.000      $1.900      $1.800',
  '  AZZZ1416      Rahr Unmalted Red Wheat        *   price / lb    $3.000      $2.900',
  '  BZZZ1984      Fermentis SafAle BE-134 - 500 g     each        $40.00    $1,000.00',
  '  AZZ8074B      Kerry Pink Lemonade Flavoring - 1 gal   *   each      $200.00',
];

describe('parsePriceLine', () => {
  it('reads sku, description, unit and the first price', () => {
    expect(parsePriceLine(lines[6])).toEqual({
      sku: 'MRAH1102', name: 'Rahr Standard 2-Row', unit: 'price / lb', price: 1,
    });
  });

  it('takes the first price column, not the quantity breaks', () => {
    expect(parsePriceLine(lines[7]).price).toBe(2);
  });

  it('ignores the ships-from-another-site asterisk', () => {
    expect(parsePriceLine(lines[8])).toMatchObject({ sku: 'AZZZ1416', name: 'Rahr Unmalted Red Wheat', price: 3 });
  });

  it('handles thousands separators and a trailing-letter sku', () => {
    expect(parsePriceLine(lines[9])).toMatchObject({ sku: 'BZZZ1984', price: 40 });
    expect(parsePriceLine(lines[10])).toMatchObject({ sku: 'AZZ8074B', price: 200 });
  });

  it('rejects prose that merely mentions money', () => {
    expect(parsePriceLine('All malt comes in 55lb bags   Pallet fee: $12.50 each')).toBeNull();
    expect(parsePriceLine('Milling is available for an additional $0.10 per lb')).toBeNull();
  });

  it('rejects a product row with no price, and blank input', () => {
    expect(parsePriceLine('  MRAH1102 Rahr Standard 2-Row     price / lb')).toBeNull();
    expect(parsePriceLine('')).toBeNull();
    expect(parsePriceLine(null)).toBeNull();
  });

  it('rejects a zero or negative price rather than reading it as free', () => {
    expect(parsePriceLine('  MRAH1102 Rahr Standard 2-Row   price / lb   $0.00')).toBeNull();
  });
});

describe('parseEffectiveDate', () => {
  it('reads the list date from the page header', () => {
    expect(parseEffectiveDate(lines)).toBe('2025-06-19');
  });

  it('is null when no header date is present', () => {
    expect(parseEffectiveDate(['no date here'])).toBeNull();
  });
});

describe('parsePriceList', () => {
  it('collects every product row and stamps them with the list date', () => {
    const r = parsePriceList(lines);
    expect(r.count).toBe(5);
    expect(r.prices.MRAH1102).toEqual({ price: 1, effective: '2025-06-19' });
    expect(Object.keys(r.prices)).toEqual(['MRAH1102', 'MRAH1105', 'AZZZ1416', 'BZZZ1984', 'AZZ8074B']);
  });

  it('keeps the first of a repeated sku when the price agrees', () => {
    const r = parsePriceList([...lines, '  MRAH1102 Rahr Standard 2-Row   price / lb   $1.000']);
    expect(r.prices.MRAH1102.price).toBe(1);
    expect(r.conflicts).toEqual([]);
  });

  it('reports a repeated sku with a DIFFERENT price instead of picking one', () => {
    const r = parsePriceList([...lines, '  MRAH1102 Rahr Standard 2-Row   price / lb   $9.000']);
    expect(r.conflicts).toEqual([{ sku: 'MRAH1102', prices: [1, 9] }]);
    expect(r.prices.MRAH1102.price).toBe(1);
  });

  it('survives an empty or junk document', () => {
    expect(parsePriceList([]).count).toBe(0);
    expect(parsePriceList(undefined).count).toBe(0);
    expect(parsePriceList(['nothing', 'to', 'see']).prices).toEqual({});
  });
});
