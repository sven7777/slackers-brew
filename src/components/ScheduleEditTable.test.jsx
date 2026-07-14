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
