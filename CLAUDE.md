# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
npm run dev                       # Vite dev server
npm run build                     # type-check (vue-tsc) + vite build, in parallel
npm run type-check                # vue-tsc --build only
npm run lint                      # oxlint --fix then eslint --fix (both auto-fix in place)
npm run test:unit                 # Vitest in watch mode
npm run test:unit -- --run        # single run (used in CI / validation)
npm run test:unit -- --run -t "resumes game"   # run one test by name
```

Node `^20.19.0 || >=22.12.0`. Full validation before a PR: `npm run lint && npm run test:unit -- --run && npm run build`.

## Architecture

Single-page karaoke score counter. Two source files carry essentially all the behavior:

- **`src/stores/game.ts`** — the entire application state machine, a Pinia setup store. There is no router; `screen` (`'setup' | 'round' | 'total'`) is a store field and `App.vue` switches on it. All four pieces of state (`players`, `currentRound`, `screen`, `nextPlayerId`) are `useLocalStorage` refs (VueUse) keyed `screen-counter:*`, so the game auto-persists and auto-restores across reloads with no explicit save/load code.
  - `sanitizeState()` runs once at store construction to repair whatever came back from localStorage (coerce types, drop nameless/invalid players, clamp `currentRound`, reset to `setup` when empty). Keep this defensive — persisted data from older versions can be any shape.
  - `ensureRound(i)` lazily grows every player's `scores` array so index `i` exists; increment/decrement/nextRound all call it before touching `scores[currentRound]`. Scores are clamped to `MIN_SCORE`/`MAX_SCORE` (0–99).
  - `startGame` resets scores; `resumeGame` keeps them. Both just set `screen = 'round'`.

- **`src/assets/main.css`** — the layout is the hard part of the UI, not the markup. The app is locked to the viewport (`100dvh`, `overflow: hidden`, no page scroll). Sizing is almost entirely `vmax` / `clamp(px, vmax, px)` so it scales with the larger screen dimension for across-the-room readability. `.score-grid` sizes its columns/rows to the player count: the store exposes `gridMajor`/`gridMinor` (larger/smaller axis, from `rows = ceil(sqrt(n/2))`, `cols = ceil(n/rows)`), `App.vue` passes them as `--grid-major`/`--grid-minor` inline styles, and the CSS maps major→columns / minor→rows in landscape and swaps them under `@media (orientation: portrait)`. `minmax(0, 1fr)` keeps every card inside the locked viewport with no scroll, so large player counts shrink the cards rather than overflow. Card text tracks the card box, not the viewport: `.score-card` is a `container-type: size` query container and its text (`.round-score`, `h3`, `.total-score`, `.grand-total`, etc.) is sized in unclamped `cqmin` units, so it stays proportional as cards shrink and in both orientations. Everything outside the cards still uses `vmax` / `clamp()`. `App.vue` sets the background image via a `--bg-image` CSS custom property inline.

`App.vue` is presentational: it renders one of three `<section>`s by `game.screen` and wires buttons straight to store actions. `src/main.ts` is boilerplate (Pinia + mount).

## Deployment

`.github/workflows/deploy-pages.yml` builds and deploys to GitHub Pages on every push to `main`. `vite.config.ts` derives `base` from `GITHUB_REPOSITORY` when running in Actions (so it serves correctly from `/<repo>/`), and `/` otherwise.

## Conventions

- `@` path alias → `src/`.
- Lint scripts always pass `--fix`; run `npm run lint` and let it rewrite rather than hand-fixing style.
- Store tests (`src/stores/__tests__/game.spec.ts`) clear `localStorage` and call `setActivePinia(createPinia())` in `beforeEach`; persistence is tested by re-creating the pinia instance and reading state back.
