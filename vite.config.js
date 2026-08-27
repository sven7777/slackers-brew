import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    open: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    environmentOptions: {
      jsdom: { url: 'http://localhost' },
    },
    setupFiles: './src/test/setup.js',
    css: false,
    // Vitest's 5s default is a budget for app BEHAVIOUR, and these tests spend
    // it on jsdom's DOM-creation speed instead. App.test.jsx renders the whole
    // app ten times over, and the Inventory tab alone is four tables, ~55 rows
    // and ~275 cells. Adding one button per row (the archive control) measured
    // +2.6s across that file — the buttons account for all of it; the extra
    // table cell and its title attribute cost nothing — which was enough to tip
    // the first test past 5s on a loaded machine while it still passed on an
    // idle one. A flaky timeout teaches people to re-run CI rather than read
    // it, so the budget goes where the cost actually is.
    testTimeout: 20000,
  },
})
