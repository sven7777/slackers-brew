# Slackers Brew

[![CI](https://github.com/sven7777/slackers-brew/actions/workflows/ci.yml/badge.svg)](https://github.com/sven7777/slackers-brew/actions/workflows/ci.yml)

A homebrew inventory and order-management tool for tracking brewery ingredient
stock and calculating the quantities needed to brew a set of recipes. Built for
the Slackers brewing group. Data persists through a swappable backend: it runs
entirely in your browser on localStorage by default, or against a shared
Supabase backend (with login) when that's configured — the app is the same
either way.

## Features

- **Inventory** — track on-hand stock of malts (lbs), hops (oz), yeast (packs),
  and adjuncts (per-item units).
- **Recipes** — pick a recipe once, then switch between three views of it:
  - **Edit** — view and edit ingredient lists per recipe; add or remove
    ingredients across malts, hops, yeast, and adjuncts; edit the per-recipe
    cellar schedule; import recipes straight from a BeerSmith `.bsmx` file.
  - **Brew Sheet** — generate a printable brew-day sheet, with staged
    additions, mash details, and water salts (single or double batch).
  - **Cellar Sheet** — generate a printable post-brew cellar log. Enter a brew
    date and the recipe's day-offset schedule auto-fills every dated box (cold
    crash, bung, dry hop, rouse, transfer, keg) alongside its yeast, dry-hop
    varieties, and cellar additions.
- **Order Calculator** — select recipes (single or double batch) and get a
  computed order summary: how much you need, how much you have, and how much to
  order. Malts also roll up into 55 lb bag counts.

## Running Locally

**Prerequisites:** Node.js (v20+) and npm installed.

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

The app will be available at `http://localhost:5173`.

Other useful commands:

```bash
npm run build    # Build for production
npm run preview  # Preview the production build locally
npm run lint     # Run ESLint
npm test         # Run the Vitest suite
```

By default the app runs fully local on localStorage with no setup. To use the
shared Supabase backend, provide `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
in a `.env` file (see [supabase/README.md](supabase/README.md)); without them the
app stays on localStorage.

## Tech Stack

- **React 19** with hooks (no state-management or routing library)
- **Vite 8** build tooling
- **ESLint 9** (flat config)
- **Vitest** + Testing Library for tests
- Plain JSX — no TypeScript
- **localStorage** by default, or **Supabase** (Postgres + Auth) when configured

## Data & Privacy

In the default localStorage mode, all inventory, recipe, and order data lives in
your browser under keys prefixed `slackers_brew_` and nothing is sent to a
server; clearing your browser data resets the app to its default ingredient and
recipe lists. When the Supabase backend is configured, that data is instead
stored in a shared Postgres database behind a login, so it syncs across devices
and brewers.

## License

[MIT](LICENSE) — free to use, modify, and distribute.
