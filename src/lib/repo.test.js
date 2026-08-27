import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { load, save, setBackend, resetBackend, getBackend, staleKeys } from './repo';
import { localStorageBackend } from './storage';

beforeEach(() => localStorage.clear());
afterEach(() => resetBackend());

describe('default backend', () => {
  it('is the localStorage backend', () => {
    expect(getBackend()).toBe(localStorageBackend);
  });

  it('round-trips values through localStorage', () => {
    save('settings', { name: 'Hop Haus' });
    expect(load('settings', null)).toEqual({ name: 'Hop Haus' });
    expect(localStorage.getItem('slackers_brew_settings')).toBe('{"name":"Hop Haus"}');
  });

  it('returns the fallback when a key is absent', () => {
    expect(load('missing', 42)).toBe(42);
  });
});

describe('setBackend', () => {
  it('routes load/save through the swapped backend', () => {
    const store = new Map();
    setBackend({
      load: (k, fb) => (store.has(k) ? store.get(k) : fb),
      save: (k, v) => store.set(k, v),
    });

    save('malts', [{ n: 'Pilsner', q: 5 }]);

    // The fake backend got the write; localStorage was untouched.
    expect(store.get('malts')).toEqual([{ n: 'Pilsner', q: 5 }]);
    expect(load('malts', null)).toEqual([{ n: 'Pilsner', q: 5 }]);
    expect(localStorage.getItem('slackers_brew_malts')).toBeNull();
  });

  it('resetBackend restores the localStorage default', () => {
    setBackend({ load: () => 'fake', save: () => {} });
    resetBackend();
    expect(getBackend()).toBe(localStorageBackend);
  });
});

// Two tabs on one origin share a localStorage, so the stale-tab problem exists
// on this backend too — and there the stored string IS the version.
describe('staleKeys', () => {
  it('reports a key another tab has written since this one read it', async () => {
    save('recipes', [{ n: 'Mine' }]);
    load('recipes', null);                                    // this tab reads
    expect(await staleKeys()).toEqual([]);

    localStorage.setItem('slackers_brew_recipes', JSON.stringify([{ n: 'Theirs' }]));
    expect(await staleKeys()).toEqual(['recipes']);
  });

  it("doesn't call a tab's own writes stale", async () => {
    load('malts', []);
    save('malts', [{ n: 'Pils', q: 1 }]);
    expect(await staleKeys()).toEqual([]);
  });

  it('ignores keys this tab never read', async () => {
    localStorage.setItem('slackers_brew_orders', JSON.stringify([1, 2, 3]));
    expect(await staleKeys()).toEqual([]);
  });

  it('is empty for a backend that does not implement it', async () => {
    setBackend({ load: (k, fb) => fb, save: () => {} });
    expect(await staleKeys()).toEqual([]);
  });
});
