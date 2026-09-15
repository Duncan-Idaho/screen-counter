<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameStore, type Player } from '@/stores/game'
import { useSettingsStore } from '@/stores/settings'
import { splitGrid } from '@/lib/grid'
import { sortByTotalScore } from '@/lib/projectionOrder'

// Shared by MainScreen's total screen and ProjectionScreen's total view. Only
// ever shows settled rounds: the round in progress lives in the last `scores`
// entry and must not reach the audience (see stores/game.ts).
const props = defineProps<{ sorted?: boolean }>()

const game = useGameStore()
const settings = useSettingsStore()
const { t } = useI18n({ useScope: 'global' })

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

// Projection only. MainScreen keeps the roster order it has always had, so the
// operator's cards never move under their finger. Ranked by the same number the
// card displays: ranking by the gross settled score would leave a penalised
// team visibly out of order on the final podium.
const displayPlayers = computed(() =>
  props.sorted ? sortByTotalScore(game.players, finalScore) : game.players,
)

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
    <article v-for="player in displayPlayers" :key="player.id" class="score-card total-card">
      <h3>{{ player.name }}</h3>
      <p class="grand-total">{{ finalScore(player) }}</p>
      <ol
        class="round-list"
        :style="{ '--round-major': breakdown.major, '--round-minor': breakdown.minor }"
      >
        <li
          v-for="(score, index) in settledScores(player)"
          :key="`${player.id}-${index}`"
          class="round-item"
        >
          <span>{{ score }}</span>
        </li>
        <li
          v-if="penaltyOf(player) > 0"
          :key="`${player.id}-penalty`"
          class="round-item round-item--penalty"
          :title="t('total.penaltyLabel')"
        >
          <span>{{ t('round.penalty', { n: penaltyOf(player) }) }}</span>
        </li>
      </ol>
    </article>
  </TransitionGroup>
</template>
