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

// Which vendor product a row is priced by has always been stored and never
// shown, so a row pointing at NOTHING — and therefore costed at nothing forever
// — was invisible. Prod carried "Candi Sugar, Dark" exactly like that.
//
// ⚠️ Shown only where there is something to do about it. Two earlier attempts
// were both wrong on screen: a Product column of its own pushed these tables
// past the 442px each card gets and shoved the archive button off the right
// edge, and printing the SKU beside every name wrapped 53 of 55 rows onto two
// lines. A mapped row now looks exactly as it always did and carries its
// product in the tooltip.
describe('InvTable product linking', () => {
  it('shows no control at all when linking is not wired up', () => {
    render(<InvTable {...props} setter={vi.fn()} setInvCost={vi.fn()} />);
    expect(screen.queryByText('Link…')).not.toBeInTheDocument();
  });

  it('leaves a mapped row exactly as it was, product in the tooltip', () => {
    render(<InvTable {...props} setter={vi.fn()} setInvCost={vi.fn()} onLink={vi.fn()} />);
    expect(screen.getByText('2-Row')).toHaveAttribute('title', 'Priced as MRAH1102');
    expect(screen.queryByText('Link…')).not.toBeInTheDocument();
  });

  // ⚠️ A control only where the row's own SKU decides. products.js wins for
  // every name it maps, so offering to change those would offer something that
  // does nothing.
  it('offers Link… on a row nothing maps, and reports the whole row', () => {
    const onLink = vi.fn();
    render(<InvTable items={[{ n: 'Candi Syrup', q: 45, u: 'lbs' }, { n: 'Candi Sugar, Dark', q: 0, u: 'each' }]}
      unit="" category="adj" setter={vi.fn()} setInvCost={vi.fn()} onLink={onLink} />);
    expect(screen.getAllByText('Link…')).toHaveLength(1);
    fireEvent.click(screen.getByText('Link…'));
    expect(onLink).toHaveBeenCalledWith('adj', { n: 'Candi Sugar, Dark', q: 0, u: 'each' });
  });

  // ⚠️ The words are for a row with NO product. Once one is linked (or
  // adopted, which is the same row shape), the control stops printing the
  // vendor's code in the ingredient column and carries it in the tooltip —
  // like every mapped row — leaving only the faint chain that makes a wrong
  // link fixable.
  it('drops the SKU out of the name cell once a row is linked', () => {
    const onLink = vi.fn();
    render(<InvTable items={[{ n: 'Candi Sugar, Dark', q: 0, u: 'lbs', sku: 'AZZZ1771' }]}
      unit="" category="adj" setter={vi.fn()} setInvCost={vi.fn()} onLink={onLink} />);
    expect(screen.queryByText('AZZZ1771')).not.toBeInTheDocument();
    expect(screen.queryByText('Link…')).not.toBeInTheDocument();
    expect(screen.getByText('Candi Sugar, Dark')).toHaveAttribute('title', 'Priced as AZZZ1771');

    const relink = screen.getByLabelText('Change the vendor product for Candi Sugar, Dark');
    expect(relink).toHaveAttribute('title', 'Priced as AZZZ1771 — change which product Candi Sugar, Dark is');
    fireEvent.click(relink);
    expect(onLink).toHaveBeenCalledWith('adj', { n: 'Candi Sugar, Dark', q: 0, u: 'lbs', sku: 'AZZZ1771' });
  });
});
