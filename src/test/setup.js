// Vitest global setup: adds jest-dom matchers (toBeInTheDocument, etc.) and
// clears localStorage between tests so persisted state never leaks across them.
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  if (typeof localStorage !== 'undefined' && typeof localStorage.clear === 'function') {
    localStorage.clear();
  }
});
