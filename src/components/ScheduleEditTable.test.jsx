import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ScheduleEditTable from './ScheduleEditTable';

// Rows re-sort by day when a day input is committed (on blur, not per
// keystroke, so a row doesn't jump away while a multi-digit day is typed).
describe('ScheduleEditTable day ordering', () => {
  const props = { ri: 0, addSel: { sc: '' }, setAddSel: vi.fn() };

  const setup = (sc) => {
    let recs = [{ n: 'Test', sc }];
    const setRecs = (fn) => { recs = fn(recs); };
    render(<ScheduleEditTable {...props} items={recs[0].sc} setRecs={setRecs} />);
    return () => recs;
  };

  it('sorts rows by day when a day input blurs', () => {
    const recs = setup([[14, 'Keg'], [3, 'Dry Hop'], [7, 'Cold Crash']]);
    const dayInput = screen.getAllByRole('spinbutton')[0];
    fireEvent.blur(dayInput);
    expect(recs()[0].sc).toEqual([[3, 'Dry Hop'], [7, 'Cold Crash'], [14, 'Keg']]);
  });

  it('keeps same-day rows in edit order (stable sort)', () => {
    const recs = setup([[7, 'Rouse'], [3, 'Dry Hop'], [7, 'Cold Crash']]);
    fireEvent.blur(screen.getAllByRole('spinbutton')[0]);
    expect(recs()[0].sc).toEqual([[3, 'Dry Hop'], [7, 'Rouse'], [7, 'Cold Crash']]);
  });

  it('does not change state when rows are already in order', () => {
    let recs = [{ n: 'Test', sc: [[3, 'Dry Hop'], [7, 'Cold Crash']] }];
    const before = recs;
    const setRecs = (fn) => { recs = fn(recs); };
    render(<ScheduleEditTable {...props} items={recs[0].sc} setRecs={setRecs} />);
    fireEvent.blur(screen.getAllByRole('spinbutton')[0]);
    expect(recs).toBe(before);
  });

  it('does not re-sort on keystrokes while typing a day', () => {
    const recs = setup([[14, 'Keg'], [3, 'Dry Hop']]);
    const dayInput = screen.getAllByRole('spinbutton')[0];
    // Typing "2" into the day-14 row: value updates in place, order unchanged.
    fireEvent.change(dayInput, { target: { value: '2' } });
    expect(recs()[0].sc).toEqual([[2, 'Keg'], [3, 'Dry Hop']]);
  });
});

// The rows stay in day order — that IS the schedule — so the alphabetical ask
// lands on the action pickers.
describe('ScheduleEditTable alphabetical action pickers', () => {
  const props = { ri: 0, addSel: { sc: '' }, setAddSel: vi.fn() };

  it('lists actions alphabetically in the add picker', () => {
    render(<ScheduleEditTable {...props} items={[]} setRecs={vi.fn()} />);
    const opts = [...screen.getByRole('combobox').options].map((o) => o.text);
    expect(opts[0]).toBe('Add step...');
    expect(opts.slice(1)).toEqual([...opts.slice(1)].sort((a, b) => a.localeCompare(b)));
    expect(opts.slice(1, 4)).toEqual(['Blow Off', 'Brew Date', 'Bung | Pressure']);
  });

  it('still offers a stored action the catalog no longer lists', () => {
    render(<ScheduleEditTable {...props} items={[[3, 'Krausen Skim']]} setRecs={vi.fn()} />);
    const rowSel = screen.getAllByRole('combobox')[0];
    expect(rowSel.value).toBe('Krausen Skim');
    expect([...rowSel.options].map((o) => o.text)).toContain('Krausen Skim');
  });
});
