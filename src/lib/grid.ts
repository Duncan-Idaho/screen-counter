// Grid splitting for the card grids. Kept pure and out of the store so both the
// store (player cards, from the roster) and a component (the total screen's
// breakdown, whose cell count depends on a setting the store deliberately does
// not know about) can call it - see color.ts/projectionOrder.ts.

// Split `count` cells into a landscape-biased grid: `minor` is the smaller
// axis, `major` the larger (major >= minor). Used for both the player card
// grid and the per-round breakdown; main.css maps major->columns / minor->rows
// in landscape and swaps them in portrait.
export function splitGrid(count: number) {
  const n = Math.max(1, count)
  const minor = Math.ceil(Math.sqrt(n / 2))
  return { major: Math.ceil(n / minor), minor }
}
