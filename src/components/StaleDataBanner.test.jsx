import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import StaleDataBanner from './StaleDataBanner';
import { setBackend, resetBackend } from '../lib/repo';
import { checkFreshness, resetFreshness } from '../lib/freshness';

const backendReporting = (keys) => ({ load: (k, fb) => fb, save: () => {}, staleKeys: async () => keys });

beforeEach(() => resetFreshness());
afterEach(() => resetBackend());

describe('StaleDataBanner', () => {
  it('renders nothing while the page is current', async () => {
    setBackend(backendReporting([]));
    render(<StaleDataBanner />);
    await act(() => checkFreshness());
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('names what changed, in brewer language rather than storage keys', async () => {
    setBackend(backendReporting(['recipes', 'malts']));
    render(<StaleDataBanner />);
    await act(() => checkFreshness());

    expect(screen.getByRole('status')).toHaveTextContent('This page is out of date.');
    expect(screen.getByRole('status')).toHaveTextContent('Recipes and Malt inventory');
  });

  it('reloads on request', async () => {
    setBackend(backendReporting(['recipes']));
    const onReload = vi.fn();
    render(<StaleDataBanner onReload={onReload} />);
    await act(() => checkFreshness());

    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(onReload).toHaveBeenCalled();
  });

  // It reports; it never refetches. Silently swapping data under an open editor
  // would throw away whatever is half-typed.
  it('offers no way to merge or auto-refresh', async () => {
    setBackend(backendReporting(['recipes']));
    render(<StaleDataBanner onReload={vi.fn()} />);
    await act(() => checkFreshness());
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
});
