# Slackers Brew

[![CI](https://github.com/sven7777/slackers-brew/actions/workflows/ci.yml/badge.svg)](https://github.com/sven7777/slackers-brew/actions/workflows/ci.yml)

A brewery inventory and order-management tool for tracking ingredient
stock and calculating the quantities needed to brew a set of recipes. Built for
Slackers Brewing. Data persists through a swappable backend: it runs
entirely in your browser on localStorage by default, or against a shared
Supabase backend (with login) when that's configured — the app is the same
either way.

## Features

- **Inventory** — track on-hand stock of malts (lbs), hops (oz), yeast (packs),
  and adjuncts (per-item units).
- **Recipes** — pick a recipe once, then switch between four views of it:
  - **Edit** — name, style, target gravities, mash and fermentation temps, plus
    the ingredient lists per recipe; add or remove ingredients across malts,
    hops, yeast, and adjuncts; edit the per-recipe cellar schedule; import
    recipes straight from a BeerSmith `.bsmx` file. Style is picked from the
    BJCP style list, or typed in for a house style.
  - **Brew Sheet** — generate a printable brew-day sheet, with staged
    additions, mash details, water salts, and planned process readings in a
    Target / Actual layout to fill in by pen (single or double batch).
  - **Cellar Sheet** — generate a printable post-brew cellar log. Enter a brew
    date and the recipe's day-offset schedule auto-fills every dated box (cold
    crash, bung, dry hop, rouse, transfer, carb, keg) alongside its yeast, dry-hop
    varieties, and cellar additions. Dry hopping is charged: hops assigned to
    **Dry Hop 1/2/3** print against their own charge's scheduled day, so a double
    dry hop shows two dates. Misc. additions print the stage they go in at, the
    scheduled date where there is one, and a box to tick once they're in.
  - **Cost** — ingredient COGS for the recipe: batch total, cost per barrel, per
    keg and per 16 oz pint, with per-category subtotals and an editable cost per
    unit on each ingredient. Per-volume figures are of *packaged* beer, from the
    post-boil yield less brewhouse loss — or from the recipe's own measured
    average keg yield when one is set.
- **Order Calculator** — select recipes (single or double batch) and get a
  computed order summary: how much you need, how much you have, and how much to
  order. Malts also roll up into 55 lb bag counts.
- **Settings** — brewery identity (name, tagline, logo), the default batch
  volume and brewhouse loss that drive costing, ingredient pricing (upload the
  vendor's PDF price list, see exactly which prices would change, then apply), and a
  full export/import of all app data as JSON.

## Running Locally

**Prerequisites:** Node.js 22+ (see [.nvmrc](.nvmrc)) and npm installed.
The test suite requires Node 22 — jsdom 30 does not run on 20.

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
- **ESLint 10** (flat config)
- **Vitest 4** + Testing Library for tests (Node 22+)
- Plain JSX — no TypeScript
- **localStorage** by default, or **Supabase** (Postgres + Auth) when configured

## Data & Privacy

In the default localStorage mode, all inventory, recipe, and order data lives in
your browser under keys prefixed `slackers_brew_` and nothing is sent to a
server; clearing your browser data resets the app to its default ingredient and
recipe lists. When the Supabase backend is configured, that data is instead
stored in a shared Postgres database behind a login, so it syncs across devices
and brewers.

Ingredient **prices are never committed to this repository** — vendor price
lists are confidential. They live only in the configured database (or your own
browser), and are loaded through the price import in Settings.

## License

[MIT](LICENSE) — free to use, modify, and distribute.
