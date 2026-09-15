<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore, type Player } from '@/stores/game'
import { sortByTotalScore } from '@/lib/projectionOrder'

// Shared by MainScreen's total screen and ProjectionScreen's total view. Only
// ever shows settled rounds: the round in progress lives in the last `scores`
// entry and must not reach the audience (see stores/game.ts).
const props = defineProps<{ sorted?: boolean }>()

const game = useGameStore()

// Projection only. MainScreen keeps the roster order it has always had, so the
// operator's cards never move under their finger.
const displayPlayers = computed(() =>
  props.sorted ? sortByTotalScore(game.players, game.getSettledScore) : game.players,
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
      <p class="grand-total">{{ game.getSettledScore(player) }}</p>
      <ol
        class="round-list"
        :style="{ '--round-major': game.roundMajor, '--round-minor': game.roundMinor }"
      >
        <li
          v-for="(score, index) in settledScores(player)"
          :key="`${player.id}-${index}`"
          class="round-item"
        >
          <span>{{ score }}</span>
        </li>
      </ol>
    </article>
  </TransitionGroup>
</template>
