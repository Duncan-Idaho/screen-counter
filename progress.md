# Issue #10 — beta/stable parallel deploy

Done and verified (lint, 171 tests, stable build, beta build with /beta/ base + beta storage prefix). PR #11 open.
Fixes after first push: vitest.config calls the vite config function; `build:beta` split into `build-only:beta` (run-p swallowed `--mode`).

Remaining (human): after merge, create `beta` branch: `git push origin main:beta`.
