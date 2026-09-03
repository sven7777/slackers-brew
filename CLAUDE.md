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
                #   — plus StyleSelect (BJCP style picker), PriceInput (the one
                #   cost-per-unit field), CatalogBrowser + AdoptDialog (the one
                #   bridge from vendor catalog to shelf) and the three failure
                #   surfaces: ErrorBoundary, SaveErrorBanner, StaleDataBanner
  features/     # one folder per tab: inventory/, recipes/, order/, analytics/,
                #   settings/
                #   — plus auth/ (Supabase session + login gate). recipes/ also
                #   holds the BrewSheetPanel + CellarPanel sub-views.
  hooks/        # usePersistentState (async-aware; routes through repo.js)
  lib/          # pure logic + data + the data-access seam (see below)
                #   — incl. sortNames.js, the one alphabetical comparator
                #   — incl. archive.js (stopped-buying rows: hidden, not deleted)
                #   — incl. adopt.js + catalogSearch.js (catalog → inventory)
                #   — incl. hopCatalog.js (the spot hop list as catalog rows)
                #   — incl. recipeRows.js (the one "add a row to a recipe")
                #   — incl. inventoryValue.js (stock on hand × its price)
                #   — incl. analytics.js (every recipe costed, side by side)
                #   — incl. the price-list pipeline: pdfText (pdf.js, lazy) →
                #   pdfLines → parsePriceList → priceChanges → applyPrices,
                #   and, off the same parse, catalog → catalogChanges (the
                #   whole vendor range, not just what we stock),
                #   and the hop-list path: pdfText words (or ocr, when the PDF
                #   is scanned) → spotHops
  styles.js     # shared inline-style objects
  App.jsx       # shell: state wiring, settings-driven header, tab routing
