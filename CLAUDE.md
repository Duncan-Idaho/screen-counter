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

- **`src/stores/game.ts`** — the game state machine and navigation, a Pinia setup store. There is no router; `screen` (`'setup' | 'round' | 'total' | 'settings'`) is a store field and `App.vue` switches on it. Every piece of state (`players`, `currentRound`, `screen`, `nextPlayerId`, `settingsReturnScreen`) is a `useLocalStorage` ref (VueUse) keyed `screen-counter:*`, so the game auto-persists and auto-restores across reloads with no explicit save/load code. **Appearance state does not live here** — see `src/stores/settings.ts`.
  - `sanitizeState()` runs once at store construction to repair whatever came back from localStorage (coerce types, drop nameless/invalid players, clamp `currentRound`, reset to `setup` when empty). Keep this defensive — persisted data from older versions can be any shape. Note the `settings` screen is deliberately exempt from the reset-to-setup-when-empty rule: it needs no players. Adding a screen means updating **both** the `ScreenName` union and the validation array here.
  - Settings is reachable from every screen, so `openSettings()` records the current screen in `settingsReturnScreen` and `closeSettings()` returns to it (falling back to `setup` when there are no players).
  - `ensureRound(i)` lazily grows every player's `scores` array so index `i` exists; increment/decrement/nextRound all call it before touching `scores[currentRound]`. Scores are clamped to `MIN_SCORE`/`MAX_SCORE` (0–99).
  - `startGame` resets scores; `resumeGame` keeps them. Both just set `screen = 'round'`.

- **`src/assets/main.css`** — the layout is the hard part of the UI, not the markup. The app is locked to the viewport (`100dvh`, `overflow: hidden`, no page scroll). Sizing is almost entirely `vmax` / `clamp(px, vmax, px)` so it scales with the larger screen dimension for across-the-room readability. `.score-grid` sizes its columns/rows to the player count: the store exposes `gridMajor`/`gridMinor` (larger/smaller axis, from `rows = ceil(sqrt(n/2))`, `cols = ceil(n/rows)`), `App.vue` passes them as `--grid-major`/`--grid-minor` inline styles, and the CSS maps major→columns / minor→rows in landscape and swaps them under `@media (orientation: portrait)`. `minmax(0, 1fr)` keeps every card inside the locked viewport with no scroll, so large player counts shrink the cards rather than overflow. Card text tracks the card box, not the viewport: `.score-card` is a `container-type: size` query container and its text (`.round-score`, `h3`, `.total-score`, `.grand-total`, etc.) is sized in unclamped `cqmin` units, so it stays proportional as cards shrink and in both orientations. Everything outside the cards still uses `vmax` / `clamp()`; new UI must follow suit — no `rem`. Because the viewport is locked, `.setup-panel` and `.settings-panel` are the only panels allowed `overflow: auto`, since their content is a list that legitimately outgrows a short screen. The total screen's per-round breakdown (`.round-list`) is a value-only grid split into exactly one cell per round via `--round-major`/`--round-minor` (from `roundMajor`/`roundMinor` in the store, same `splitGrid` helper as the player grid, transposed in portrait); each `.round-item` is its own `container-type: size` container so the digit fills its cell in `cqmin` and shrinks automatically as rounds accumulate — every round stays visible, never clipped. `App.vue` sets the background image via a `--bg-image` CSS custom property inline, and the theme overrides ride along the same way (below).

The rest is the theming feature:

- **`src/stores/settings.ts`** — appearance only (background image + theme), deliberately a **separate** Pinia store from `game.ts` so colors never mix with players and scores. `DEFAULT_THEME` mirrors the palette `main.css` ships in `:root`, so an untouched theme renders identically to before the feature existed. `sanitizeSettings()` mirrors `sanitizeState()`: it rebuilds the theme from `DEFAULT_THEME` (dropping unknown keys from older persisted shapes) and falls back per-key on anything `parseColor` rejects. The `cssVars` getter maps theme keys to the `--app-text` / `--overlay` / … custom property names, and `App.vue` spreads it into the same inline `:style` on `.app` as `--bg-image` — which is why the theme also applies to the settings screen itself, giving a live preview. Adding a themeable color means touching four places in lockstep: `DEFAULT_THEME`, `THEME_FIELDS` (drives the UI), `THEME_CSS_VARS`, and the `:root` default in `main.css`.
- **`src/lib/color.ts`** and **`src/lib/backgroundImage.ts`** — pure/DOM helpers kept out of the stores so the stores stay free of DOM APIs (`FileReader`, `Image`, canvas) and stay testable. `parseColor` returns `null` rather than a fallback so callers own the default. `fileToBackgroundDataUrl` downscales anything over 3 MB to a JPEG so the base64 string stays inside the localStorage quota.
- **`src/components/ColorPicker.vue`** — the only component. Native `<input type="color">` plus an opacity `<input type="range">`, because `<input type="color">` cannot carry alpha and most of the palette is `rgba()`. Both inputs rebuild a full `Rgba` from the current value before emitting, so editing the hue keeps the alpha and vice versa.

`App.vue` is presentational: it renders one of four `<section>`s by `game.screen` and wires buttons straight to store actions. `src/main.ts` is boilerplate (Pinia + mount).

## Deployment

`.github/workflows/deploy-pages.yml` builds and deploys to GitHub Pages on every push to `main`. `vite.config.ts` derives `base` from `GITHUB_REPOSITORY` when running in Actions (so it serves correctly from `/<repo>/`), and `/` otherwise.

## Conventions

- `@` path alias → `src/`.
- Lint scripts always pass `--fix`; run `npm run lint` and let it rewrite rather than hand-fixing style.
- Store tests (`src/stores/__tests__/*.spec.ts`) clear `localStorage` and call `setActivePinia(createPinia())` in `beforeEach`; persistence is tested by re-creating the pinia instance and reading state back. `useLocalStorage` keeps string refs **raw**, so seed them with `setItem(key, 'settings')`, never `JSON.stringify`.
- Specs must live in a `__tests__` directory: `tsconfig.app.json` excludes that path, `tsconfig.vitest.json` includes it, and `eslint.config.ts` scopes the vitest rules to it. `tsconfig.vitest.json` sets `lib: []`, so newer built-ins (e.g. `Array.prototype.at`) are not typed in tests even though they run fine.
- Vitest `globals` is off — import `describe`/`it`/`expect` explicitly.
