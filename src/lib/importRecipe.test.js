import { describe, it, expect } from 'vitest';
import { unmappedInRecipe, applyMappings, summarizeRecipe, diffRecipes, mappingKey } from './importRecipe';

// A parsed recipe with two unmapped names: a hop ("Galaxy", not in catalog) and
// an adjunct ("Vanilla Bean"). Everything else is already in the app catalog.
const parsed = {
  n: 'Imported IPA', s: 'IPA', og: 1.06, fg: 1.01, abv: 6.5, mt: 150,
  m: [['2-Row', 100], ['Munich', 20]],
  h: [['Citra', 10, 'boil', 60], ['Galaxy', 8, 'whirlpool', 20]],
  y: [['US-05', 1]],
  a: [['Vanilla Bean', 2, 'each', 'secondary', 0]],
  sa: [['CaCl2', 50, 'mash']],
};

describe('unmappedInRecipe', () => {
  it('flags only names absent from the catalog, deduped, with category', () => {
    expect(unmappedInRecipe(parsed)).toEqual([
      { category: 'hop', raw: 'Galaxy' },
      { category: 'adj', raw: 'Vanilla Bean' },
    ]);
  });

  it('returns nothing when every name is known', () => {
    const clean = { m: [['2-Row', 100]], h: [['Citra', 10, 'boil', 60]], y: [['US-05', 1]], a: [], sa: [] };
    expect(unmappedInRecipe(clean)).toEqual([]);
  });
});

describe('applyMappings', () => {
  it('replaces a hop name and leaves the rest intact', () => {
    const r = applyMappings(parsed, { [mappingKey('hop', 'Galaxy')]: 'Mosaic' });
    expect(r.h).toEqual([['Citra', 10, 'boil', 60], ['Mosaic', 8, 'whirlpool', 20]]);
  });

  it('adopts the catalog unit when mapping an adjunct', () => {
    const r = applyMappings(parsed, { [mappingKey('adj', 'Vanilla Bean')]: 'Lactose' });
    // Lactose is lbs in defaults; the imported "each" should become "lbs".
    expect(r.a).toEqual([['Lactose', 2, 'lbs', 'secondary', 0]]);
  });

  it('skips empty mappings (keep as new) and does not mutate the input', () => {
    const r = applyMappings(parsed, { [mappingKey('hop', 'Galaxy')]: '' });
    expect(r.h).toEqual(parsed.h);
    expect(parsed.h[1][0]).toBe('Galaxy'); // original untouched
  });
});

describe('summarizeRecipe', () => {
  it('renders labeled line lists per field', () => {
    const s = summarizeRecipe(parsed);
    expect(s.m).toEqual(['2-Row — 100 lb', 'Munich — 20 lb']);
    expect(s.h).toEqual(['Citra — 10 oz · boil 60m', 'Galaxy — 8 oz · whirlpool 20m']);
    expect(s.sa).toEqual(['CaCl2 — 50 g · mash']);
  });
});

describe('diffRecipes', () => {
  const oldR = {
    s: 'Pale Ale', mt: 152, og: null, fg: null, abv: null,
    m: [['2-Row', 90]], h: [['Citra', 10, 'boil', 60]], y: [['US-05', 1]], a: [], sa: [],
  };
  const newR = {
    s: 'IPA', mt: 150, og: null, fg: null, abv: null,
    m: [['2-Row', 100]], h: [['Citra', 10, 'boil', 60], ['Mosaic', 8, 'whirlpool', 20]], y: [['US-05', 1]], a: [], sa: [],
  };

  it('reports added and removed ingredient lines', () => {
    const d = diffRecipes(oldR, newR);
    expect(d.fields.m).toEqual({ added: ['2-Row — 100 lb'], removed: ['2-Row — 90 lb'] });
    expect(d.fields.h).toEqual({ added: ['Mosaic — 8 oz · whirlpool 20m'], removed: [] });
    expect(d.fields.y).toEqual({ added: [], removed: [] });
  });

  it('lists header field changes', () => {
    const d = diffRecipes(oldR, newR);
    expect(d.header).toEqual([
      { label: 'Style', from: 'Pale Ale', to: 'IPA' },
      { label: 'Mash °F', from: 152, to: 150 },
    ]);
  });
});
