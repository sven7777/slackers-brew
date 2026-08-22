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

  it('formats target gravities to 3 decimals, null when unset', () => {
    const s = buildCellarSheet({ ...recipe, og: 1.06, fg: 1.01 });
    expect(s).toMatchObject({ og: '1.060', fg: '1.010' });
    expect(buildCellarSheet(recipe)).toMatchObject({ og: null, fg: null });
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

  // This fixture deliberately uses the OLD unnumbered values ('dryhop' /
  // 'Dry Hop'). A device on localStorage or an old backup file still carries
  // them, and they must keep printing as charge 1.
  it('reads legacy unnumbered dry hops as charge 1', () => {
    const s = buildCellarSheet(recipe, '2026-07-01');
    expect(s.dryHop.charges).toHaveLength(1);
    const [c] = s.dryHop.charges;
    expect(c.charge).toBe(1);
    expect(c.date).toBe('Mon 7/13'); // day 12
    expect(c.items).toEqual([
      { name: 'Cascade', qty: 48 }, { name: 'Mosaic', qty: 48 }, { name: 'Simcoe', qty: 16 },
    ]);
  });

  // The point of numbering: a double dry hop is two charges on two days, and
  // each hop has to print against ITS day.
  it('gives each dry-hop charge its own date', () => {
    const dbl = {
      ...recipe,
      h: [
        ['Cascade', 12, 'boil', 10],
        ['Cascade', 48, 'dryhop1', 0],
        ['Mosaic', 48, 'dryhop1', 0],
        ['Citra', 32, 'dryhop2', 0],
      ],
      sc: [[0, 'Brew Date'], [12, 'Dry Hop 1'], [15, 'Dry Hop 2'], [20, 'Keg']],
    };
    const { charges } = buildCellarSheet(dbl, '2026-07-01').dryHop;
    expect(charges).toHaveLength(2);
    expect(charges[0]).toMatchObject({
      charge: 1,
      date: 'Mon 7/13',
      items: [{ name: 'Cascade', qty: 48 }, { name: 'Mosaic', qty: 48 }],
    });
    expect(charges[1]).toMatchObject({
      charge: 2,
      date: 'Thu 7/16',
      items: [{ name: 'Citra', qty: 32 }],
    });
  });

  it('prints a scheduled charge even when no hops are listed for it', () => {
    const sheet = buildCellarSheet({
      ...recipe, h: [], sc: [[0, 'Brew Date'], [14, 'Dry Hop 2']],
    }, '2026-07-01');
    expect(sheet.dryHop.charges).toEqual([
      { charge: 2, items: [], dates: ['Wed 7/15'], date: 'Wed 7/15' },
    ]);
  });

  it('omits a charge that has neither hops nor a scheduled day', () => {
    const sheet = buildCellarSheet({
      ...recipe,
      h: [['Citra', 32, 'dryhop3', 0]],
      sc: [[0, 'Brew Date'], [18, 'Dry Hop 3']],
    }, '2026-07-01');
    expect(sheet.dryHop.charges.map((c) => c.charge)).toEqual([3]);
  });

  it('carries yeast strains', () => {
    expect(buildCellarSheet(recipe).yeast).toEqual([{ name: 'K97', qty: 1 }]);
  });

  it('carries the fermentation temp, null when unset', () => {
    expect(buildCellarSheet({ ...recipe, ft: 68 }).fermTemp).toBe(68);
    expect(buildCellarSheet(recipe).fermTemp).toBeNull();
  });

  it('keeps only off-brew-day adjuncts as misc additions, labelled with their stage', () => {
    const s = buildCellarSheet(recipe);
    expect(s.misc).toEqual([
      { name: 'Mango Puree', qty: 18, unit: 'lbs', stage: 'secondary', stageLabel: 'Secondary', date: null },
    ]);
  });

  it('dates a misc addition from the stage\'s scheduled step, where there is one', () => {
    const r = {
      ...recipe,
      a: [
        ['Mango Puree', 18, 'lbs', 'secondary', 0],   // no scheduled step — write-in
        ['Gelatin', 2, 'oz', 'transfer', 0],          // Transfer, day 19
      ],
    };
    const misc = buildCellarSheet(r, '2026-07-01').misc;
    expect(misc.map((m) => [m.name, m.date])).toEqual([
      ['Mango Puree', null],
      ['Gelatin', 'Mon 7/20'],
    ]);
  });

  it('orders misc additions by where they fall in the process', () => {
    const r = {
      ...recipe,
      a: [
        ['Gelatin', 2, 'oz', 'transfer', 0],
        ['Mango Puree', 18, 'lbs', 'secondary', 0],
        ['Clarity Ferm', 125, 'ml', 'fermentation', 0],
        ['Sugar', 1, 'lbs', 'keg', 0],
      ],
    };
    expect(buildCellarSheet(r).misc.map((m) => m.name))
      .toEqual(['Clarity Ferm', 'Mango Puree', 'Gelatin', 'Sugar']);
  });

  it('labels a stage it does not know and leaves it in recipe order at the end', () => {
    const r = { ...recipe, a: [['Oak Cubes', 4, 'oz', 'barrel aging', 0], ['Mango Puree', 18, 'lbs', 'secondary', 0]] };
    const misc = buildCellarSheet(r).misc;
    expect(misc.map((m) => m.stageLabel)).toEqual(['Secondary', 'Barrel Aging']);
  });

  it('routes rouse dates', () => {
    expect(buildCellarSheet(recipe, '2026-07-01').rouse).toEqual(['Tue 7/14']); // day 13
  });

  it('routes the carb date, null when unscheduled', () => {
    const withCarb = { ...recipe, sc: [...recipe.sc, [21, 'Carb']] };
    expect(buildCellarSheet(withCarb, '2026-07-01').carb).toBe('Wed 7/22'); // day 21
    expect(buildCellarSheet(recipe, '2026-07-01').carb).toBeNull();
  });

  it('handles a recipe with an empty schedule', () => {
    const s = buildCellarSheet({ n: 'X', s: 'Y', m: [], h: [], y: [], a: [], sc: [] }, '2026-07-01');
    expect(s.schedule).toEqual([]);
    expect(s.coldCrash).toEqual([]);
    expect(s.bung).toBeNull();
    expect(s.dryHop.charges).toEqual([]);
  });
});
