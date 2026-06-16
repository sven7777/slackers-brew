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
```

## Architecture

**Single component:** All logic and UI live in [src/App.jsx](src/App.jsx). There is no routing, no CSS file, and no state management library — just React hooks with inline style objects.

**Three tabs:**
- **Inventory** — editable quantity inputs for all ingredients
- **Recipes** — view/edit ingredient lists per recipe; add/remove ingredients
- **Order Calculator** — select recipes (single/double batch) → computed order summary

**localStorage keys** are prefixed `slackers_brew_` and JSON-stringified. Keys: `tab`, `malts`, `hops`, `yeast`, `adj`, `selR`, `orders`, `recipes`.

## Data Model

Ingredient defaults at the top of [src/App.jsx](src/App.jsx):
- `defMalts` — 19 malts, quantity in lbs
- `defHops` — 14 hops, quantity in oz
- `defYeast` — 8 yeast strains, quantity in packs
- `defAdj` — 12 adjuncts with per-item units (lbs/oz/ml/each)

`defRecipes` — 18 preset recipes, each `{n, s, m[], h[], y[], a[]}` (name, style, malts, hops, yeast, adjuncts). Recipe arrays use `[name, quantity]` tuples; adjuncts use `[name, quantity, unit]`.

## Key Computed Logic

`orderCalc` (useMemo) aggregates selected recipe needs, compares against current inventory, and returns `{malts, hops, yeast, adj}` arrays with `{n, need, have, order}` per ingredient. Malts also include `bags` (ceil(order / 55lbs)).

## Style Conventions

- Inline CSS-in-JS objects only — no CSS file, no Tailwind
- Color accent: `#f59e0b` (amber)
- Neutral grays from Tailwind's slate palette
- Shared style vars: `cell`, `num`, `inp`, `th`, `btn`, `card`, `hdr`, `badge`, `rmBtn`, `addRow`, `sel`, `addBtn`

## Tech Stack

| | |
|---|---|
| Framework | React 19 |
| Build | Vite 8 |
| Compiler | Oxc (via @vitejs/plugin-react) |
| Lint | ESLint 9 (flat config) |
| Language | JSX (no TypeScript) |
| Storage | Browser localStorage |

## What Doesn't Exist

- No TypeScript, no CSS framework, no tests, no backend, no export/import, no undo/redo
