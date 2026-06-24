import { describe, it, expect } from 'vitest';
import { buildCellarSheet } from './cellarSheet';

// Fixture mirrors All Y'alls' real schedule + cellar data so the routing and
// date math are exercised end to end.
const recipe = {
  n: 'All Y\'alls', s: 'NEIPA',
  m: [['2-Row', 185]],
  h: [
    ['Cascade', 12, 'boil', 10],          // brew day — not on cellar sheet
    ['Cascade', 48, 'dryhop', 0],
    ['Mosaic', 48, 'dryhop', 0],
    ['Simcoe', 16, 'dryhop', 0],
  ],
  y: [['K97', 1]],
  a: [
    ['Whirlfloc', 1, 'each', 'boil', 15],         // brew day — excluded
    ['Mango Puree', 18, 'lbs', 'secondary', 0],   // cellar — kept
  ],
  sc: [
    [0, 'Brew Date'], [11, 'Step Crash 55'], [11, 'Bung | Pressure'],
    [12, 'Blow Off'], [12, 'Dry Hop'], [13, 'Mini Blow Off'], [13, 'Rouse'],
    [13, 'Step Crash 40'], [14, 'Blow Off'], [14, 'Step Crash 33'],
    [19, 'Blow Off'], [19, 'Transfer'], [20, 'Blow Off'], [20, 'Keg'],
  ],
};

describe('buildCellarSheet', () => {
  it('returns null for a missing recipe', () => {
    expect(buildCellarSheet(null)).toBeNull();
    expect(buildCellarSheet(undefined)).toBeNull();
  });

  it('passes name/style through and tolerates no brew date', () => {
    const s = buildCellarSheet(recipe);
    expect(s).toMatchObject({ name: "All Y'alls", style: 'NEIPA', brewDate: null });
    expect(s.schedule.every((row) => row.date === null)).toBe(true);
  });

  it('orders the schedule by day, stable within a day', () => {
    const s = buildCellarSheet(recipe);
    expect(s.schedule.slice(0, 3).map((r) => [r.day, r.action])).toEqual([
      [0, 'Brew Date'], [11, 'Step Crash 55'], [11, 'Bung | Pressure'],
    ]);
  });

  it('computes calendar dates as brewDate + day offset', () => {
    const s = buildCellarSheet(recipe, '2026-07-01'); // a Wednesday
    expect(s.dateBrewed).toBe('Wed 7/1');
    expect(s.bung).toBe('Sun 7/12');       // day 11
    expect(s.transfer).toBe('Mon 7/20');   // day 19
    expect(s.keg).toBe('Tue 7/21');        // day 20
  });

  it('handles month rollover correctly', () => {
    const s = buildCellarSheet(recipe, '2026-07-25');
    expect(s.keg).toBe('Fri 8/14'); // 7/25 + 20 days
  });

  it('routes cold-crash steps off the schedule with temps and dates', () => {
    const s = buildCellarSheet(recipe, '2026-07-01');
    expect(s.coldCrash).toEqual([
      { temp: 55, date: 'Sun 7/12' },
      { temp: 40, date: 'Tue 7/14' },
      { temp: 33, date: 'Wed 7/15' },
    ]);
  });

  it('collects every blow-off as a dated entry', () => {
    const s = buildCellarSheet(recipe, '2026-07-01');
    expect(s.blowOffs.map((b) => b.label)).toEqual(['Blow Off', 'Mini Blow Off', 'Blow Off', 'Blow Off', 'Blow Off']);
    expect(s.blowOffs).toHaveLength(5);
  });

  it('pairs dry-hop dates with the recipe dry-hop varieties', () => {
    const s = buildCellarSheet(recipe, '2026-07-01');
    expect(s.dryHop.dates).toEqual(['Mon 7/13']); // day 12
    expect(s.dryHop.items).toEqual([
      { name: 'Cascade', qty: 48 }, { name: 'Mosaic', qty: 48 }, { name: 'Simcoe', qty: 16 },
    ]);
  });

  it('carries yeast strains', () => {
    expect(buildCellarSheet(recipe).yeast).toEqual([{ name: 'K97', qty: 1 }]);
  });

  it('carries the fermentation temp, null when unset', () => {
    expect(buildCellarSheet({ ...recipe, ft: 68 }).fermTemp).toBe(68);
    expect(buildCellarSheet(recipe).fermTemp).toBeNull();
  });

  it('keeps only off-brew-day adjuncts as misc additions', () => {
    const s = buildCellarSheet(recipe);
    expect(s.misc).toEqual([{ name: 'Mango Puree', qty: 18, unit: 'lbs' }]);
  });

  it('routes rouse dates', () => {
    expect(buildCellarSheet(recipe, '2026-07-01').rouse).toEqual(['Tue 7/14']); // day 13
  });

  it('handles a recipe with an empty schedule', () => {
    const s = buildCellarSheet({ n: 'X', s: 'Y', m: [], h: [], y: [], a: [], sc: [] }, '2026-07-01');
    expect(s.schedule).toEqual([]);
    expect(s.coldCrash).toEqual([]);
    expect(s.bung).toBeNull();
    expect(s.dryHop.items).toEqual([]);
  });
});