scripts/        # offline generators (gen-styles.mjs — see beerStyles.js below)
supabase/       # schema.sql, seed_recipes.sql, migrations/ (0001–0017)
```

When adding features, keep extending this structure (pure logic → `lib/` with unit tests; reusable UI → `components/`; a tab → `features/`). Do not let logic accumulate back in App.jsx.

**Five tabs:**
- **Inventory** — editable quantity inputs for all ingredients, **plus each
  one's cost per unit and what that stock is worth** (`q × cpu`, via
  [inventoryValue.js](src/lib/inventoryValue.js)): per-category subtotals and a
  running total for the whole shelf. The price column is the *same* value the
  Cost view edits and the Settings price import writes — it lives on the
  inventory row, not on a recipe — so both surfaces share one writer
  (`setInvCost` in App.jsx) and one field ([PriceInput](src/components/PriceInput.jsx)).
  It keeps cogs.js's rule: an unpriced ingredient reads "unpriced" and is left
  OUT of the total rather than valued at $0, with the count of what's missing
  printed next to every subtotal. Clearing inventory zeroes quantities and keeps
  prices — a cleared shelf is still a priced one. An ingredient the brewery has
  stopped buying is **archived, never deleted** ([archive.js](src/lib/archive.js),
  migration 0017): the row, its quantity and its price all survive, the tab hides
  it and says how many it hid, and a toggle brings them back. **Add ingredient**
  opens the vendor catalog browser (below) — until now the tab had no add control
  at all, and the only way a row was ever created was `setInvCost` doing it
  implicitly. Deleting was the
  only way to say "we don't stock this" and it threw away the price, the one field
  on an inventory row that's expensive to re-acquire. ⚠️ `computeOrder()`
  deliberately ignores the flag — a recipe calling for an archived ingredient
  still needs it bought, and hiding a row from the shelf must never quietly change
  what the brewery orders. The value total is computed over the rows actually
  SHOWN, so the column still adds up to the total beside it. ⚠️ The archive
  control is **not** a red `×`: that glyph already means permanent removal
  (`rmBtn`, which deletes a recipe ingredient), and archiving promises the
  opposite
- **Recipes** — pick a recipe from one dropdown, then a segmented sub-nav (local state, not persisted) switches between four views of it:
  - **Everything a brewer scans for a name is alphabetical**, via the one comparator in [src/lib/sortNames.js](src/lib/sortNames.js) (`Intl.Collator`, case-insensitive + numeric, so `Cascade` precedes `CTZ` and `Crystal 8` precedes `Crystal 80`): the recipe picker here and on the Order Calculator, every ingredient table and its Add picker in the Edit view, the cellar-schedule action picker, and the Cost view's line items. The ingredient sorts are **display-only** — `sortedWithIndex()` hands back each row's index in the STORED array, and every edit still addresses that, because the stored order is what the printable sheets group by stage and time. What stays in process order stays that way: the schedule ROWS (day order), the Brew Sheet's additions (stage, then descending time), the Cellar Sheet's boxes.
  - **Edit** — recipe header (name, style, target OG/FG/ABV, mash + ferm temp) then the ingredient lists; add/remove ingredients (the Add picker offers the BREWERY'S OWN inventory, archived rows included — it used to offer `defaults.js`, which meant an adopted ingredient could never reach a recipe — with `Browse catalog…` as its last entry); edit the per-recipe cellar schedule; reset to preset; import a BeerSmith `.bsmx` ([ImportBeerSmith.jsx](src/features/recipes/ImportBeerSmith.jsx)). Reset/Import live here only. Name is free text, style comes from [StyleSelect](src/components/StyleSelect.jsx); an empty name renders as `(untitled)` in the picker so a mid-edit recipe stays selectable.
  - **Brew Sheet** — printable brew-day sheet (staged additions, mash, water salts; single/double batch) — [BrewSheetPanel.jsx](src/features/recipes/BrewSheetPanel.jsx)
  - **Cellar Sheet** — printable (**portrait** US Letter — it hangs on a clipboard on the fermenter) post-brew cellar log; enter a brew date and the recipe's day-offset schedule auto-fills every dated box (cold crash, bung, dry hop, rouse, transfer, carb, keg) plus yeast / dry-hop / cellar additions. Dry hop prints **one block per charge** (Dry Hop 1/2/3), each hop dated from its own charge's scheduled day. Scheduled steps follow the Brew Sheet's **Target | Actual** convention (computed date → Target, blank Actual for the brew-day record); the raw schedule is the source for those dates and is not itself printed. **Misc. Additions print their stage and an Added tick box**: each row shows the addition's cellar stage under its name (when in the process it goes in — a name and an amount alone didn't say whether that was primary or transfer), a Target date where the stage maps to a scheduled step, and an empty box the cellar crew marks to confirm it actually went in — [CellarPanel.jsx](src/features/recipes/CellarPanel.jsx)
  - **Cost** — ingredient COGS for the recipe: batch total, cost/bbl, cost/keg, cost per 16 oz pint, per-category subtotals, and an inline-editable cost per unit for each ingredient — [CostPanel.jsx](src/features/recipes/CostPanel.jsx)
- **Order Calculator** — select recipes (single/double batch) → computed order summary
- **Analytics** — two views of the whole book, behind a segmented sub-nav
  ([AnalyticsTab.jsx](src/features/analytics/AnalyticsTab.jsx) is the shell; local
  state, like the Recipes tab's). It computes `costAllRecipes()` ONCE and hands it to
  both, so the Overhead view's ingredient layer is literally the average printed in the
  Beers tile beside it, never a second computation off the same recipes.
  - **Beers** — every beer costed side by side ([analytics.js](src/lib/analytics.js) +
  [BeersPanel.jsx](src/features/analytics/BeersPanel.jsx)): batch total, cost/bbl,
  cost/keg, cost/pint per recipe, sortable on any column, plus brewery-wide averages
  and the cheapest/dearest beer per bbl. It adds **no arithmetic of its own** — every
  figure comes from the same `computeRecipeCost()` the Cost panel calls, so a number
  here and that recipe's own Cost view can't drift apart. Each recipe is costed against
  **its own** `batchVolume()`, never one shared denominator, or a beer with a measured
  keg yield would be compared on the brewery default. cogs.js's honesty rule carries up
  a level: a recipe with an unpriced ingredient shows the priced part as a **floor**
  (marked `+`), is excluded from the averages, and the tiles print how many were left
  out — an average over 14 beers must never read as the average of 18. ⚠️ A recipe with
  NO ingredients totals $0 and reports nothing missing, which would read as a beer that
  costs nothing to brew; it's flagged `empty` and kept out of every statistic. The
  **blockers** table is the payoff the per-recipe warnings can't give: unpriced
  ingredients ranked by how many beers each one holds up, because each Cost view only
  ever sees its own gap. Rows are **per single batch** — doubling scales ingredients
  and volume together, so only the batch total would move and nothing about the ranking
  would. Clicking a beer hands off into its Cost view (`openRecipeCost` in App.jsx →
  RecipesTab's `initialView`; the sub-nav is still the tab's own state, and the nav
  buttons reset it, so arriving by hand still starts on Edit)
  - **Overhead** — what a pint costs BEYOND its ingredients
  ([overhead.js](src/lib/overhead.js) + [OverheadPanel.jsx](src/features/analytics/OverheadPanel.jsx)):
  the cost stack per pint (ingredients → production labor → allocated overhead), the
  overhead broken out line by line, and where the labor goes. Like the Beers view it
  adds **no arithmetic of its own**. Three things the layout exists to say:
  **DIRECT vs ABSORBED** are separate rows because they answer different questions —
  direct (ingredients + labor) says whether one more pint is worth pouring, absorbed
  (+ overhead) says whether the business works at this volume, and one blended "cost
  per pint" would answer neither. The denominator is **pints SOLD**, not packaged —
  beer lost to foam, line purge and comps is beer you paid to make and were never paid
  for. And an **unconfirmed input is not a zero**: a blank rent is named, left out, and
  the absorbed figure is marked `+` as the floor it is, exactly as the Beers view marks
  a recipe with an unpriced ingredient. ⚠️ The split between the two views is itself the
  point — ingredient COGS is the EXACT part (real vendor prices, real grain bills) and
  runs ~6% of an $8 pint, so putting the precise small number and the modelled large one
  on one screen would let the first stand in for the second. Keep cogs.js
  ingredients-only and stack on top of it; do not fold overhead back into it.
- **Settings** — brewery identity (name, tagline, emoji/logo icon), batch volume (default post-boil yield + **average kegs per batch**, which back-solves the brewhouse loss % that drives cost/bbl and cost/keg — same field and same algebra as a recipe's own Avg yield, so the app asks for kegs everywhere and never for a percentage), ingredient price import (upload the vendor's **PDF price list** or a prepared JSON file, review the old → new change set *and what it does to the vendor catalog*, then apply), **operating costs** ([CostInputs.jsx](src/features/settings/CostInputs.jsx) — production/capacity, taproom losses, production labor, monthly overhead and price deductions, all under the single `settings.costs` object; it and Analytics ▸ Overhead read the one `OVERHEAD_FIELDS` list in overhead.js, so a line cannot be called "Austin Energy" where it is entered and "electric" where it is totalled), and data backup (export/import all app data as JSON)

The Brew Sheet / Cellar Sheet / Cost panels take the selected `recipe` as a prop (the shared `selR` picker drives all four views); each owns only its own control (batch toggle / brew date / batch toggle). Cost additionally receives the inventory arrays and a `setInvCost` callback, because ingredient prices live on inventory rows, not on recipes — editing a price in one recipe's Cost view changes it everywhere, which the panel states explicitly. `setInvCost` **creates the inventory row when none matches the name**: a recipe can reference an ingredient inventory has never had (seeded recipes did exactly that with Whirlfloc), and the old map-and-match silently wrote nothing, so the price field just refused input. Migration 0009 backfills those rows in prod generically, from `recipe_ingredients`.

**Persistence** flows through a single seam, [src/lib/repo.js](src/lib/repo.js) (`load`/`save`): the app (via the `usePersistentState` hook) never touches a backend directly. The default backend is localStorage ([src/lib/storage.js](src/lib/storage.js)); when Supabase env vars are present, [src/main.jsx](src/main.jsx) calls `setBackend(createSupabaseBackend(...))` at startup and wraps the app in [LoginGate](src/features/auth/LoginGate.jsx) so all queries run authenticated. The hook is async-aware (returns `[val, setVal, {loading, error}]`) since the Supabase path is networked; the localStorage path stays synchronous. The hook also serializes saves per key (chained, latest-value-wins): a backend save is a whole-list delete-then-insert, and two saves in flight at once can interleave and duplicate rows (this doubled the recipes on 2026-07-14; a unique index on `recipes.ord`, migration 0006, now makes a recurrence fail loudly). Because that index turns a race into a *rejected* write, failed saves must be visible: the hook reports them to [src/lib/saveStatus.js](src/lib/saveStatus.js), a tiny module-level store that [SaveErrorBanner](src/components/SaveErrorBanner.jsx) renders (one row per key, with a Retry that re-enters the same save chain and writes the newest value — never the stale one that failed). A save that only reached `console.error` would leave an unsaved edit sitting on screen looking stored. localStorage keys are prefixed `slackers_brew_` and JSON-stringified: `tab`, `malts`, `hops`, `yeast`, `adj`, `selR`, `orders`, `recipes`, `settings`. ⚠️ `tab` is a persisted INDEX into `tabNames`, so inserting a tab renumbers the ones after it — adding Analytics at 3 moved Settings from 3 to 4, and a stored `tab` lands somewhere new exactly once. Harmless because every panel is rendered on an explicit `tab===n`, so an index off the end shows nothing rather than crashing; append rather than insert if that one-time jump ever matters.

⚠️ **A long-open tab is stale, and a stale save used to be able to delete data.** The app reads each key once on mount and never refetches — no polling, no realtime — so a tab open since before an edit shows the data as of the moment it opened (2026-08-27: a tab predating an import was still offering the old recipe list, and the two imported recipes looked lost). The display was the harmless half: every save is a whole-list delete-then-insert, so editing anything in that tab would have written the old list over the new recipes and deleted them. Two members share one database; this needs two windows, not a day-old tab. Two mechanisms, in [src/lib/freshness.js](src/lib/freshness.js) and migration 0014:

- **Say so.** On tab focus (and on becoming visible), `repo.staleKeys()` asks the backend which loaded keys have moved, and [StaleDataBanner](src/components/StaleDataBanner.jsx) offers a reload. It **reports, never refetches** — silently swapping the data under an open editor would throw away whatever is half-typed.
- **Refuse the write.** `data_versions` holds one counter per shared key. A writer claims its slot with a compare-and-swap (`update … where key = $1 and version = $expected`) and touches data rows only if that matched, so a losing writer never reaches the delete. A refusal raises `StaleWriteError` ([src/lib/staleWrite.js](src/lib/staleWrite.js)), which SaveErrorBanner renders with **Reload instead of Retry** — retrying a stale write is precisely the overwrite being prevented. It is a compare-and-swap, not a lock: a crash between claim and insert leaves the version bumped and the data half-written, exactly as a crash mid-save does today.

The localStorage backend implements the same `staleKeys()` (two tabs share one origin's storage; there the stored string *is* the version) but has no CAS — a local save can't fail, and that path stays synchronous.

**Crash containment.** [ErrorBoundary](src/components/ErrorBoundary.jsx) wraps the tab panel in App.jsx (keyed by `tab`, so switching tabs clears a crashed panel and the nav — which sits outside it — is always usable) and the whole tree in main.jsx. Three white screens have shipped, each a *different* unguarded read (a missing recipe array, a column prod hadn't migrated yet, a stale `selR` indexing past the end of the list), so the guard is deliberately generic rather than another targeted null check. Keep it that way: prefer fixing the class of failure over adding the next specific check.

## Data Model

Ingredient defaults live in [src/lib/defaults.js](src/lib/defaults.js):
- `defMalts` — 19 malts, quantity in lbs. ⚠️ **One Carafa entry, not two.**
  Weyermann makes both a husked Carafa III and a dehusked "Special" — but
  Slackers only ever buys the dehusked one (Derek, 2026-08-26), so the catalog
  carries `Carafa Special III` alone and every other spelling folds onto it
  (the `.bsmx` importer aliases `Carafa III` / `Carafe III` / the "Type 3"
  forms). Migration 0007 split them on the theory that both were stocked, which
  left prod with THREE rows for one sack — its rename was guarded against the
  unique index and so skipped instead of merging, orphaning the misspelled row.
  **0013 merged them back**; don't re-split without the brewery saying it now
  buys both, because an unaliased name here becomes a second inventory row for
  the same malt
- `defHops` — 14 hops, quantity in oz
- `defYeast` — 8 yeast strains, quantity in packs
- `defAdj` — 13 adjuncts with per-item units (lbs/oz/ml/each)
- `defSalts` — water-chemistry salts (names only; amounts live per-recipe)

`defRecipes` — 18 preset recipes, each `{n, s, og, fg, abv, mt, ft, m[], h[], y[], a[], sa[], sc[]}` (name, style, target OG/FG/ABV, single-infusion mash temp, primary fermentation temp, malts, hops, yeast, adjuncts, water salts, cellar schedule). `ft` (ferm temp °F) is editable in the Recipes Edit view, imported from BeerSmith's `F_A_PRIM_TEMP`, and prints in the Cellar Sheet's Yeast box; persisted as `recipes.ferm_temp` (migration 0004). A recipe may also carry `process`, a free-form `{key: value}` map of the Brew Sheet's editable planned readings (strike temp, mash/sparge volumes, boil/vorlauf/runoff times, pH targets, whirlpool/knockout temps), persisted as a single JSONB column `recipes.process` (migration 0005) so the field set can change without a migration. **Dry hop is numbered** — stages `dryhop1/2/3` (`dryHopStages`, labelled "Dry Hop 1…" in the picker via `stageLabels`) and matching schedule actions "Dry Hop 1/2/3". The number is the join key between a hop and its scheduled day: a double dry hop is two charges on two days, and without it there was nothing to pair them by, so the Cellar Sheet could only print one date (and printed it against the first hop row alone). `dryHopCharge(stage)` resolves a stage to 1-3, mapping the pre-0011 unnumbered `dryhop`/"Dry Hop" to charge 1 so unmigrated localStorage or an old backup still prints. Migration 0011 rewrites prod. Tuple shapes: malt/yeast `[name, qty]`; hop `[name, qty, stage, time]`; adjunct `[name, qty, unit, stage, time]`; salt `[name, qty, stage]`; schedule `[dayOffset, action]`. Additions carry a **stage** (`brewDayStages`/`cellarStages`/`saltStages` in defaults.js) and may repeat the same name at different stages (e.g. a hop at boil, whirlpool, and dry hop). `computeOrder()` aggregates by name, so it ignores stage/time. The cellar `sc` schedule (actions from `cellarActions`) is the spine of the Cellar Summary sheet: entering a brew date computes each step's date (`brewDate + dayOffset`). Only All Y'alls ships with a seeded schedule; other recipes start empty and are filled in the Recipes tab.

`beerStyles.js` is **generated** — `node scripts/gen-styles.mjs` re-derives it from a BeerSmith style export (File ▸ Export ▸ Styles) via `parseBeerSmithStyles()`. The export lands in `styles/`, which is **gitignored** like `pricing/`: it's ~550 KB and carries `F_S_DESCRIPTION`, verbatim BJCP guideline prose that must not go into a public repo. The generator takes names and categories only. Accented names arrive as HTML named entities and are decoded by composing letter + accent (`&egrave;` → e + combining grave → `è`), which covers all of Latin-1 in one rule — the old hardcoded ö/ü/ä list let `Bi&egrave;re de Garde` through raw. A test asserts every preset recipe's style is in the catalog: **migration 0010** put prod's three shorthand values (`NEIPA`, `Belgian Blond`, `American Brown`) onto catalog names and backfilled blank styles from the brewery's own `.bsmx` exports, so `defaults.js`, `seed_recipes.sql` and prod all agree.

`lib/beersmith.js` parses BeerSmith 3 `.bsmx` files into this recipe model (oz→lb grain, sugar→adjunct routing, name normalization, stage/time), reporting unmapped ingredients. It's the shared parser for both the offline seed generator and the in-app import ([ImportBeerSmith.jsx](src/features/recipes/ImportBeerSmith.jsx) via [lib/importRecipe.js](src/lib/importRecipe.js)). Note: BeerSmith recomputes OG/FG/ABV for display and never persists them, so the parser leaves recipe `og/fg/abv` null rather than import a stored design value that wouldn't match. The **style is a nested record**, not text — `<F_R_STYLE>` holds `<F_S_NAME>`, `<F_S_CATEGORY>`, the BJCP ranges — so it's read via `styleName()`, not the scalar-only `field()` helper (which silently returned `""` and left every imported recipe styleless). **Name and style are editable** in the Recipes ▸ Edit header, since presets ship with both but an imported recipe had no way to acquire or correct either; a recipe with an empty name renders as `(untitled)` in the picker so it stays selectable mid-edit. Name is free text; style is [StyleSelect](src/components/StyleSelect.jsx), a dropdown over the 148 BJCP styles in [src/lib/beerStyles.js](src/lib/beerStyles.js) grouped into `<optgroup>`s by category. A recipe's style stays a **free string** — the catalog is the picker's, not a constraint: a value the guide doesn't list (Slackers' shorthand `NEIPA`, or anything a `.bsmx` brings in) is offered back as its own option and kept verbatim, because a picker that dropped what it didn't recognize would rewrite recipe data just by rendering; and `Custom…` swaps in a text box for a house style, the one thing free text could do that a dropdown can't. When the Supabase backend is active, recipe data is normalized into Postgres rows ([supabase/schema.sql](supabase/schema.sql)); schema/data changes ship as files under [supabase/migrations/](supabase/migrations/) and are applied to the live database automatically by CI on merge to `main` — keep them additive/idempotent since they run unattended against production.

`defSettings` — brewery identity `{name, tagline, emoji, logo}` plus batch-volume defaults `{postBoilYield, lossPct}`. `logo` is a base64 data URL (or `null`); when set it overrides `emoji` in the header. Settings may also carry `avgKegs` (free text, like the recipe field); it is what the Settings tab actually edits, and `lossPct` survives only as the fallback for records saved before it existed. On the Supabase backend the non-identity fields live in one JSONB column, `settings.prefs` (migration 0012) — `postBoilYield` and `lossPct` had **no** home there at all: they shipped with the COGS work and were never added to the settings select/upsert, so every one was dropped on save and re-read as the built-in default. Anything new on the settings object goes in `SETTINGS_PREFS` or in a column of its own.

**Ingredient pricing.** Recipes and inventory speak generic brewer shorthand (`"2-Row"`, `"Caramunich I"`); vendors sell branded SKUs in vendor pack sizes. [src/lib/products.js](src/lib/products.js) bridges the two: a `products` catalog of what Slackers actually buys (SKU, vendor, product name, `packQty`/`packUnit`, `orderPack`) plus `defaultProductMap`, the per-category judgment layer mapping each generic name to a default SKU. Two names may point at one product (Midnight Wheat and Carafa Special III are the same sack) — they stay distinct in inventory and merge only when computing an order. An ingredient with no vendor product maps to `null` and is listed in `UNPRICEABLE` (currently just Brewzyme D, which no recipe uses — so every current recipe is fully costable).

⚠️ **`products.js` carries no prices, deliberately.** BSG stamps its price lists "TRADE SECRET CONFIDENTIAL" and this repo is public, so vendor prices must never be committed — including as test fixtures, which use fabricated round numbers. Prices live only in the private Supabase DB (`inventory.cost_per_unit`, and the `products` table, which the catalog ingest above is the first thing to actually write to), seeded once from a gitignored file under `pricing/` and edited in-app thereafter. The nightly backup repo is private, so the whole chain holds. A test in `products.test.js` fails if a `price` field reappears in the catalog.

[src/lib/pricing.js](src/lib/pricing.js) owns every vendor-pack → recipe-unit conversion (malt $/lb, hops $/lb→$/oz, yeast one 500 g brick = one `pack`, adjuncts per their own lbs/oz/ml/each). `costPerUnit()` returns **null**, never 0, when a product has no price or the units don't reconcile — an unpriced ingredient must surface in the UI rather than silently understate a cost. Derived prices are **stored rounded to the cent**: a vendor quote can carry more precision (malt at $0.724/lb, hops at $0.874375/oz once converted), but a price the UI shows to two decimals has to *be* two decimals or the cost column stops reconciling with the price beside it. Costs round *up*; a price rounds to *nearest* — it's a quote, not a cost. Worth at most ~$1.30 on a batch.

**COGS.** `computeRecipeCost()` in [src/lib/cogs.js](src/lib/cogs.js) totals a recipe's ingredient cost, splits it by category, and derives cost/bbl, cost/keg, and cost per 16 oz pint. Two invariants: an unpriced ingredient goes to `missing` and is **excluded** from the total, never costed at $0 (the Cost view reports the gap — a confidently wrong COGS is worse than an obviously incomplete one); and only one volume is stored, since a half-barrel keg is exactly ½ bbl, so cost/keg and cost/pint are derived from that one volume rather than tracked separately. **Every money figure is rounded UP to the cent** (`ceilCents`) — costing should never come in under what a batch actually costs. Line costs are rounded first and the subtotals/total built from the rounded lines, so the column on screen adds up to the total on screen; the three per-unit figures are each rounded independently, so they can sit a penny off exact halving. Cost per pint is of *packaged* beer and excludes taproom pour loss (foam, line purge, tasters), which the panel states. Packaged volume is `postBoilYield × (1 − lossPct) ÷ 31`, resolved in one place by `batchVolume()` — recipe `process.postBoilYield` (through the tolerant `parseVolume()`, since that field is free text) → the `settings` value → the `defSettings` default, for **both** fields. A recipe may override the brewery loss % with `process.avgKegs`, **what that beer actually yields**: kegs is the number a brewer counts on the floor, so the field asks for the measurement and `batchVolume()` back-solves the percentage (7 kegs off a 150 gal boil = 27.7% loss). The **brewery-wide default is the same field** (`settings.avgKegs`), back-solved the same way — but always against the SETTINGS kettle volume, never the recipe's: the setting is a ratio measured on the house batch, so dividing the house keg count into a recipe that boils 300 gal would read it as losing two thirds of its beer. It returns `lossPct` either way, so the cost math stays one number wide and double batches still scale by volume. A yield larger than the boil is a typo, not a yield — it's rejected back to the brewery default with a note on the panel, since costing must never divide by beer the brewery didn't make. An unset or cleared value means "use the brewery default", never 0% loss: the Cost panel used to fall back to 0 while Settings' preview fell back to 33, so a settings record saved before these fields existed (as prod's was) costed every batch against the full kettle volume — $90/bbl where the truth was $135. Defaults (150 gal, 33% loss) are Slackers' measured numbers and yield ~6.5 kegs; the Cost panel prints the whole basis (`150 gal less 33% loss = 3.24 bbl ≈ 6.5 kegs`) under the stat tiles so a per-bbl figure is never read against the kettle. Water salts are excluded — no price source, dosed in grams. [src/lib/applyPrices.js](src/lib/applyPrices.js) joins a `{sku: price}` file to the catalog and writes `cpu` onto inventory rows; [PriceImport.jsx](src/features/settings/PriceImport.jsx) is that flow in the UI.

⚠️ **A cost-per-unit field cannot be a plain controlled input**, which is why both surfaces go through [PriceInput](src/components/PriceInput.jsx). A stored price is rounded to the cent and displayed as `toFixed(2)`, so re-rendering it on every keystroke rewrites what's being typed: after the "1" of "1.09" the field became "1.00", the caret sat at the end, and the rest appended to give "1.0009" → **$1.01**. Every price with a non-zero second decimal was silently mistyped. The keystrokes own the field while it has focus; the stored value owns it on blur (which is also what normalizes "1.5" to "1.50").

**Price-list upload.** Both sources reduce to the same `{sku: {price}}` map before anything is written. [src/lib/pdfText.js](src/lib/pdfText.js) is the only module that touches pdf.js and is imported **dynamically** — the parser plus its worker are larger than the whole app, so they load on the first PDF and never at app start; a static import of it from anywhere in the tree silently undoes that. It hands lines to [src/lib/parsePriceList.js](src/lib/parsePriceList.js) (pure): a row is a line that STARTS with a vendor SKU (`[A-Z]{3,4}\d{3,4}[A-Z]?`) and carries a `$` amount, and the **first** price column is the one taken — the rest are 40+/200+/480+ quantity breaks Slackers never hits, the same assumption `products.js` documents. Prose that merely mentions money ("Pallet fee: $12.50") is not a product row. A SKU repeated at the SAME price is fine (the "New and Notable" block repeats rows); repeated at a DIFFERENT price it goes to `conflicts` and is surfaced, never silently resolved. [src/lib/pdfLines.js](src/lib/pdfLines.js) rebuilds lines from pdf.js's positioned fragments, re-emitting a wide x-gap as a double space so a description stays separable from its unit label.

Nothing is applied until it's confirmed: [src/lib/priceChanges.js](src/lib/priceChanges.js) diffs the parsed map against current inventory and [PriceReview.jsx](src/features/settings/PriceReview.jsx) renders it. It reports **three** outcomes, not a success count — `changes`, `unchanged`, and `skipped` (with a reason: `absent` from this list / `unmapped` to any product / `unconvertible` units) — because an ingredient a list doesn't price is not the same as one whose price didn't move, and collapsing them is how a half-applied import passes for a complete one.

**Hops in the catalog.** The spot hop list feeds the same catalog, through
[src/lib/hopCatalog.js](src/lib/hopCatalog.js), and it merges on a **different
key** — which is why it is its own module. The Houston list gives every product
a vendor SKU; the spot list has none at all, so identity here is the VARIETY and
the SKU is synthesised from it (`hopSku()`), extending the trick products.js
already plays with `HOP-CAS`. ⚠️ A variety we already buy MUST resolve to the SKU
products.js assigned it — a generated `HOP-CASCADE` beside `HOP-CAS` would be two
identities for one hop, and every rename/repack/discontinued check is keyed on
exactly that. `varietyOf()` reads the name by cutting the label at the product
form or the pack ("Cascade Pellet - 11lb", "Bravo™ Hop Pellet 44 lb",
"Strata® - 11lb", "Czech Saaz 11 lb/5 kg" — four shapes on one list), which also
drops the origin that trails some rows; **case is preserved here** unlike
everywhere else in the hop parse, because this name gets stored and printed.
Every row is quoted per pound, so entries are 1 lb packs with the box in
`orderPack`. Cryo/Enriched/CO2-extract rows are dropped and counted (extract is
priced per CAN); a 44 lb box is KEPT, unlike in the pricing path, because it is a
real product quoted per pound and on the April 2026 list it is the only way
Lemondrop appears at all. Prices are pooled per variety through the shared
`newestQuote()` in spotHops.js, so the number a brewer confirms on the review
screen and the number stored in the catalog are read the same way. On the April
2026 list: 69 rows → **57 varieties**, 46 of them hops Slackers doesn't stock.

⚠️ **Two places assumed the fourteen hops in `defaultProductMap` were all the
hops there are**, and both would have frozen an adopted hop's price silently.
The review is built from a LIST of hops rather than by walking inventory, so it
takes its targets from inventory now (archived rows excluded — "we stopped buying
it" already answers "why isn't this priced"); and `perOunce()` in
[HopPriceReview](src/features/settings/HopPriceReview.jsx) looked its SKU up in
`productsBySku` and gave up, leaving the New column blank for exactly the hops
the ingest had just added — it falls back to a 1 lb pack, which is the one thing
a spot hop list guarantees.

**The vendor catalog — everything the vendor sells, not just what we stock.** `products.js` describes the ~30 SKUs Slackers buys; the same price list carries 563 product rows, and all of them are now kept, so a recipe can call for a malt the brewery has never had. [src/lib/catalog.js](src/lib/catalog.js) turns `parsePriceList().rows` into catalog entries (vendor from the SKU's own code, pack size from the name, a category *when the list makes one obvious*) and [src/lib/catalogChanges.js](src/lib/catalogChanges.js) diffs them against what's stored. It rides along with the price import rather than being its own upload — it is the same file. Stored under the `catalog` key through the same `repo.js` seam as everything else (so it gets the CAS staleness guard), but **deliberately not in App.jsx state**: it is hundreds of rows only Settings and the ingredient picker need, and loading it at every mount would be a real cost for a list that changes monthly. Migration 0016 makes the `products` table able to hold it (adds `category`, drops the NOT NULL on `pack_qty`/`pack_unit`); prod's `products` table had been **empty** since 0008 created it.

⚠️ **The SKU is the identity; the name is an attribute.** Vendors rename, repack and drop things, and each means something different: `MRAH1102` "Rahr Standard 2-Row" → "Rahr The Brewer's Standard™ 2-Row" is cosmetic, while `AZZZ2901` "Mango Puree - 44.1 lb" → "- 44 lb" moves every derived cost, because pack size is the denominator. Matching on names instead would turn every rebrand into a duplicate product. A repack is only reported when **both** packs are known — a pack going from unreadable to readable is the parser learning something, not the vendor changing anything.

⚠️ **`discontinued` is scoped to SKU families the file actually covers**, and that scoping is the whole point. `MRAH1105` (Slackers' Pils) is on the June 2025 list and gone from the August 2026 one; a mapped SKU that stops appearing reads to `priceChanges()` as `skipped: "absent"` — identical to a hop list not carrying malts — so the price froze at its last quote for a year and nothing said so (fixed for that ingredient by migration 0015). But the Houston list carries no hops at all, so an unscoped check would report every hop as discontinued the moment a malt list was imported — re-creating that exact confusion in a louder font. A SKU counts as missing only when other SKUs of its own family (`MRAH`, `BZZZ`, our synthetic `HOP-*`) are present to be missing from.

**Adopting from the catalog — the one bridge to the shelf.** The catalog is
reference data; inventory is the counting sheet. [src/components/CatalogBrowser.jsx](src/components/CatalogBrowser.jsx)
searches it (name / vendor / SKU, bucket chips, `other` behind a "show everything"
toggle) and [AdoptDialog](src/components/AdoptDialog.jsx) turns one row into an
inventory row, via the pure [src/lib/adopt.js](src/lib/adopt.js) +
[src/lib/catalogSearch.js](src/lib/catalogSearch.js). It is reached from the
Inventory tab's **Add ingredient** and from `Browse catalog…` at the bottom of
each recipe Add picker (from a recipe it adds to the shelf AND to the beer, in
one action). The catalog is loaded when the panel opens, never into App state —
hundreds of rows nothing else needs at mount.

The dialog asks the three things a parser cannot answer, and **each answer is
load-bearing**: the NAME (suggested with the vendor prefix, ™/® and pack suffix
stripped, then EDITABLE — "Rahr The Brewer's Standard™ 2-Row" verbatim would
print on a brew sheet and sit beside the existing "2-Row"; this is the Carafa
lesson, so a name already on the shelf raises a plain warning, never a block);
the CATEGORY (prefilled where `classify()` was sure, required where it wasn't —
that is the payoff of leaving ~311 rows unclassified: nobody classifies 311
things, but a brewer classifies the one they are buying); and the PACK, where
several SKUs share a base name (79 of them do — Coriander Powder ships at 2 lb
and 50 lb, a 500 g yeast brick is one pitch and a 100 g one is a fifth of one).
The derived cost is SHOWN before committing, with the reason printed when it
can't be worked out (`unpriced` / `nopack` / `unconvertible`), so an
unconvertible unit is a sentence on screen rather than a silent null found later
inside a COGS total. Adopting lands the row at **qty 0** (Derek's call — no
quantity prompt).

**Linking an existing row.** Adopting creates a row; **linking** points one that
already exists at a product. Same act, different moment, and the second one is
needed because a row can arrive with no product at all — typed in by hand, or
created implicitly by the price field (the Whirlfloc case). Prod carried
`Candi Sugar, Dark` exactly like that: no SKU, no price, uncostable for good,
with nothing on screen saying which product it should be. On the Inventory tab, a row
whose own SKU decides carries a small `Link…` control beside its name, opening
the same browser in link mode; a mapped row is untouched and names its product
in the tooltip. ⚠️ **The words are spent only on a row that has NO product.**
Once one is linked — and every adopted row is born that way — the control stops
printing the resolved SKU and becomes a faint 🔗, with the SKU in the tooltip
exactly as a mapped row carries it: a vendor's internal code (`AZZZ1771`) shown
as a button in the ingredient column read as leftover UI, and it appeared on
every row the catalog work had touched, not the two the shelf started with. The
glyph stays because a link pointed at the wrong product must still be fixable.

⚠️ **That control is in the NAME cell, and only on rows that need it, because
the inventory tables have no width left.** Two cards on a 900px page gives each
table ~442px for four columns plus the archive button, and it was already 7px
over on Adjuncts. A Product column of its own took them to ~525px and pushed the
archive button off the right edge; printing the SKU beside every name wrapped 53
of 55 rows onto two lines and broke `HOP-CAS` across the break. Both were
obvious on screen and invisible to `innerText`. Anything new in these tables has
to come out of that budget.

⚠️ **The same 442px budget binds the recipe ingredient tables, and the Hops one
was already over it** (461px: ingredient, quantity, a stage dropdown wide enough
to tell "Dry Hop 1" from "Dry Hop 2", minutes, remove) — so the red `×` was cut
in half by the card's `overflow: hidden` and could not be clicked. Both table
families now use 8px cell padding rather than 10px, which buys back ~20px, and
RecEditTable keeps its table in an `overflowX: auto` container so content that
still overflows scrolls instead of being sliced. **Measure `scrollWidth` against
`clientWidth` per card after touching either — jsdom has no layout, so no unit
test will catch this.**

⚠️ **Linking is offered only where `isLinkable()` says the row's own SKU
decides** — i.e. `defaultProductMap` has no entry for that name. The curated map
is a brewery-wide editorial decision that wins over a row's `sku` (that is how
#83 repointed Pils by editing one line), so a per-row link on a mapped name
would look like it worked and change nothing. Two more rules: the dialog keeps
the **unit** editable for adjuncts, because a 25 kg pack against a row counted in
`each` reconciles to nothing however well it is linked (that was the actual
blocker on Candi Sugar, Dark) and it states the change rather than making it
quietly; and `linkFields()` writes a price **only when it derived one**, so
linking never blanks a number typed in by hand — the same rule a partial price
import keeps.

⚠️ **An adopted row carries its `sku`, and that is what keeps it alive.**
`skuFor()` in applyPrices.js resolves a row's product as `defaultProductMap`
first (a deliberate editorial decision in code — how #83 repointed Pils by
editing one line) then the row's own SKU, and `priceRows`/`priceChanges` take an
optional `{sku: entry}` catalog lookup for products `products.js` has never heard
of. PriceImport passes the rows it just parsed (falling back to the stored
catalog). Without both halves an adopted ingredient would report as
`skipped: "unmapped"` forever and its price would freeze at the day it was
adopted — silently, which is exactly the failure that hid a dead Pils SKU for a
year. `products.js` still wins where it has an entry: it is hand-checked and
carries things a parsed row cannot (Whirlfloc's tablet mass, without which
"each" has no size).

⚠️ **A category-locked browser carries the `unsorted` pile with it.** Opening it
from the Hops or Adjuncts table filtered to that bucket alone showed ZERO
products, because `classify()` never returns `hop` or `adj` — the mango purée,
the honey and the coriander all sit in `unsorted` (311 of 563). "The list didn't
say" has never meant "not an adjunct". Chips still narrow it, and an unsorted row
is labelled as such so a nylon bag in the malt list isn't implicitly a malt.

⚠️ **`classify()` has deliberately few rules and returns `null` freely.** Category decides which recipe table an ingredient may join, so a wrong guess files a malt under hops, and nothing downstream re-checks it. Only what the list demonstrates outright: the whole `M` range is malt (163/163 rows, all quoted per lb), `SafAle`/`Fermentis`/`LalBrew`/`DADY` are yeast, `E`/`X` are equipment and merchandise and are fenced off from every ingredient picker. That leaves ~311 of 563 unclassified, reported as its own number. **Do not widen these to raise the classified count** — the obvious brand sweep was wrong twice: the list's "Yeast Nutrients" section holds Yeastex® 61, and the Kerry Pathfinder range ends in "Pathfinder N-Pure Seltzer Nutrient". Both are nutrients named like yeast. A human assigns the category when the ingredient is adopted, and `catalogChanges()` preserves a corrected category across re-imports rather than overwriting it with the guess.

⚠️ **A dropped PDF is routed by its CONTENT, not by whether it has text.** `parsePriceList()` gets first look and claims the file if it holds vendor SKU rows; the spot hop parser gets the next look and claims it if it holds a variety × crop-year table; only a PDF with no text layer at all goes to OCR. Routing on `hasText` alone was correct only while the hop list was image-only, and it broke the moment that stopped being true (see below) — a document with text is not thereby a *price list*.

**Spot hop list.** This is the only source of hop pricing (the Houston list carries no hops), and it arrives in two forms that reduce to the same parse. An **Excel export** has a real text layer: `extractPdfWords()` in [pdfText.js](src/lib/pdfText.js) returns pdf.js's positioned fragments as words, exactly, and no OCR engine ever starts. A **scanned** one is rasterized and read by tesseract.js, in [src/lib/ocr.js](src/lib/ocr.js) (the only module that touches it, dynamically imported — the wasm engine and language model fetch on first use). Both hand `spotHops.js` the same shape, `{text, x0, x1, y0, y1}` with y counting **down** the page; the exact path must flip pdf.js's bottom-up y to match, or the table is walked upside down and every header arrives after the rows it labels.

Two things about the OCR path are load-bearing: pages render with **`intent: "print"`**, because pdf.js's default display path drives itself with `requestAnimationFrame` and a BACKGROUND TAB never fires it — the render then never resolves, silently, forever; and each page is **binarized** before OCR (luminance threshold 170), because the list prints dark blue type on alternating green/grey stripes, which more than doubled the prices found on a sample page. Pages render and release one at a time (a page at `OCR_SCALE` is ~30MB of canvas). The text path renders too, but at preview scale only, so the review screen can still show the page a price came from.

[src/lib/spotHops.js](src/lib/spotHops.js) turns those words into prices, and is written around the fact that **a number is provisional until a human confirms it** — exact text removes misread digits but not the risk that matters, a price matched to the wrong row or the wrong crop year. Column geometry is the crux: the table is variety × crop year, so a price means nothing without the column it sits under.

⚠️ **The crop year taken is the NEWEST the list carries, because that is what Slackers buys** — it is read off the list, never stored. `products.js` used to carry a `cropYear` per hop and prefill only on an exact match, which is how stored snapshots always fail: the catalog said 2022–2024, the April 2026 list quoted 2023–2025, and five hops sitting right there on the page prefilled nothing. Prices are also pooled across **every** matching row rather than taken from one — the list carries two Amarillo pellet rows, a starred American/German one priced 2023–2025 and a German one priced 2023 only at a third of the money, and picking a single row by shortest label read a two-crop-stale $3.99 as current. Nothing is prefilled when the answer isn't clean: two rows quoting **different** prices for the newest year set `conflict` and prefill nothing, while the same price quoted twice is agreement. Every quote found stays in `available` as a one-click chip, so an older crop is always one click away.

Hard-won details, all of which were real failures: only an uppercase `ORIGIN` on a price-free row marks the origin column (the list's own footnote says "…crop **origin** may fluctuate…", and reading that as the header truncated every label below it, dropping two thirds of a page); a label word is claimed by its **start** x, not its end (OCR runs a whole variety cell into one wide token that overhangs the column); the price pattern stays anchored with a short unit suffix (`/lb`, `/Ib`, `/1b`, `/b`) so the header's phone number `1.800.374.2739` can't read as $1.80; `l`/`I`/`1`/`|` are folded on both sides when matching, since "Idaho 7" comes back as "ldaho 7"; and Cryo/Enriched/44 lb/CO2-extract rows are excluded outright — they're different products at their own prices and sometimes their own unit (extract is quoted per **can**), and pooling rows means a month where only the extract is printed would otherwise have taken it. The page's header row is read in a **pass of its own and applies to the whole page, rows above it included**: this is a spreadsheet print-out, and Excel leaves the repeated header wherever the page break falls — on the April 2026 list page 2 opens straight into Mosaic and doesn't print its year header until two thirds down, so trusting a header only after passing it dropped the first thirteen rows of that page whole. **Two prices that land in the same crop-year column mark the row `ambiguous`**, which prefills nothing and says so on screen: a misread year header shifts every boundary, and offering a 2024 price as the 2023 one is precisely the confident lie the review screen exists to prevent.

⚠️ **Partial coverage is by design, not a bug to hide.** On the scanned July 2025 list OCR prefills roughly a third of the 14 hops. The April 2026 text list reads all 69 rows exactly and prefills **11 of 14**; the three misses are real absences, not parse failures (Pink Boots isn't on it, Lemondrop was 44 lb only that month, and "Idaho Gem" is a different hop from Idaho 7). Those read "not found on this list" and are typed in, with the page one click away in the same panel ([HopPriceReview.jsx](src/features/settings/HopPriceReview.jsx) — prices entered per pound as the list quotes them, shown converted to the per-ounce figure that gets stored; the panel says which way the list was read, since "check this against the page" means something different for a guess than for an exact read). Never widen a match rule to raise the prefill count at the cost of certainty.

⚠️ **The BSG PDFs are not all the same kind of file, and the hop list's kind CHANGED.** The Houston price list is an Excel export with a real text layer and prices all 32 BSG-SKU products in the catalog. The July 2025 spot hop list was **four JPEG images with no text layer at all** (printed from a screenshot — `pdffonts` reports zero fonts); the April 2026 one is an ordinary Excel export with real text. Either way it carries no SKUs, which is why hop products have synthetic ones (`HOP-CAS`) and match by variety, taking the newest crop year the list quotes. Check a new list with `pdffonts` before assuming which path it takes — and note that `hasText` distinguishes *scanned from not*, never *hop list from price list*.

## Key Computed Logic

`computeOrder()` in [src/lib/orderCalc.js](src/lib/orderCalc.js) aggregates selected recipe needs, compares against current inventory, and returns `{malts, hops, yeast, adj}` arrays with `{n, need, have, order}` per ingredient. `maltBags(order)` computes 55 lb bag counts. Both are pure and unit-tested in `orderCalc.test.js`.

The printable sheets each have a pure recipe→view-model builder, kept out of the React component so the layout + routing are unit-testable: `buildBrewSheet()` ([src/lib/brewSheet.js](src/lib/brewSheet.js)) for Brew Day (brew-day-stage additions, grain bill, salts; excludes cellar stages + yeast) and `buildCellarSheet(recipe, brewDate)` ([src/lib/cellarSheet.js](src/lib/cellarSheet.js)) for Cellar Summary (schedule date math + routing to cold-crash/bung/dry-hop/rouse/transfer/carb/keg boxes — dry hop returns `charges: [{charge, items, date}]`, one block per charge, each hop printing its own charge's date; a charge with neither hops nor a scheduled day is omitted, and the charge number is only shown when there's more than one + yeast + ferm temp + cellar additions. `misc` (off-brew-day adjuncts) carries `stage`/`stageLabel` and a `date`, ordered by where the stage falls in the process; only the stages a schedule action actually dates get one (rousing/transfer/keg — the rest stay a write-in rather than print a guessed date), and an unknown stage keeps recipe order at the end since the stage is free text; the Packaging Summary's first row pre-fills the keg date). Both builders print target gravities through [src/lib/gravity.js](src/lib/gravity.js): OG/FG format to 3 decimals (`fmtGravity`) and the Brew Sheet's ABV is derived as (OG − FG) × 131.25 (`computeAbv`), falling back to the stored recipe `abv` only when a gravity is missing. The Brew Sheet's right-hand process readings ([BrewSheetPanel.jsx](src/features/recipes/BrewSheetPanel.jsx)) mirror the paper Brew Day worksheet 1:1 and come in three kinds (see `READING_GROUPS`): editable+persisted planned Target values (bound to `recipe.process` via inline inputs — strike temp, volumes, mill/vorlauf/runoff/boil timings, pre/post-boil gravity + yield targets, pH targets, WP/KO temps), a read-only mirror (Mash Temp echoes `mt`), and printed empty checkboxes for brew-day prep steps ticked by pen (water cycled, pH calibrated). Every reading's Actual column is a blank write-in filled by pen on brew day. Editing happens inline on the sheet, not in a separate form.

[src/lib/backup.js](src/lib/backup.js) handles data export/import: `buildBackup()` serializes all `slackers_brew_*` localStorage into a portable JSON object; `applyBackup()` validates and restores one (clearing existing app keys first). It also served as the localStorage→Supabase migration tool.

## Style Conventions

- Inline CSS-in-JS objects only — no CSS file, no Tailwind. Shared objects in [src/styles.js](src/styles.js).
- Color accent: `#f59e0b` (amber)
- Neutral grays from Tailwind's slate palette
- Shared style vars: `cell`, `num`, `inp`, `th`, `btn`, `card`, `hdr`, `badge`, `rmBtn`, `addRow`, `sel`, `addBtn`, `tabBtn`, and `segWrap`/`segBtn` for a tab's own sub-nav (Recipes' four views, Analytics' two) — distinct from `tabBtn` on purpose: the top nav is where you are in the app, a segmented control is which lens you're using on what's already selected

