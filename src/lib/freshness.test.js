import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setBackend, resetBackend } from './repo';
import { checkFreshness, getStale, subscribe, watchFreshness, resetFreshness } from './freshness';

const backendReporting = (keys, extra = {}) => ({
  load: (k, fb) => fb,
  save: () => {},
  staleKeys: async () => keys,
  ...extra,
});

beforeEach(() => resetFreshness());
afterEach(() => resetBackend());

describe('checkFreshness', () => {
  it('records the keys the backend reports as moved', async () => {
    setBackend(backendReporting(['recipes']));
    await checkFreshness();
    expect(getStale()).toEqual(['recipes']);
  });

  it('is empty when nothing has moved', async () => {
    setBackend(backendReporting([]));
    await checkFreshness();
    expect(getStale()).toEqual([]);
  });

  // A backend that doesn't implement staleKeys (an old fake, a test double)
  // simply never goes stale — the check must not throw at it.
  it('treats a backend without staleKeys as fresh', async () => {
    setBackend({ load: (k, fb) => fb, save: () => {} });
    await checkFreshness();
    expect(getStale()).toEqual([]);
  });

  // Offline, or a database that predates the version table. This is a
  // background nicety; an error banner about the freshness check itself would
  // be noise on top of whatever actually broke.
  it('stays quiet when the check itself fails', async () => {
    setBackend(backendReporting(null, { staleKeys: async () => { throw new Error('offline'); } }));
    await expect(checkFreshness()).resolves.toEqual([]);
    expect(getStale()).toEqual([]);
  });

  it('notifies subscribers only when the answer changes', async () => {
    setBackend(backendReporting(['recipes']));
    const seen = vi.fn();
    const unsub = subscribe(seen);

    await checkFreshness();
    await checkFreshness();   // same answer — no second notification
    expect(seen).toHaveBeenCalledTimes(1);
    unsub();
  });

  it('collapses concurrent checks', async () => {
    const staleKeys = vi.fn(async () => ['malts']);
    setBackend(backendReporting(null, { staleKeys }));
    await Promise.all([checkFreshness(), checkFreshness(), checkFreshness()]);
    expect(staleKeys).toHaveBeenCalledTimes(1);
  });
});

describe('watchFreshness', () => {
  it('checks when the tab comes back into view, and stops when torn down', async () => {
    const staleKeys = vi.fn(async () => []);
    setBackend(backendReporting(null, { staleKeys }));

    const stop = watchFreshness();
    window.dispatchEvent(new Event('focus'));
    await Promise.resolve();
    expect(staleKeys).toHaveBeenCalledTimes(1);

    stop();
    window.dispatchEvent(new Event('focus'));
    await Promise.resolve();
    expect(staleKeys).toHaveBeenCalledTimes(1);
  });

  // A background tab nobody is reading doesn't need to know it's out of date;
  // the moment someone turns back to it is when a wrong list starts to matter.
  it('ignores a visibility change that hides the tab', async () => {
    const staleKeys = vi.fn(async () => []);
    setBackend(backendReporting(null, { staleKeys }));
    const stop = watchFreshness();

    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    await Promise.resolve();
    expect(staleKeys).not.toHaveBeenCalled();

    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    await Promise.resolve();
    expect(staleKeys).toHaveBeenCalledTimes(1);

    hidden.mockRestore();
    stop();
  });
});
