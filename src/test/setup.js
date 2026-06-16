// Vitest global setup: adds jest-dom matchers and installs a complete in-memory
// localStorage. The Node/jsdom combo in this environment exposes a localStorage
// whose clear() is unavailable, so we stub a full Storage implementation to keep
// tests deterministic and isolated.
import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

function createMemoryStorage() {
  const store = new Map();
  return {
    get length() { return store.size; },
    key: (i) => Array.from(store.keys())[i] ?? null,
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(String(k), String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => { store.clear(); },
  };
}

vi.stubGlobal('localStorage', createMemoryStorage());

afterEach(() => {
  cleanup();
  localStorage.clear();
});
