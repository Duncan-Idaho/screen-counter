# screen-counter

Fullscreen karaoke score counter built with Vue 3, TypeScript, and Pinia.

## Features

- Setup screen to add/remove players and start a fresh game or resume an existing one.
- Round screen with responsive team blocks, per-round score, total score, and +/- controls.
- Total screen with team totals and round-by-round score history in a 3-column grid.
- Full-screen bar backdrop based on `https://lechaperonrouge.pub/` via an external capture URL.
- GitHub Pages deployment workflow in `.github/workflows/deploy-pages.yml`.

## Development

```sh
npm install
npm run dev
```

## Validation

```sh
npm run lint
npm run test:unit -- --run
npm run build
```
