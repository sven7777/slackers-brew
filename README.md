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
  and adjuncts (per-item units), with each ingredient's cost per unit and what
  the stock on hand is worth — subtotalled per category and totalled for the
  whole shelf. An ingredient with no price reads "unpriced" and stays out of the
  total rather than counting as free. Prices live on the ingredient, so editing
  one here also changes every recipe's cost. An ingredient you've stopped buying
  can be **archived** instead of deleted: it leaves the shelf but keeps its price,
  a toggle shows the archived ones again, and recipes and the Order Calculator
  still see it. **Add ingredient** browses the vendor catalog — search the whole
  price list by name, vendor or SKU, then adopt one onto the shelf: you name it,
  say which kind of ingredient it is and pick the pack size you buy, and the
  price per pound (or ounce, or pitch) is worked out and shown before you commit.
  An ingredient nothing maps to a vendor product — one you typed in yourself —
  shows a **Link…** control; pointing it at a product on the list prices it and
  keeps it priced on every import after that. Once it is linked the words give
  way to a faint 🔗 (hover any ingredient to see which product prices it), so
  the wrong link is still fixable without a column of vendor codes.
- **Recipes** — pick a recipe once, then switch between four views of it:
  - **Edit** — name, style, target gravities, mash and fermentation temps, plus
    the ingredient lists per recipe; add or remove ingredients across malts,
    hops, yeast, and adjuncts; edit the per-recipe cellar schedule; import
    recipes straight from a BeerSmith `.bsmx` file. The Add picker lists your own
    ingredients, with **Browse catalog…** at the bottom for something you've
    never bought — adopting there adds it to the shelf and to the beer at once. Style is picked from the
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
- **Analytics** — three views of the whole book. **Beers** costs every beer side by
  side: batch total, cost per bbl, per keg and per 16 oz pint, sortable by any of
  them, with brewery-wide averages and the cheapest and dearest beer per barrel.
  Each beer is costed against its own yield, so one with a measured keg count
  isn't compared on the brewery default. A recipe with an unpriced ingredient
  shows what the priced part costs, marked, and stays out of the averages — and a
  separate list ranks the unpriced ingredients by how many beers each one is
  blocking, so you can see that one missing malt price is holding up four beers.
  Clicking a beer opens its full cost breakdown. **Overhead** stacks the rest of
  the cost on top: production labor and the allocated cost of being open, divided
  by pints actually *sold* rather than pints packaged. It separates the direct
  cost (whether one more pint is worth pouring) from the absorbed cost (whether
  the business works at this volume), and shows what each overhead line comes to
  per pint — ingredients are a few percent of a pint, so this is where the money
  actually is. An operating cost you haven't entered is named and left out rather
  than counted as zero, and the total is marked as the floor it is. **Pricing**
  puts the board beside that cost and subtracts what a menu never shows: sales
  tax, card processing, excise, and gross receipts if your permit owes it. How
  much that is turns on one question the view asks outright — whether a board
  price already includes sales tax or the register adds it. On an $8.00 pint
  that answer alone is worth $0.61, more than the pint's whole margin, so it is
  asked rather than assumed and printed above every figure that depends on it.
  It prices every serving size against the same cost — the per-ounce column is
  the point, since one price for a 12 oz and a 16 oz makes the pint the cheapest
  beer on the menu by volume — recommends a price for a target margin, and prices
  every beer at *its own* pour, because a 9% tripel poured at 8 oz is a property
  of that beer and is set on its row.
- **Settings** — brewery identity (name, tagline, logo), the default batch
  volume that drives costing — post-boil yield plus the average kegs a batch
  packages, which is where the brewhouse loss % comes from — the serving sizes and board
  prices the Pricing view works from, operating costs (production, taproom
  losses, labor, monthly overhead and what comes off a retail price), ingredient
  pricing (upload the
  vendor's PDF price list, see exactly which prices would change, then apply —
  the spot hop list is read too, from its text when it has one and by OCR when
  it's a scan, with every price shown against the page it came from and editable
  before anything is saved). The same upload also builds the **vendor product
  catalog** — every product on the list, not only the ones you stock, so a recipe
  can call for something the brewery has never bought (browsed and adopted from
  the Inventory tab or a recipe's Add picker) — and tells you what the vendor
  renamed, repacked, or stopped selling. The spot hop list feeds it too: every
  variety on the page, not just the ones you buy, each priced at the newest crop
  year the list carries. Finally, a
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
