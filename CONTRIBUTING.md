# Contributing to Slackers Brew

Thanks for your interest in contributing. This document covers the workflow and
expectations for changes to the project.

## Development setup

**Prerequisites:** Node.js (see [.nvmrc](.nvmrc) for the supported version) and npm.

```bash
npm install      # install dependencies
npm run dev      # start the dev server at http://localhost:5173
```

## Workflow

`main` is protected — all changes land through pull requests that pass CI.

1. Create a branch off `main`. Use a descriptive prefix:
   - `feat/` — new functionality
   - `fix/` — bug fixes
   - `chore/` — tooling, deps, docs, config
2. Make your change, with tests where it makes sense.
3. Run the full check locally before pushing:
   ```bash
   npm run lint
   npm test
   npm run build
   ```
4. Open a PR against `main` and fill out the template. CI (lint + test + build +
   CodeQL) must pass before merge.

## Testing

Tests run on [Vitest](https://vitest.dev) with React Testing Library.

```bash
npm test          # single run (what CI runs)
npm run test:watch # watch mode while developing
```

Core calculation logic lives in [src/lib/](src/lib/) as pure functions — prefer
adding logic there with unit tests over embedding it in components.

## Code style

- Match the existing style in [src/App.jsx](src/App.jsx): React hooks, inline
  style objects, no CSS files or CSS frameworks.
- Keep `npm run lint` clean.
- See [CLAUDE.md](CLAUDE.md) for architecture and conventions.
