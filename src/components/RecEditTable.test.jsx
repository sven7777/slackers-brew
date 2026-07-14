import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RecEditTable from './RecEditTable';

// Regression: a recipe saved before a category existed (stale localStorage)
// has no array for it — the table must render as empty, not crash, and adding
// an ingredient must materialize the array.
describe('RecEditTable with a missing ingredient array', () => {
  const props = {
    cat: 'sa', names: ['CaCl2', 'CaSo4'], unit: 'g', ri: 0,
    addSel: { sa: '' }, setAddSel: vi.fn(),
  };

  it('renders empty instead of crashing when items is undefined', () => {
    render(<RecEditTable {...props} setRecs={vi.fn()} />);
    expect(screen.getByText('Add salt...')).toBeInTheDocument();
  });

  it('addItem materializes the missing array on the recipe', () => {
    let recs = [{ n: 'Old Recipe' }]; // no `sa` key at all
    const setRecs = (fn) => { recs = fn(recs); };
    render(<RecEditTable {...props} addSel={{ sa: 'CaCl2' }} setRecs={setRecs} />);
    fireEvent.click(screen.getByText('+ Add'));
    expect(recs[0].sa).toEqual([['CaCl2', 0, 'mash']]);
  });
});
