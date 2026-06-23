import { describe, it, expect } from 'vitest';
import { buildBrewSheet } from './brewSheet';

// Fixture exercises every routing rule: brew-day vs cellar stages, first-wort
// hopping, adjunct units, salt grouping, and the stage/time sort.
const recipe = {
  n: 'Test IPA', s: 'American IPA', og: 1.06, fg: 1.012, abv: 6.3, mt: 152,
  m: [['2-Row', 100], ['Munich', 20]],
  h: [
    ['CTZ', 14, 'firstwort', 90],
    ['Citra', 10, 'boil', 60],
    ['Citra', 5, 'boil', 5],
    ['Mosaic', 8, 'whirlpool', 20],
    ['Simcoe', 48, 'dryhop', 0],          // cellar — excluded
  ],
  a: [
    ['Whirlfloc', 1, 'each', 'boil', 15],
    ['Clarity Ferm', 125, 'ml', 'fermentation', 0], // cellar — excluded
  ],
  y: [['US-05', 1]],                        // yeast never prints on brew sheet
  sa: [
    ['CaCl2', 50, 'mash'], ['CaSo4', 40, 'mash'],
    ['CaCl2', 30, 'sparge'],
    ['CaSo4', 20, 'boil'],
  ],
};

describe('buildBrewSheet', () => {
  it('returns null for a missing recipe', () => {
    expect(buildBrewSheet(null)).toBeNull();
    expect(buildBrewSheet(undefined)).toBeNull();
  });

  it('passes header targets and mash temp through', () => {
    const s = buildBrewSheet(recipe);
    expect(s).toMatchObject({ name: 'Test IPA', style: 'American IPA', og: 1.06, fg: 1.012, abv: 6.3, mashTemp: 152 });
  });

  it('coerces missing targets to null', () => {
    const s = buildBrewSheet({ n: 'X', s: 'Y', mt: 150, m: [], h: [], a: [], sa: [] });
    expect(s).toMatchObject({ og: null, fg: null, abv: null });
  });

  it('builds the grain bill with a total', () => {
    const s = buildBrewSheet(recipe);
    expect(s.grainBill).toEqual([{ name: '2-Row', qty: 100 }, { name: 'Munich', qty: 20 }]);
    expect(s.totalGrain).toBe(120);
  });

  it('keeps only brew-day hops/adjuncts and never yeast', () => {
    const s = buildBrewSheet(recipe);
    const names = s.additions.map((x) => x.name);
    expect(names).not.toContain('Simcoe');        // dry hop
    expect(names).not.toContain('Clarity Ferm');  // fermentation
    expect(names).not.toContain('US-05');         // yeast
  });

  it('orders additions by stage then descending time', () => {
    const s = buildBrewSheet(recipe);
    expect(s.additions.map((x) => [x.name, x.stage, x.time])).toEqual([
      ['CTZ', 'firstwort', 90],
      ['Citra', 'boil', 60],
      ['Whirlfloc', 'boil', 15],
      ['Citra', 'boil', 5],
      ['Mosaic', 'whirlpool', 20],
    ]);
  });

  it('tags hop units as oz and carries adjunct units', () => {
    const s = buildBrewSheet(recipe);
    expect(s.additions.find((x) => x.name === 'Citra').unit).toBe('oz');
    expect(s.additions.find((x) => x.name === 'Whirlfloc').unit).toBe('each');
  });

  it('groups salts by stage and drops empty stages', () => {
    const s = buildBrewSheet(recipe);
    expect(s.saltsByStage).toEqual([
      { stage: 'mash', salts: [{ name: 'CaCl2', qty: 50 }, { name: 'CaSo4', qty: 40 }] },
      { stage: 'sparge', salts: [{ name: 'CaCl2', qty: 30 }] },
      { stage: 'boil', salts: [{ name: 'CaSo4', qty: 20 }] },
    ]);
  });

  it('returns no salt sections when a recipe has none', () => {
    const s = buildBrewSheet({ n: 'X', s: 'Y', mt: 150, m: [], h: [], a: [], sa: [] });
    expect(s.saltsByStage).toEqual([]);
  });
});
