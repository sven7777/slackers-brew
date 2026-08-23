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

// Rows read alphabetically, but every edit still addresses the row's position
// in the STORED array. Getting that wrong silently edits the wrong ingredient,
// which is why each of these asserts on the recipe data, not the screen.
describe('RecEditTable alphabetical display order', () => {
  const hops = [
    ['Cascade', 12, 'boil', 10],
    ['Amarillo', 16, 'boil', 7.5],
    ['CTZ', 4, 'boil', 60],
    ['Cascade', 48, 'dryhop1', 0],
  ];
  const props = {
    cat: 'h', names: ['Simcoe', 'Amarillo', 'CTZ', 'Cascade'], unit: 'oz', ri: 0,
    addSel: { h: '' }, setAddSel: vi.fn(),
  };
  const renderTable = (items, setRecs = vi.fn()) =>
    render(<RecEditTable {...props} items={items} setRecs={setRecs} />);

  const nameCells = () =>
    screen.getAllByRole('row').slice(1).map((tr) => tr.querySelector('td').textContent);

  it('sorts rows by name, case-insensitively', () => {
    renderTable(hops);
    expect(nameCells()).toEqual(['Amarillo', 'Cascade', 'Cascade', 'CTZ']);
  });

  it('keeps repeats of one hop in their stored stage order', () => {
    renderTable(hops);
    const qtys = screen.getAllByRole('spinbutton').map((i) => i.value);
    // Amarillo 16, then the two Cascades in stored order (boil 12, dry hop 48),
    // then CTZ 4 — interleaved with each row's Min input.
    expect(qtys).toEqual(['16', '7.5', '12', '10', '48', '0', '4', '60']);
  });

  it('edits the stored row the display row came from, not its rank', () => {
    let recs = [{ h: structuredClone(hops) }];
    renderTable(hops, (fn) => { recs = fn(recs); });
    // First row on screen is Amarillo, stored at index 1.
    fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '20' } });
    expect(recs[0].h[1]).toEqual(['Amarillo', 20, 'boil', 7.5]);
    expect(recs[0].h[0]).toEqual(['Cascade', 12, 'boil', 10]);
  });

  it('removes the stored row the × belongs to', () => {
    let recs = [{ h: structuredClone(hops) }];
    renderTable(hops, (fn) => { recs = fn(recs); });
    // Last row on screen is CTZ, stored at index 2.
    const removes = screen.getAllByTitle('Remove');
    fireEvent.click(removes[removes.length - 1]);
    expect(recs[0].h.map((t) => t[0])).toEqual(['Cascade', 'Amarillo', 'Cascade']);
  });

  it('sorts the add picker too', () => {
    renderTable(hops);
    // Each row has a Stage select; the picker is the last combobox on screen.
    const selects = screen.getAllByRole('combobox');
    const opts = [...selects[selects.length - 1].options].map((o) => o.text);
    expect(opts).toEqual(['Add ingredient...', 'Amarillo', 'Cascade', 'CTZ', 'Simcoe']);
  });
});
