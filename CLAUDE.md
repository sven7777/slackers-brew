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
  components/   # reusable tables: InvTable, RecEditTable, ScheduleEditTable
                #   — plus StyleSelect (BJCP style picker) and the two failure
                #   surfaces: ErrorBoundary, SaveErrorBanner
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
- **Recipes** — pick a recipe from one dropdown, then a segmented sub-nav (local state, not persisted) switches between four views of it:
  - **Edit** — view/edit ingredient lists per recipe; add/remove ingredients; edit the per-recipe cellar schedule; reset to preset; import a BeerSmith `.bsmx` ([ImportBeerSmith.jsx](src/features/recipes/ImportBeerSmith.jsx)). Reset/Import live here only.
  - **Brew Sheet** — printable brew-day sheet (staged additions, mash, water salts; single/double batch) — [BrewSheetPanel.jsx](src/features/recipes/BrewSheetPanel.jsx)
  - **Cellar Sheet** — printable (**portrait** US Letter — it hangs on a clipboard on the fermenter) post-brew cellar log; enter a brew date and the recipe's day-offset schedule auto-fills every dated box (cold crash, bung, dry hop, rouse, transfer, carb, keg) plus yeast / dry-hop / cellar additions. Scheduled steps follow the Brew Sheet's **Target | Actual** convention (computed date → Target, blank Actual for the brew-day record); the raw schedule is the source for those dates and is not itself printed — [CellarPanel.jsx](src/features/recipes/CellarPanel.jsx)
  - **Cost** — ingredient COGS for the recipe: batch total, cost/bbl, cost/keg, cost per 16 oz pint, per-category subtotals, and an inline-editable cost per unit for each ingredient — [CostPanel.jsx](src/features/recipes/CostPanel.jsx)
- **Order Calculator** — select recipes (single/double batch) → computed order summary
- **Settings** — brewery identity (name, tagline, emoji/logo icon), batch volume (default post-boil yield + brewhouse loss %, which drive cost/bbl and cost/keg), ingredient price import, and data backup (export/import all app data as JSON)

The Brew Sheet / Cellar Sheet / Cost panels take the selected `recipe` as a prop (the shared `selR` picker drives all four views); each owns only its own control (batch toggle / brew date / batch toggle). Cost additionally receives the inventory arrays and a `setInvCost` callback, because ingredient prices live on inventory rows, not on recipes — editing a price in one recipe's Cost view changes it everywhere, which the panel states explicitly. `setInvCost` **creates the inventory row when none matches the name**: a recipe can reference an ingredient inventory has never had (seeded recipes did exactly that with Whirlfloc), and the old map-and-match silently wrote nothing, so the price field just refused input. Migration 0009 backfills those rows in prod generically, from `recipe_ingredients`.

**Persistence** flows through a single seam, [src/lib/repo.js](src/lib/repo.js) (`load`/`save`): the app (via the `usePersistentState` hook) never touches a backend directly. The default backend is localStorage ([src/lib/storage.js](src/lib/storage.js)); when Supabase env vars are present, [src/main.jsx](src/main.jsx) calls `setBackend(createSupabaseBackend(...))` at startup and wraps the app in [LoginGate](src/features/auth/LoginGate.jsx) so all queries run authenticated. The hook is async-aware (returns `[val, setVal, {loading, error}]`) since the Supabase path is networked; the localStorage path stays synchronous. The hook also serializes saves per key (chained, latest-value-wins): a backend save is a whole-list delete-then-insert, and two saves in flight at once can interleave and duplicate rows (this doubled the recipes on 2026-07-14; a unique index on `recipes.ord`, migration 0006, now makes a recurrence fail loudly). Because that index turns a race into a *rejected* write, failed saves must be visible: the hook reports them to [src/lib/saveStatus.js](src/lib/saveStatus.js), a tiny module-level store that [SaveErrorBanner](src/components/SaveErrorBanner.jsx) renders (one row per key, with a Retry that re-enters the same save chain and writes the newest value — never the stale one that failed). A save that only reached `console.error` would leave an unsaved edit sitting on screen looking stored. localStorage keys are prefixed `slackers_brew_` and JSON-stringified: `tab`, `malts`, `hops`, `yeast`, `adj`, `selR`, `orders`, `recipes`, `settings`.

