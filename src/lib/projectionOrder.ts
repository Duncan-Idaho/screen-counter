// Projection-window-only score ordering. Kept pure and out of the store/
// components so it stays testable without a DOM - see color.ts/backgroundImage.ts.

import type { Player } from '@/stores/game'

// Resort this long after songNumber/currentRound changes (ScoreGrid.vue).
export const SORT_DELAY_MS = 2000
// CSS transform transition duration for the reorder slide (must match the
// `.score-order-move` rule in main.css).
export const MOVE_DURATION_MS = 2000
// A card's glow stays solid through the burst (0-2s) and the reorder
// (2-4s); the last ~1s fade-out is a CSS transition, not a JS phase.
export const HIGHLIGHT_HOLD_MS = SORT_DELAY_MS + MOVE_DURATION_MS

// Stable sort, descending by total score - ties keep their relative order.
export function sortByTotalScore(players: Player[], getTotal: (player: Player) => number) {
  return [...players].sort((a, b) => getTotal(b) - getTotal(a))
}
