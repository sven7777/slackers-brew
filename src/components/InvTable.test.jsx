import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import InvTable from './InvTable';

const items = [
  { n: '2-Row', q: 100, cpu: 0.72 },
  { n: 'Chocolate', q: 10 },   // unpriced
];

const props = { items, unit: 'lbs', category: 'malt', costUnit: 'lb' };

describe('InvTable pricing column', () => {
  it('shows the stored price and what the stock is worth', () => {
    render(<InvTable {...props} setter={vi.fn()} setInvCost={vi.fn()} />);
    expect(screen.getByLabelText('Cost per lb of 2-Row')).toHaveValue(0.72);
    expect(screen.getByText('$72.00')).toBeInTheDocument();
  });

  it('says "unpriced" instead of $0.00 for a row with no price', () => {
    render(<InvTable {...props} setter={vi.fn()} setInvCost={vi.fn()} />);
    expect(screen.getByText('unpriced')).toBeInTheDocument();
    expect(screen.getByLabelText('Cost per lb of Chocolate')).toHaveValue(null);
  });

  it('writes an edited price through setInvCost, by name and category', () => {
    const setInvCost = vi.fn();
    render(<InvTable {...props} setter={vi.fn()} setInvCost={setInvCost} />);
    fireEvent.change(screen.getByLabelText('Cost per lb of Chocolate'), { target: { value: '1.85' } });
    expect(setInvCost).toHaveBeenCalledWith('malt', 'Chocolate', '1.85', undefined);
  });

  it('still edits quantity by index', () => {
    let rows = items;
    const setter = (fn) => { rows = fn(rows); };
    render(<InvTable {...props} setter={setter} setInvCost={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('On hand, Chocolate'), { target: { value: '25' } });
    expect(rows[1]).toEqual({ n: 'Chocolate', q: 25 });
    expect(rows[0].q).toBe(100);
  });
});

// Adjuncts have no single unit — each row carries its own (lbs/oz/ml/each), and
// the price is quoted in that, so the label has to follow the row.
describe('InvTable with per-row units', () => {
  it('labels each price with the row unit and passes it along', () => {
    const setInvCost = vi.fn();
    render(
      <InvTable
        items={[{ n: 'Lactose', q: 5, cpu: 1.33, u: 'lbs' }, { n: 'Lactic Acid', q: 500, u: 'ml' }]}
        setter={vi.fn()} unit="" category="adj" setInvCost={setInvCost} />
    );
    expect(screen.getByLabelText('Cost per lbs of Lactose')).toHaveValue(1.33);
    fireEvent.change(screen.getByLabelText('Cost per ml of Lactic Acid'), { target: { value: '0.05' } });
    expect(setInvCost).toHaveBeenCalledWith('adj', 'Lactic Acid', '0.05', 'ml');
  });
});
