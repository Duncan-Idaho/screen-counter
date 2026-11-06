// Projection-window-only score ordering and animation timings. Kept pure and
// out of the store/components so it stays testable without a DOM - see
// color.ts/backgroundImage.ts.

import type { Player } from '@/stores/game'

// CSS transform transition duration for the totals reorder slide (must match
// the `.score-order-move` rule in main.css).
export const MOVE_DURATION_MS = 2000

// End-of-game view (TotalGrid.vue + TotalCard.vue): the last round's reveal, then
// the penalty. `t` is measured from the moment the operator clicks that team's
// tile:
//
//   0 .. 1200      'gain'     "+N" chip, the number rolls start -> gross
//   1200 .. 2500   'gained'   number fixed at gross, chip finishing its animation
//   2500 .. 5000   'penalty'  "- P" chip, the number rolls gross -> net
//   5000           'settled'  no chip; confetti, slide to the net rank
//
// No gain: the timeline starts at 'penalty'. No penalty (none collected, or the
// setting is off): it settles after the gain. Neither: 'settled' at once - the
// confetti still fires, on the idle -> settled transition. 'gained' exists so
// the second leg of the roll starts from a render where from === to === gross.
export type FinalPhase = 'idle' | 'gain' | 'gained' | 'penalty' | 'settled'

// Round reveal (ScoreboardCard.vue). The tiles never leave: on the operator's
// click the "+N" chip, the roll of the total and the strong glow start together
// (0); the tile slides to its new rank once the roll is steady (1.2 s, ScoreboardGrid's
// per-team timer) and lands at 1.8 s, when the confetti burst starts; the strong
// glow outlasts it (3.2 s) before fading to the permanent discreet one. The chip
// (2.5 s) goes out before the glow. Each value must match its counterpart in main.css.
// REVEAL_ENTER_MS now only serves roster changes and `.score-order-enter-*`.
export const REVEAL_ENTER_MS = 400
export const REVEAL_MOVE_MS = 600
export const CONFETTI_DURATION_MS = 1400
// The odometer's roll, for both the round reveal and the end-of-game view. Must
// match the `.score-roll-track` transition in main.css.
export const REVEAL_ROLL_MS = 1200
export const CONFETTI_DELAY_MS = REVEAL_ROLL_MS + REVEAL_MOVE_MS
// After this, the glow class comes off and the last ~1s fade is the
// `box-shadow` transition on `.score-card`, not a JS phase.
export const REVEAL_HIGHLIGHT_HOLD_MS = CONFETTI_DELAY_MS + CONFETTI_DURATION_MS
// How long the "+N" chip stays; must match the `gain-chip` animation in main.css.
export const REVEAL_GAIN_CHIP_MS = 2500
// One beat of the end-of-game view: a chip's whole life, so +N and - P never overlap.
export const FINAL_BEAT_MS = REVEAL_GAIN_CHIP_MS

// The phases of one team's end-of-game view, with their offsets from its click.
// The first step is always at 0.
export function finalTimeline(gain: number, penalty: number) {
  const steps: { at: number; phase: FinalPhase }[] = []
  let at = 0

  if (gain > 0) {
    steps.push({ at, phase: 'gain' }, { at: REVEAL_ROLL_MS, phase: 'gained' })
    at = FINAL_BEAT_MS
  }

  if (penalty > 0) {
    steps.push({ at, phase: 'penalty' })
    at += FINAL_BEAT_MS
  }

  steps.push({ at, phase: 'settled' })

  return steps
}

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