**Crash containment.** [ErrorBoundary](src/components/ErrorBoundary.jsx) wraps the tab panel in App.jsx (keyed by `tab`, so switching tabs clears a crashed panel and the nav — which sits outside it — is always usable) and the whole tree in main.jsx. Three white screens have shipped, each a *different* unguarded read (a missing recipe array, a column prod hadn't migrated yet, a stale `selR` indexing past the end of the list), so the guard is deliberately generic rather than another targeted null check. Keep it that way: prefer fixing the class of failure over adding the next specific check.

## Data Model

Ingredient defaults live in [src/lib/defaults.js](src/lib/defaults.js):
- `defMalts` — 20 malts, quantity in lbs (Carafa III and Carafa Special III are
  distinct entries — "Special" is the dehusked malt; don't collapse them)
- `defHops` — 14 hops, quantity in oz
- `defYeast` — 8 yeast strains, quantity in packs
- `defAdj` — 13 adjuncts with per-item units (lbs/oz/ml/each)
- `defSalts` — water-chemistry salts (names only; amounts live per-recipe)

`defRecipes` — 18 preset recipes, each `{n, s, og, fg, abv, mt, ft, m[], h[], y[], a[], sa[], sc[]}` (name, style, target OG/FG/ABV, single-infusion mash temp, primary fermentation temp, malts, hops, yeast, adjuncts, water salts, cellar schedule). `ft` (ferm temp °F) is editable in the Recipes Edit view, imported from BeerSmith's `F_A_PRIM_TEMP`, and prints in the Cellar Sheet's Yeast box; persisted as `recipes.ferm_temp` (migration 0004). A recipe may also carry `process`, a free-form `{key: value}` map of the Brew Sheet's editable planned readings (strike temp, mash/sparge volumes, boil/vorlauf/runoff times, pH targets, whirlpool/knockout temps), persisted as a single JSONB column `recipes.process` (migration 0005) so the field set can change without a migration. Tuple shapes: malt/yeast `[name, qty]`; hop `[name, qty, stage, time]`; adjunct `[name, qty, unit, stage, time]`; salt `[name, qty, stage]`; schedule `[dayOffset, action]`. Additions carry a **stage** (`brewDayStages`/`cellarStages`/`saltStages` in defaults.js) and may repeat the same name at different stages (e.g. a hop at boil, whirlpool, and dry hop). `computeOrder()` aggregates by name, so it ignores stage/time. The cellar `sc` schedule (actions from `cellarActions`) is the spine of the Cellar Summary sheet: entering a brew date computes each step's date (`brewDate + dayOffset`). Only All Y'alls ships with a seeded schedule; other recipes start empty and are filled in the Recipes tab.

`beerStyles.js` is **generated** — `node scripts/gen-styles.mjs` re-derives it from a BeerSmith style export (File ▸ Export ▸ Styles) via `parseBeerSmithStyles()`. The export lands in `styles/`, which is **gitignored** like `pricing/`: it's ~550 KB and carries `F_S_DESCRIPTION`, verbatim BJCP guideline prose that must not go into a public repo. The generator takes names and categories only.

`lib/beersmith.js` parses BeerSmith 3 `.bsmx` files into this recipe model (oz→lb grain, sugar→adjunct routing, name normalization, stage/time), reporting unmapped ingredients. It's the shared parser for both the offline seed generator and the in-app import ([ImportBeerSmith.jsx](src/features/recipes/ImportBeerSmith.jsx) via [lib/importRecipe.js](src/lib/importRecipe.js)). Note: BeerSmith recomputes OG/FG/ABV for display and never persists them, so the parser leaves recipe `og/fg/abv` null rather than import a stored design value that wouldn't match. The **style is a nested record**, not text — `<F_R_STYLE>` holds `<F_S_NAME>`, `<F_S_CATEGORY>`, the BJCP ranges — so it's read via `styleName()`, not the scalar-only `field()` helper (which silently returned `""` and left every imported recipe styleless). **Name and style are editable** in the Recipes ▸ Edit header, since presets ship with both but an imported recipe had no way to acquire or correct either; a recipe with an empty name renders as `(untitled)` in the picker so it stays selectable mid-edit. Name is free text; style is [StyleSelect](src/components/StyleSelect.jsx), a dropdown over the 148 BJCP styles in [src/lib/beerStyles.js](src/lib/beerStyles.js) grouped into `<optgroup>`s by category. A recipe's style stays a **free string** — the catalog is the picker's, not a constraint: a value the guide doesn't list (Slackers' shorthand `NEIPA`, or anything a `.bsmx` brings in) is offered back as its own option and kept verbatim, because a picker that dropped what it didn't recognize would rewrite recipe data just by rendering; and `Custom…` swaps in a text box for a house style, the one thing free text could do that a dropdown can't. When the Supabase backend is active, recipe data is normalized into Postgres rows ([supabase/schema.sql](supabase/schema.sql)); schema/data changes ship as files under [supabase/migrations/](supabase/migrations/) and are applied to the live database automatically by CI on merge to `main` — keep them additive/idempotent since they run unattended against production.

`defSettings` — brewery identity `{name, tagline, emoji, logo}` plus batch-volume defaults `{postBoilYield, lossPct}`. `logo` is a base64 data URL (or `null`); when set it overrides `emoji` in the header.

**Ingredient pricing.** Recipes and inventory speak generic brewer shorthand (`"2-Row"`, `"Caramunich I"`); vendors sell branded SKUs in vendor pack sizes. [src/lib/products.js](src/lib/products.js) bridges the two: a `products` catalog of what Slackers actually buys (SKU, vendor, product name, `packQty`/`packUnit`, `orderPack`, hop `cropYear`) plus `defaultProductMap`, the per-category judgment layer mapping each generic name to a default SKU. Two names may point at one product (Midnight Wheat and Carafa Special III are the same sack) — they stay distinct in inventory and merge only when computing an order. An ingredient with no vendor product maps to `null` and is listed in `UNPRICEABLE` (currently just Brewzyme D, which no recipe uses — so every current recipe is fully costable).

⚠️ **`products.js` carries no prices, deliberately.** BSG stamps its price lists "TRADE SECRET CONFIDENTIAL" and this repo is public, so vendor prices must never be committed — including as test fixtures, which use fabricated round numbers. Prices live only in the private Supabase DB (`inventory.cost_per_unit`, `products` table — migration 0008), seeded once from a gitignored file under `pricing/` and edited in-app thereafter. The nightly backup repo is private, so the whole chain holds. A test in `products.test.js` fails if a `price` field reappears in the catalog.

[src/lib/pricing.js](src/lib/pricing.js) owns every vendor-pack → recipe-unit conversion (malt $/lb, hops $/lb→$/oz, yeast one 500 g brick = one `pack`, adjuncts per their own lbs/oz/ml/each). `costPerUnit()` returns **null**, never 0, when a product has no price or the units don't reconcile — an unpriced ingredient must surface in the UI rather than silently understate a cost. Derived prices are **stored rounded to the cent**: a vendor quote can carry more precision (malt at $0.724/lb, hops at $0.874375/oz once converted), but a price the UI shows to two decimals has to *be* two decimals or the cost column stops reconciling with the price beside it. Costs round *up*; a price rounds to *nearest* — it's a quote, not a cost. Worth at most ~$1.30 on a batch.

**COGS.** `computeRecipeCost()` in [src/lib/cogs.js](src/lib/cogs.js) totals a recipe's ingredient cost, splits it by category, and derives cost/bbl, cost/keg, and cost per 16 oz pint. Two invariants: an unpriced ingredient goes to `missing` and is **excluded** from the total, never costed at $0 (the Cost view reports the gap — a confidently wrong COGS is worse than an obviously incomplete one); and only one volume is stored, since a half-barrel keg is exactly ½ bbl, so cost/keg and cost/pint are derived from that one volume rather than tracked separately. **Every money figure is rounded UP to the cent** (`ceilCents`) — costing should never come in under what a batch actually costs. Line costs are rounded first and the subtotals/total built from the rounded lines, so the column on screen adds up to the total on screen; the three per-unit figures are each rounded independently, so they can sit a penny off exact halving. Cost per pint is of *packaged* beer and excludes taproom pour loss (foam, line purge, tasters), which the panel states. Packaged volume is `postBoilYield × (1 − lossPct) ÷ 31`, resolved in one place by `batchVolume()` — recipe `process.postBoilYield` (through the tolerant `parseVolume()`, since that field is free text) → the `settings` value → the `defSettings` default, for **both** fields. A recipe may override the brewery loss % with `process.avgKegs`, **what that beer actually yields**: kegs is the number a brewer counts on the floor, so the field asks for the measurement and `batchVolume()` back-solves the percentage (7 kegs off a 150 gal boil = 27.7% loss). It returns `lossPct` either way, so the cost math stays one number wide and double batches still scale by volume. A yield larger than the boil is a typo, not a yield — it's rejected back to the brewery default with a note on the panel, since costing must never divide by beer the brewery didn't make. An unset or cleared value means "use the brewery default", never 0% loss: the Cost panel used to fall back to 0 while Settings' preview fell back to 33, so a settings record saved before these fields existed (as prod's was) costed every batch against the full kettle volume — $90/bbl where the truth was $135. Defaults (150 gal, 33% loss) are Slackers' measured numbers and yield ~6.5 kegs; the Cost panel prints the whole basis (`150 gal less 33% loss = 3.24 bbl ≈ 6.5 kegs`) under the stat tiles so a per-bbl figure is never read against the kettle. Water salts are excluded — no price source, dosed in grams. [src/lib/applyPrices.js](src/lib/applyPrices.js) joins a `{sku: price}` file to the catalog and writes `cpu` onto inventory rows; [PriceImport.jsx](src/features/settings/PriceImport.jsx) is that flow in the UI, and the future price-list uploader is the same path with a parser in front.

## Key Computed Logic

`computeOrder()` in [src/lib/orderCalc.js](src/lib/orderCalc.js) aggregates selected recipe needs, compares against current inventory, and returns `{malts, hops, yeast, adj}` arrays with `{n, need, have, order}` per ingredient. `maltBags(order)` computes 55 lb bag counts. Both are pure and unit-tested in `orderCalc.test.js`.

The printable sheets each have a pure recipe→view-model builder, kept out of the React component so the layout + routing are unit-testable: `buildBrewSheet()` ([src/lib/brewSheet.js](src/lib/brewSheet.js)) for Brew Day (brew-day-stage additions, grain bill, salts; excludes cellar stages + yeast) and `buildCellarSheet(recipe, brewDate)` ([src/lib/cellarSheet.js](src/lib/cellarSheet.js)) for Cellar Summary (schedule date math + routing to cold-crash/bung/dry-hop/rouse/transfer/carb/keg boxes + yeast + ferm temp + cellar additions; the Packaging Summary's first row pre-fills the keg date). Both builders print target gravities through [src/lib/gravity.js](src/lib/gravity.js): OG/FG format to 3 decimals (`fmtGravity`) and the Brew Sheet's ABV is derived as (OG − FG) × 131.25 (`computeAbv`), falling back to the stored recipe `abv` only when a gravity is missing. The Brew Sheet's right-hand process readings ([BrewSheetPanel.jsx](src/features/recipes/BrewSheetPanel.jsx)) mirror the paper Brew Day worksheet 1:1 and come in three kinds (see `READING_GROUPS`): editable+persisted planned Target values (bound to `recipe.process` via inline inputs — strike temp, volumes, mill/vorlauf/runoff/boil timings, pre/post-boil gravity + yield targets, pH targets, WP/KO temps), a read-only mirror (Mash Temp echoes `mt`), and printed empty checkboxes for brew-day prep steps ticked by pen (water cycled, pH calibrated). Every reading's Actual column is a blank write-in filled by pen on brew day. Editing happens inline on the sheet, not in a separate form.

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
- **Nightly DB backups.** [.github/workflows/backup.yml](.github/workflows/backup.yml) dumps the live Supabase DB every night into the private `slackers-brew-backups` repo (commit-on-change, so its git log is a daily changelog of the data; restore notes in that repo's README). The free tier has no built-in backups — this is the safety net for prod data.
- **Merge = migrated + deployed.** [.github/workflows/deploy.yml](.github/workflows/deploy.yml) runs on every push to `main`: it applies any new Supabase migrations (`supabase db push`; no-op when none), then builds the SPA and sftp-uploads `dist/` to DreamHost (brew.slackersbrewing.com). No manual SQL Editor runs or hand deploys. Secrets it uses: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `DREAMHOST_SSH_KEY` (see [supabase/README.md](supabase/README.md)).

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
