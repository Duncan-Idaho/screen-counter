<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { sortByTotalScore } from '@/lib/projectionOrder'
import ScoreboardCard from './ScoreboardCard.vue'

// The projection window's scoreboard: always every team, ranked by the
// scoreboard score. During a round it is frozen on the last settled result; at
// the reveal the tiles stay, and each operator click moves one tile to its new
// total and rank. One component instance for round and reveal (see
// ProjectionScreen.vue), so nothing remounts between them.
const game = useGameStore()

const displayPlayers = computed(() => sortByTotalScore(game.players, game.getScoreboardScore))
</script>

<template>
  <!-- --grid-major/--grid-minor come from the *roster* size, so a tile keeps the
       same box whatever happens. -->
  <TransitionGroup
    tag="div"
    class="scoreboard-grid"
    name="scoreboard"
    :style="{ '--grid-major': game.gridMajor, '--grid-minor': game.gridMinor }"
  >
    <ScoreboardCard v-for="player in displayPlayers" :key="player.id" :player="player" />
  </TransitionGroup>
</template>
