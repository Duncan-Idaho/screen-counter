<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useGameStore, type Player } from '@/stores/game'
import { useSettingsStore } from '@/stores/settings'
import { splitGrid } from '@/lib/grid'
import { finalTimeline, sortByFinalScore, type FinalPhase } from '@/lib/projectionOrder'
import TotalCard from './TotalCard.vue'

// Shared by MainScreen's total screen and ProjectionScreen's total view. Only
// ever shows settled rounds: the round in progress lives in the last `scores`
// entry and must not reach the audience (see stores/game.ts).
//
// The total screen is also the end-of-game view - the last round's reveal plus
// the penalties - and has three independent switches, named for what they do
// rather than for the window that happens to set them:
//
//   <TotalGrid selectable />        control window: every team, roster order, the
//                                   full card always; a click reveals the team,
//                                   the next ones toggle its detail
//   <TotalGrid sorted revealing />  projection: every team from the start, ranked,
//                                   one number per tile; each click runs that
//                                   team's clock, then it can show its detail
//
// `revealing` no longer filters the population: it means "run the clock, and
// show the compact tile until the team is settled".
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

// Gross = the sum of rounds 0..currentRound whatever `settledRounds` currently
// holds (see getFinalStartScore), net of the penalty when the setting is on.
function grossScore(player: Player) {
  return game.getFinalStartScore(player) + game.getFinalGain(player)
}

function finalScore(player: Player) {
  return grossScore(player) - penaltyOf(player)
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
// The reorder is a *grid* concern: a team is ranked by its starting score until
// its clock reaches 'settled' and by its net score afterwards, and that late
// switch of the sort key is what makes the card slide to its net rank, all at
// once, after the chips are gone.
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

// 'idle' as the fallback, never 'settled': an id that has just arrived is then
// not yet net on the first render that contains it, whenever the watcher below
// happens to run.
function phaseOf(player: Player): FinalPhase {
  return props.revealing ? (phases.value[player.id] ?? 'idle') : 'settled'
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

      const player = game.players.find((candidate) => candidate.id === id)
      const [first, ...rest] = finalTimeline(
        player ? game.getFinalGain(player) : 0,
        player ? penaltyOf(player) : 0,
      )

      phases.value[id] = first!.phase
      timers.set(
        id,
        rest.map((step) => setTimeout(() => (phases.value[id] = step.phase), step.at)),
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

// Ranked by the number the card ends on once settled, and by its starting score
// before: no tile moves during +N or - P. See the clock above.
function rankOf(player: Player) {
  return phaseOf(player) === 'settled' ? finalScore(player) : game.getFinalStartScore(player)
}

// Tiebreak for teams level on the net total, and read at the same phase as the
// rank above: a card that is not settled yet ties as though it had no penalty. Using the real
// penalty here would drop it below a level rival before the chip has appeared
// to explain why.
function tiebreakOf(player: Player) {
  return phaseOf(player) === 'settled' ? penaltyOf(player) : 0
}

// MainScreen keeps the roster order it has always had, so the operator's cards
// never move under their finger.
const displayPlayers = computed(() =>
  props.sorted ? sortByFinalScore(game.players, rankOf, tiebreakOf) : game.players,
)

// The projection shows a team's detail only once it is settled, so a toggle
// during the ceremony (the control has no clock) cannot cut the roll short.
function detailOf(player: Player) {
  return !props.revealing || (phaseOf(player) === 'settled' && game.isDetailOpen(player))
}

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
      :start="game.getFinalStartScore(player)"
      :gain="game.getFinalGain(player)"
      :detail="detailOf(player)"
      :round-scores="settledScores(player)"
      :round-themes="game.settledRoundThemes"
      :penalty="penaltyOf(player)"
      :breakdown="breakdown"
      :phase="phaseOf(player)"
      :selectable="selectable"
    />
  </TransitionGroup>
</template>
