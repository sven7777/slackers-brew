# Slackers Brew

A homebrew inventory and order-management tool for tracking brewery ingredient
stock and calculating the quantities needed to brew a set of recipes. Built for
the Slackers brewing group. All data persists to your browser's localStorage —
there is no backend or account required.

## Features

- **Inventory** — track on-hand stock of malts (lbs), hops (oz), yeast (packs),
  and adjuncts (per-item units).
- **Recipes** — view and edit ingredient lists per recipe; add or remove
  ingredients across malts, hops, yeast, and adjuncts.
- **Order Calculator** — select recipes (single or double batch) and get a
  computed order summary: how much you need, how much you have, and how much to
  order. Malts also roll up into 55 lb bag counts.

## Running Locally

**Prerequisites:** Node.js (v18+) and npm installed.

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
```

## Tech Stack

- **React 19** with hooks (no state-management library)
- **Vite 8** build tooling
- **ESLint 9** (flat config)
- Plain JSX — no TypeScript
- Browser **localStorage** for persistence

## Data & Privacy

All inventory, recipe, and order data lives in your browser's localStorage
under keys prefixed `slackers_brew_`. Nothing is sent to a server. Clearing your
browser data will reset the app to its default ingredient and recipe lists.

## License

[MIT](LICENSE) — free to use, modify, and distribute.
