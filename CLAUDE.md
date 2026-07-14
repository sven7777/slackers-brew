# Slackers Brewing — CLAUDE.md

## Project Overview

React-based brewery inventory and order management tool for Slackers Brewing. Tracks ingredient stock (malts, hops, yeast, adjuncts) and calculates order quantities needed for selected recipes. Data persists through a swappable data-access layer: browser localStorage by default, or a shared Supabase (Postgres + Auth) backend when configured — the app code is identical either way.

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
                #   — plus auth/ (Supabase session + login gate). recipes/ also
                #   holds the BrewSheetPanel + CellarPanel sub-views.
  hooks/        # usePersistentState (async-aware; routes through repo.js)
  lib/          # pure logic + data + the data-access seam (see below)
  styles.js     # shared inline-style objects
  App.jsx       # shell: state wiring, settings-driven header, tab routing
```

When adding features, keep extending this structure (pure logic → `lib/` with unit tests; reusable UI → `components/`; a tab → `features/`). Do not let logic accumulate back in App.jsx.

**Four tabs:**
- **Inventory** — editable quantity inputs for all ingredients
- **Recipes** — pick a recipe from one dropdown, then a segmented sub-nav (local state, not persisted) switches between three views of it:
  - **Edit** — view/edit ingredient lists per recipe; add/remove ingredients; edit the per-recipe cellar schedule; reset to preset; import a BeerSmith `.bsmx` ([ImportBeerSmith.jsx](src/features/recipes/ImportBeerSmith.jsx)). Reset/Import live here only.
  - **Brew Sheet** — printable brew-day sheet (staged additions, mash, water salts; single/double batch) — [BrewSheetPanel.jsx](src/features/recipes/BrewSheetPanel.jsx)
  - **Cellar Sheet** — printable (**portrait** US Letter — it hangs on a clipboard on the fermenter) post-brew cellar log; enter a brew date and the recipe's day-offset schedule auto-fills every dated box (cold crash, bung, dry hop, rouse, transfer, keg) plus yeast / dry-hop / cellar additions. Scheduled steps follow the Brew Sheet's **Target | Actual** convention (computed date → Target, blank Actual for the brew-day record); the raw schedule is the source for those dates and is not itself printed — [CellarPanel.jsx](src/features/recipes/CellarPanel.jsx)
- **Order Calculator** — select recipes (single/double batch) → computed order summary
- **Settings** — brewery identity (name, tagline, emoji/logo icon) and data backup (export/import all app data as JSON)

The Brew Sheet / Cellar Sheet panels take the selected `recipe` as a prop (the shared `selR` picker drives all three views); each owns only its print-specific control (batch toggle / brew date).

**Persistence** flows through a single seam, [src/lib/repo.js](src/lib/repo.js) (`load`/`save`): the app (via the `usePersistentState` hook) never touches a backend directly. The default backend is localStorage ([src/lib/storage.js](src/lib/storage.js)); when Supabase env vars are present, [src/main.jsx](src/main.jsx) calls `setBackend(createSupabaseBackend(...))` at startup and wraps the app in [LoginGate](src/features/auth/LoginGate.jsx) so all queries run authenticated. The hook is async-aware (returns `[val, setVal, {loading, error}]`) since the Supabase path is networked; the localStorage path stays synchronous. localStorage keys are prefixed `slackers_brew_` and JSON-stringified: `tab`, `malts`, `hops`, `yeast`, `adj`, `selR`, `orders`, `recipes`, `settings`.

## Data Model

Ingredient defaults live in [src/lib/defaults.js](src/lib/defaults.js):
- `defMalts` — 19 malts, quantity in lbs
- `defHops` — 14 hops, quantity in oz
- `defYeast` — 8 yeast strains, quantity in packs
- `defAdj` — 13 adjuncts with per-item units (lbs/oz/ml/each)
- `defSalts` — water-chemistry salts (names only; amounts live per-recipe)

`defRecipes` — 18 preset recipes, each `{n, s, og, fg, abv, mt, ft, m[], h[], y[], a[], sa[], sc[]}` (name, style, target OG/FG/ABV, single-infusion mash temp, primary fermentation temp, malts, hops, yeast, adjuncts, water salts, cellar schedule). `ft` (ferm temp °F) is editable in the Recipes Edit view, imported from BeerSmith's `F_A_PRIM_TEMP`, and prints in the Cellar Sheet's Yeast box; persisted as `recipes.ferm_temp` (migration 0004). A recipe may also carry `process`, a free-form `{key: value}` map of the Brew Sheet's editable planned readings (strike temp, mash/sparge volumes, boil/vorlauf/runoff times, pH targets, whirlpool/knockout temps), persisted as a single JSONB column `recipes.process` (migration 0005) so the field set can change without a migration. Tuple shapes: malt/yeast `[name, qty]`; hop `[name, qty, stage, time]`; adjunct `[name, qty, unit, stage, time]`; salt `[name, qty, stage]`; schedule `[dayOffset, action]`. Additions carry a **stage** (`brewDayStages`/`cellarStages`/`saltStages` in defaults.js) and may repeat the same name at different stages (e.g. a hop at boil, whirlpool, and dry hop). `computeOrder()` aggregates by name, so it ignores stage/time. The cellar `sc` schedule (actions from `cellarActions`) is the spine of the Cellar Summary sheet: entering a brew date computes each step's date (`brewDate + dayOffset`). Only All Y'alls ships with a seeded schedule; other recipes start empty and are filled in the Recipes tab.

`lib/beersmith.js` parses BeerSmith 3 `.bsmx` files into this recipe model (oz→lb grain, sugar→adjunct routing, name normalization, stage/time), reporting unmapped ingredients. It's the shared parser for both the offline seed generator and the in-app import ([ImportBeerSmith.jsx](src/features/recipes/ImportBeerSmith.jsx) via [lib/importRecipe.js](src/lib/importRecipe.js)). Note: BeerSmith recomputes OG/FG/ABV for display and never persists them, so the parser leaves recipe `og/fg/abv` null rather than import a stored design value that wouldn't match. When the Supabase backend is active, recipe data is normalized into Postgres rows ([supabase/schema.sql](supabase/schema.sql)); schema/data changes ship as files under [supabase/migrations/](supabase/migrations/).

`defSettings` — brewery identity `{name, tagline, emoji, logo}`. `logo` is a base64 data URL (or `null`); when set it overrides `emoji` in the header.

## Key Computed Logic

`computeOrder()` in [src/lib/orderCalc.js](src/lib/orderCalc.js) aggregates selected recipe needs, compares against current inventory, and returns `{malts, hops, yeast, adj}` arrays with `{n, need, have, order}` per ingredient. `maltBags(order)` computes 55 lb bag counts. Both are pure and unit-tested in `orderCalc.test.js`.

The printable sheets each have a pure recipe→view-model builder, kept out of the React component so the layout + routing are unit-testable: `buildBrewSheet()` ([src/lib/brewSheet.js](src/lib/brewSheet.js)) for Brew Day (brew-day-stage additions, grain bill, salts; excludes cellar stages + yeast) and `buildCellarSheet(recipe, brewDate)` ([src/lib/cellarSheet.js](src/lib/cellarSheet.js)) for Cellar Summary (schedule date math + routing to cold-crash/bung/dry-hop/rouse/transfer/keg boxes + yeast + ferm temp + cellar additions; the Packaging Summary's first row pre-fills the keg date). Both builders print target gravities through [src/lib/gravity.js](src/lib/gravity.js): OG/FG format to 3 decimals (`fmtGravity`) and the Brew Sheet's ABV is derived as (OG − FG) × 131.25 (`computeAbv`), falling back to the stored recipe `abv` only when a gravity is missing. The Brew Sheet's right-hand process readings ([BrewSheetPanel.jsx](src/features/recipes/BrewSheetPanel.jsx)) mirror the paper Brew Day worksheet 1:1 and come in three kinds (see `READING_GROUPS`): editable+persisted planned values (bound to `recipe.process` via inline inputs — strike temp, volumes, timings, pH targets, WP/KO temps), a read-only mirror (Mash Temp echoes `mt`), and blank write-in lines for brew-day measurements (gravities, yields, actual pH). Editing happens inline on the sheet, not in a separate form.

[src/lib/backup.js](src/lib/backup.js) handles data export/import: `buildBackup()` serializes all `slackers_brew_*` localStorage into a portable JSON object; `applyBackup()` validates and restores one (clearing existing app keys first). It also served as the localStorage→Supabase migration tool.

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
| Lint | ESLint 10 (flat config) |
| Test | Vitest 4 + Testing Library (jsdom) |
| Language | JSX (no TypeScript) |
| Storage | localStorage (default) or Supabase Postgres, behind the `repo.js` backend seam |
| Auth | Supabase Auth (magic link + Google OAuth), only when Supabase is configured |

## What Doesn't Exist

- No TypeScript, no CSS framework, no routing/state library, no undo/redo
