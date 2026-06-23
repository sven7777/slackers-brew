# Slackers Brewing — CLAUDE.md

## Project Overview

React-based homebrew brewery inventory and order management tool for the Slackers brewing group. Tracks ingredient stock (malts, hops, yeast, adjuncts) and calculates order quantities needed for selected recipes. All data persists to browser localStorage — no backend.

## Dev Commands

```bash
npm install       # install deps
npm run dev       # Vite dev server at http://localhost:5173
npm run build     # production build to dist/
npm run lint      # ESLint
npm run preview   # preview production build
npm test          # Vitest single run (used by CI)
npm run test:watch # Vitest watch mode
```

## Architecture

[src/App.jsx](src/App.jsx) is a thin shell: it owns all persistent state and renders the header + tab nav. UI and logic are split into modules. There is no routing or state-management library — just React hooks with inline style objects.

```
src/
  components/   # reusable tables: InvTable, RecEditTable
  features/     # one folder per tab: inventory/, recipes/, order/, settings/
  hooks/        # usePersistentState (load/save localStorage wrapper)
  lib/          # pure logic + data: orderCalc.js, defaults.js, storage.js
  styles.js     # shared inline-style objects
  App.jsx       # shell: state wiring, settings-driven header, tab routing
```

When adding features, keep extending this structure (pure logic → `lib/` with unit tests; reusable UI → `components/`; a tab → `features/`). Do not let logic accumulate back in App.jsx.

**Four tabs:**
- **Inventory** — editable quantity inputs for all ingredients
- **Recipes** — view/edit ingredient lists per recipe; add/remove ingredients
- **Order Calculator** — select recipes (single/double batch) → computed order summary
- **Settings** — brewery identity (name, tagline, emoji/logo icon) and data backup (export/import all app data as JSON)

**localStorage** access goes through [src/lib/storage.js](src/lib/storage.js) (`load`/`save`) and the `usePersistentState` hook. Keys are prefixed `slackers_brew_` and JSON-stringified: `tab`, `malts`, `hops`, `yeast`, `adj`, `selR`, `orders`, `recipes`, `settings`.

## Data Model

Ingredient defaults live in [src/lib/defaults.js](src/lib/defaults.js):
- `defMalts` — 19 malts, quantity in lbs
- `defHops` — 14 hops, quantity in oz
- `defYeast` — 8 yeast strains, quantity in packs
- `defAdj` — 13 adjuncts with per-item units (lbs/oz/ml/each)
- `defSalts` — water-chemistry salts (names only; amounts live per-recipe)

`defRecipes` — 18 preset recipes, each `{n, s, og, fg, abv, mt, m[], h[], y[], a[], sa[]}` (name, style, target OG/FG/ABV, single-infusion mash temp, malts, hops, yeast, adjuncts, water salts). Tuple shapes: malt/yeast `[name, qty]`; hop `[name, qty, stage, time]`; adjunct `[name, qty, unit, stage, time]`; salt `[name, qty, stage]`. Additions carry a **stage** (`brewDayStages`/`cellarStages`/`saltStages` in defaults.js) and may repeat the same name at different stages (e.g. a hop at boil, whirlpool, and dry hop). `computeOrder()` aggregates by name, so it ignores stage/time.

`lib/beersmith.js` parses BeerSmith 3 `.bsmx` files into this recipe model (oz→lb grain, sugar→adjunct routing, name normalization, stage/time), reporting unmapped ingredients. It's the shared parser for the offline migration/seed generator and the (planned) in-app import. Recipe data is normalized into Postgres rows ([supabase/schema.sql](supabase/schema.sql)); schema/data changes ship as files under [supabase/migrations/](supabase/migrations/).

`defSettings` — brewery identity `{name, tagline, emoji, logo}`. `logo` is a base64 data URL (or `null`); when set it overrides `emoji` in the header.

## Key Computed Logic

`computeOrder()` in [src/lib/orderCalc.js](src/lib/orderCalc.js) aggregates selected recipe needs, compares against current inventory, and returns `{malts, hops, yeast, adj}` arrays with `{n, need, have, order}` per ingredient. `maltBags(order)` computes 55 lb bag counts. Both are pure and unit-tested in `orderCalc.test.js`.

[src/lib/backup.js](src/lib/backup.js) handles data export/import: `buildBackup()` serializes all `slackers_brew_*` localStorage into a portable JSON object; `applyBackup()` validates and restores one (clearing existing app keys first). This is also the intended migration tool for the planned hosted backend.

## Style Conventions

- Inline CSS-in-JS objects only — no CSS file, no Tailwind. Shared objects in [src/styles.js](src/styles.js).
- Color accent: `#f59e0b` (amber)
- Neutral grays from Tailwind's slate palette
- Shared style vars: `cell`, `num`, `inp`, `th`, `btn`, `card`, `hdr`, `badge`, `rmBtn`, `addRow`, `sel`, `addBtn`, `tabBtn`

## Testing

Vitest + React Testing Library (jsdom). Tests are co-located with source (`*.test.js[x]`); shared setup in [src/test/setup.js](src/test/setup.js). Prefer unit-testing pure logic in `lib/`. CI runs lint + test + build on every push/PR.

## Working Conventions

- **Persist the roadmap to memory by default.** When we make a significant decision, finish a work chunk, or define the next step, save it to project memory so it survives across sessions — keep the relevant roadmap file (e.g. `data-layer-roadmap.md`) current rather than relying on the session todo list (which is ephemeral). Update or prune stale entries instead of duplicating.
- **Branch → PR workflow.** `main` is protected; land all changes through a PR that passes CI (lint + test + build + CodeQL). Branch prefixes: `feat/`, `fix/`, `chore/`.

## Tech Stack

| | |
|---|---|
| Framework | React 19 |
| Build | Vite 8 |
| Compiler | Oxc (via @vitejs/plugin-react) |
| Lint | ESLint 9 (flat config) |
| Test | Vitest + Testing Library (jsdom) |
| Language | JSX (no TypeScript) |
| Storage | Browser localStorage |

## What Doesn't Exist

- No TypeScript, no CSS framework, no backend (localStorage only), no undo/redo