## Testing

Vitest + React Testing Library (jsdom). Tests are co-located with source (`*.test.js[x]`); shared setup in [src/test/setup.js](src/test/setup.js). Prefer unit-testing pure logic in `lib/`. CI runs lint + test + build on every push/PR.

## Working Conventions

- **Persist the roadmap to memory by default.** When we make a significant decision, finish a work chunk, or define the next step, save it to project memory so it survives across sessions — keep the relevant roadmap file (e.g. `data-layer-roadmap.md`) current rather than relying on the session todo list (which is ephemeral). Update or prune stale entries instead of duplicating.
- **Branch → PR workflow.** `main` is protected; land all changes through a PR that passes CI (lint + test + build + CodeQL). Branch prefixes: `feat/`, `fix/`, `chore/`.
- **CodeRabbit reviews PRs, advisory only.** A GitHub App (not a workflow) configured by [.coderabbit.yaml](.coderabbit.yaml); free on public repos. Its value is *independence* — nearly all code here is written by the same model that reviews it — so expect it on generic footguns (unguarded reads, the cause of all three white screens) and NOT on what this repo actually gets wrong: the 442px table budget, rounding direction, crop-year column geometry, CAS staleness. ⚠️ **It must never gate a merge**: merging runs `supabase db push` against prod and deploys, so the gate stays CI. `request_changes_workflow` is pinned false — don't add its commit status to branch protection. The config disables its bundled eslint/biome/oxc (`npm run lint` is the one lint authority; a second linter reports non-violations, and noise is what gets a reviewer ignored) while keeping secret scanning on, since the never-commit-a-price rule is only as good as its last diff. `CLAUDE.md` is registered as its code guidelines, which is what stops this file's deliberate decisions reading as bugs; `path_instructions` cover migrations, the money code, `products.js` and the table widths. Config is read from the **PR head branch**, so a change to it applies to its own PR.
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
| PDF | pdf.js (`pdfjs-dist`), dynamically imported — price-list upload only |
| OCR | tesseract.js, dynamically imported — scanned hop list only (engine + model load from CDN on first use) |
| Auth | Supabase Auth (magic link + Google OAuth), only when Supabase is configured |

## What Doesn't Exist

- No TypeScript, no CSS framework, no routing/state library, no undo/redo
