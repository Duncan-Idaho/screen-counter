// Projection-window-only score ordering and animation timings. Kept pure and
// out of the store/components so it stays testable without a DOM - see
// color.ts/backgroundImage.ts.

import type { Player } from '@/stores/game'

// CSS transform transition duration for the totals reorder slide (must match
// the `.score-order-move` rule in main.css).
export const MOVE_DURATION_MS = 2000

// End-of-game ceremony (TotalGrid.vue + TotalCard.vue). `t` is measured from the
// moment the operator clicks that team's card, not from the end of the game:
//
//   0 .. 1000   'enter'    green glow, gross total, penalty chip laid out but hidden
//   1000 .. 3000 'penalty' chip shown and pulsing, grand total rolls gross -> net
//   3000 .. 5000 'settled' pulse off, cards reorder (MOVE_DURATION_MS), confetti
//
// A team with no penalty to apply (none collected, or the setting is off) skips
// the middle beat and settles at FINAL_GROSS_HOLD_MS: the chip appears at that
// same instant for the teams that do have one, so the shorter timeline gives
// nothing away that the chip has not already announced.
export type FinalPhase = 'enter' | 'penalty' | 'settled'

export const FINAL_GROSS_HOLD_MS = 1000
// Must match the `.score-roll-track` transition in main.css.
export const FINAL_ROLL_MS = 2000
export const FINAL_SETTLE_MS = FINAL_GROSS_HOLD_MS + FINAL_ROLL_MS

// Round reveal (ScoreboardCard.vue). The tiles never leave: on the operator's
// click the "+N" chip, the roll of the total, the strong glow and the slide to
// the new rank all start together; the confetti burst is held back until the
// slide has settled, and the strong glow outlasts it before fading to the
// permanent discreet one. Each value must match its counterpart in main.css.
// REVEAL_ENTER_MS now only serves roster changes and `.score-order-enter-*`.
export const REVEAL_ENTER_MS = 400
export const REVEAL_MOVE_MS = 600
export const CONFETTI_DURATION_MS = 1400
export const CONFETTI_DELAY_MS = REVEAL_MOVE_MS
// After this, the glow class comes off and the last ~1s fade is the
// `box-shadow` transition on `.score-card`, not a JS phase.
export const REVEAL_HIGHLIGHT_HOLD_MS = CONFETTI_DELAY_MS + CONFETTI_DURATION_MS
// The scoreboard's roll, livelier than the 2s end-of-game one. Must match the
// `.scoreboard-total .score-roll-track` transition in main.css.
export const REVEAL_ROLL_MS = 1200
// How long the "+N" chip stays; must match the `gain-chip` animation in main.css.
export const REVEAL_GAIN_CHIP_MS = 2500

// Stable sort, descending by total score - ties keep their relative order.
export function sortByTotalScore(players: Player[], getTotal: (player: Player) => number) {
  return [...players].sort((a, b) => getTotal(b) - getTotal(a))
}

// The end-of-game ranking, where the total is net of penalties and a tie on it
// is broken by the **smaller** penalty: 37-7 and 38-8 both come to 30, and the
// team that lost less to penalties takes the higher place. Kept separate from
// sortByTotalScore rather than folded into it, so the scoreboard's comparator
// stays visibly penalty-free - the deduction must not reach the audience before
// the game is over (see stores/game.ts).
//
// Still stable, so teams level on both count as genuinely level and hold the
// order they came in.
export function sortByFinalScore(
  players: Player[],
  getTotal: (player: Player) => number,
  getPenalty: (player: Player) => number,
) {
  return [...players].sort(
    (a, b) => getTotal(b) - getTotal(a) || getPenalty(a) - getPenalty(b),
  )
}
