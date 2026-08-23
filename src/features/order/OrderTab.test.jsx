import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OrderTab from './OrderTab';

// The list reads alphabetically while `orders` stays aligned to `recs` by
// stored index. A checkbox that toggled its rank instead of its index would
// select a different beer than the one clicked — silently, and only for
// breweries whose recipe list isn't already sorted.
describe('OrderTab alphabetical recipe list', () => {
  const recs = [
    { n: 'Wicked Tickle', s: 'American Porter', m: [], h: [], y: [], a: [] },
    { n: 'All Y’alls', s: 'NEIPA', m: [], h: [], y: [], a: [] },
    { n: 'james', s: 'American Brown Ale', m: [], h: [], y: [], a: [] },
  ];
  const inv = { malts: [], hops: [], yeast: [], adj: [] };
  const blank = recs.map(() => ({ sel: false, dbl: false }));

  const renderTab = (orders = blank, setOrders = vi.fn()) =>
    render(<OrderTab orders={orders} setOrders={setOrders} recs={recs} {...inv} />);

  it('lists the recipes by name, ignoring case', () => {
    renderTab();
    const names = screen.getAllByRole('checkbox').map((cb) => cb.closest('div').textContent);
    expect(names).toEqual([
      'All Y’alls (NEIPA)',
      'james (American Brown Ale)',
      'Wicked Tickle (American Porter)',
    ]);
  });

  it('toggles the stored recipe the row came from, not its rank', () => {
    let orders = blank;
    renderTab(orders, (fn) => { orders = fn(orders); });
    // Second row on screen is "james", stored at index 2.
    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    expect(orders.map((o) => o.sel)).toEqual([false, false, true]);
  });

  it('shows the Double toggle against the selected row', () => {
    // "All Y’alls" is stored at index 1 and sorts first.
    renderTab([{ sel: false, dbl: false }, { sel: true, dbl: false }, { sel: false, dbl: false }]);
    const rows = screen.getAllByText(/Single|Double/);
    expect(rows).toHaveLength(1);
    expect(rows[0].closest('div').textContent).toContain('All Y’alls');
  });
});
