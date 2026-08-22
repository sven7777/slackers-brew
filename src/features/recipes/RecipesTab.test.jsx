import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RecipesTab from './RecipesTab';

// Regression for the 2026-07-14 white screen: selR is device-local while the
// recipe list is shared, so a stale index can point past the list (shorter
// fallback during an async load, or a shrunken list after cleanup). The tab
// must render nothing for that frame and snap the selection back, not crash
// reading recs[selR].og.
describe('RecipesTab with an out-of-range selection', () => {
  const recs = [{ n: 'Only Beer', s: 'Ale', m: [], h: [], y: [], a: [], sa: [], sc: [] }];

  it('renders nothing and resets selR instead of crashing', async () => {
    const setSelR = vi.fn();
    const { container } = render(
      <RecipesTab recs={recs} setRecs={vi.fn()} selR={20} setSelR={setSelR} />
    );
    expect(container).toBeEmptyDOMElement();
    await waitFor(() => expect(setSelR).toHaveBeenCalledWith(0));
  });

  it('renders normally when the selection is in range', () => {
    const { container } = render(
      <RecipesTab recs={recs} setRecs={vi.fn()} selR={0} setSelR={vi.fn()} />
    );
    expect(container).not.toBeEmptyDOMElement();
  });
});

// A recipe's style had no input anywhere: presets carried one, but an imported
// recipe arrived styleless (the .bsmx parser couldn't read BeerSmith's nested
// style record) and there was no way to type one in — the picker just showed
// "Beachbomber — ".
describe('RecipesTab name and style fields', () => {
  const recs = [{ n: 'Beachbomber', s: '', m: [], h: [], y: [], a: [], sa: [], sc: [] }];

  it('edits the name as free text', () => {
    const setRecs = vi.fn();
    render(<RecipesTab recs={recs} setRecs={setRecs} selR={0} setSelR={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Beachbomber v2' } });
    expect(setRecs.mock.calls[0][0](recs)[0].n).toBe('Beachbomber v2');
  });

  // A recipe is picked by name, so an empty one mid-edit must not render as a
  // blank, unpickable option.
  it('labels a nameless recipe in the picker', () => {
    render(<RecipesTab recs={[{ ...recs[0], n: '  ', s: 'Witbier' }]} setRecs={vi.fn()} selR={0} setSelR={vi.fn()} />);
    expect(screen.getByRole('option', { name: /\(untitled\) — Witbier/ })).toBeInTheDocument();
  });

  it('picks the style from the catalog', () => {
    const setRecs = vi.fn();
    render(<RecipesTab recs={recs} setRecs={setRecs} selR={0} setSelR={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Style'), { target: { value: 'Belgian Dark Strong Ale' } });
    const updater = setRecs.mock.calls[0][0];
    expect(updater(recs)[0].s).toBe('Belgian Dark Strong Ale');
  });

  it('shows the current style', () => {
    render(<RecipesTab recs={[{ ...recs[0], s: 'Witbier' }]} setRecs={vi.fn()} selR={0} setSelR={vi.fn()} />);
    expect(screen.getByLabelText('Style')).toHaveValue('Witbier');
  });
});
