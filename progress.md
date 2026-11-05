# Issue #10 — beta/stable parallel deploy

Done: storageKey helper + spec, stores use it, projection window name, vite channel (APP_CHANNEL or --mode beta), `build:beta` script, App.vue badge + title, i18n en/fr, CSS badge, workflow (both branches → one artifact), CLAUDE.md docs + promotion process.

NOT verified: npm commands (lint/test/build, stable + beta) could not be run (approval denied in this session). Run `npm run lint && npm run test:unit -- --run && npm run build && npm run build:beta`.
Check in particular: `define` of `import.meta.env.VITE_APP_CHANNEL` actually takes effect in the beta build (dist/ should have `/beta/` asset paths and badge).

Remaining (human, after merge): create `beta` branch from `main` (`git push origin main:beta`) — not done by me (publication).
