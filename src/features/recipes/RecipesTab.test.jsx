import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
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
