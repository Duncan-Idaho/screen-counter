// Projection-window-only score ordering and animation timings. Kept pure and
// out of the store/components so it stays testable without a DOM - see
// color.ts/backgroundImage.ts.

import type { Player } from '@/stores/game'

// CSS transform transition duration for the totals reorder slide (must match
// the `.score-order-move` rule in main.css).
export const MOVE_DURATION_MS = 2000

// Reveal sequence (ScoreboardCard.vue): the card fades in wearing its glow while
// the cards already on screen slide aside, the confetti burst only fires once
// that placement has settled, and the glow outlasts the burst. Each value must
// match its counterpart in main.css.
export const REVEAL_ENTER_MS = 400
export const REVEAL_MOVE_MS = 600
export const CONFETTI_DURATION_MS = 1400
export const CONFETTI_DELAY_MS = REVEAL_MOVE_MS
// After this, the glow class comes off and the last ~1s fade is the
// `box-shadow` transition on `.score-card`, not a JS phase.
export const REVEAL_HIGHLIGHT_HOLD_MS = CONFETTI_DELAY_MS + CONFETTI_DURATION_MS

// Stable sort, descending by total score - ties keep their relative order.
export function sortByTotalScore(players: Player[], getTotal: (player: Player) => number) {
  return [...players].sort((a, b) => getTotal(b) - getTotal(a))
}
