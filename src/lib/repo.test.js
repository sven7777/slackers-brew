import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { load, save, setBackend, resetBackend, getBackend } from './repo';
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
