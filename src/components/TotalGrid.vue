<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useGameStore, type Player } from '@/stores/game'
import { useSettingsStore } from '@/stores/settings'
import { splitGrid } from '@/lib/grid'
import {
  FINAL_GROSS_HOLD_MS,
  FINAL_SETTLE_MS,
  sortByFinalScore,
  type FinalPhase,
} from '@/lib/projectionOrder'
import TotalCard from './TotalCard.vue'

// Shared by MainScreen's total screen and ProjectionScreen's total view. Only
// ever shows settled rounds: the round in progress lives in the last `scores`
// entry and must not reach the audience (see stores/game.ts).
//
// The total screen is also the end-of-game reveal, so this grid has two
// populations the way ScoreboardGrid does - and three independent switches,
// named for what they do rather than for the window that happens to set them:
//
//   <TotalGrid selectable />        control window: every team, roster order,
//                                   each card a reveal button
//   <TotalGrid sorted revealing />  projection: the revealed teams only, ranked,
//                                   each new card running the ceremony
const props = defineProps<{ sorted?: boolean; revealing?: boolean; selectable?: boolean }>()

const game = useGameStore()
const settings = useSettingsStore()

// The total screen IS the end of the game, so this is the one view where
// penalties apply. Every other view (round, reveal, scoreboard) reads
// getSettledScore and stays gross - see stores/game.ts.
const showPenalties = computed(() => settings.penaltiesEnabled)

function penaltyOf(player: Player) {
  return showPenalties.value ? game.getPenalty(player) : 0
}

function finalScore(player: Player) {
  return showPenalties.value ? game.getFinalScore(player) : game.getSettledScore(player)
}

// One cell per settled round, plus the penalty chip when one is shown. The
// split has to count that extra cell: .round-list clips its overflow, so a
// grid sized for the rounds alone would drop the chip silently rather than
// spill it. Computed per grid rather than per player - keying it off one
// player's penalty would give penalised and clean teams different chip sizes
// side by side; teams without a penalty just render one cell fewer.
const breakdown = computed(() =>
  splitGrid(game.settledRounds + (game.players.some((player) => penaltyOf(player) > 0) ? 1 : 0)),
)

// --- The ceremony clock ----------------------------------------------------
//
// It lives here rather than in the card, which is a deliberate exception to the
// rule that animation belongs to the card and fires on mount (ScoreboardCard).
// The reorder is a *grid* concern: a freshly revealed team is ranked by its
// gross score until the penalty lands and by its net score afterwards, and that
// late switch of the sort key is precisely what makes the card slide down past
// the teams it no longer beats.
//
// Seeded synchronously here, not in onMounted: ids already revealed when this
// grid mounts (a reload, or a projection window opened mid-ceremony) have to be
// settled on the very first render, or they flash their gross total for a frame
// and then correct themselves.
const phases = ref<Record<number, FinalPhase>>(
  Object.fromEntries(game.revealedIds.map((id) => [id, 'settled' as FinalPhase])),
)
const timers = new Map<number, ReturnType<typeof setTimeout>[]>()

function clearTimers(playerId: number) {
  timers.get(playerId)?.forEach(clearTimeout)
  timers.delete(playerId)
}

// 'enter' as the fallback, never 'settled': an id that has just arrived is then
// already in its opening phase on the first render that contains it, whenever
// the watcher below happens to run. The watcher only ever starts timers, so it
// cannot be a frame late with the net score.
function phaseOf(player: Player): FinalPhase {
  return props.revealing ? (phases.value[player.id] ?? 'enter') : 'settled'
}

watch(
  () => game.revealedIds,
  (ids) => {
    if (!props.revealing) {
      return
    }

    for (const id of ids) {
      if (id in phases.value) {
        continue
      }

      phases.value[id] = 'enter'

      // No penalty to apply means nothing to pulse and nothing to count down,
      // so the middle beat is skipped entirely rather than held empty. The chip
      // appears at this same instant on the teams that do have one, so the
      // shorter timeline discloses nothing early.
      const player = game.players.find((candidate) => candidate.id === id)
      const penalty = player ? penaltyOf(player) : 0

      timers.set(
        id,
        penalty > 0
          ? [
              setTimeout(() => (phases.value[id] = 'penalty'), FINAL_GROSS_HOLD_MS),
              setTimeout(() => (phases.value[id] = 'settled'), FINAL_SETTLE_MS),
            ]
          : [setTimeout(() => (phases.value[id] = 'settled'), FINAL_GROSS_HOLD_MS)],
      )
    }

    // Anything that left the list (endGame emptying it, or a removed player)
    // must give up its phase and its pending timers, or the next ceremony finds
    // the team already settled and skips it.
    for (const id of Object.keys(phases.value).map(Number)) {
      if (!ids.includes(id)) {
        clearTimers(id)
        delete phases.value[id]
      }
    }
  },
)

onUnmounted(() => {
  for (const handles of timers.values()) {
    handles.forEach(clearTimeout)
  }
})

// Ranked by the same number the card displays - except while a card is still
// mid-ceremony, when it is ranked by the gross score it is still showing. See
// the clock above.
function rankOf(player: Player) {
  return phaseOf(player) === 'settled' ? finalScore(player) : game.getSettledScore(player)
}

// Tiebreak for teams level on the net total, and read at the same phase as the
// rank above: a card whose penalty has not landed yet is still showing a gross
// score with no deduction, so it ties as though it had none. Using the real
// penalty here would drop it below a level rival before the chip has appeared
// to explain why.
function tiebreakOf(player: Player) {
  return phaseOf(player) === 'settled' ? penaltyOf(player) : 0
}

// MainScreen keeps the roster order it has always had, so the operator's cards
// never move under their finger.
const displayPlayers = computed(() => {
  const shown = props.revealing
    ? game.players.filter((player: Player) => game.isRevealed(player))
    : game.players

  return props.sorted ? sortByFinalScore(shown, rankOf, tiebreakOf) : shown
})

function settledScores(player: Player) {
  return player.scores.slice(0, game.settledRounds)
}
</script>

<template>
  <TransitionGroup
    tag="div"
    class="score-grid"
    name="score-order"
    :style="{ '--grid-major': game.gridMajor, '--grid-minor': game.gridMinor }"
  >
    <TotalCard
      v-for="player in displayPlayers"
      :key="player.id"
      :player="player"
      :round-scores="settledScores(player)"
      :penalty="penaltyOf(player)"
      :breakdown="breakdown"
      :phase="phaseOf(player)"
      :selectable="selectable"
    />
  </TransitionGroup>
</template>
