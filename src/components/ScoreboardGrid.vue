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

// The DOM stays in roster order and the ranking is a CSS `order`. Re-ordering the
// nodes themselves (what a keyed v-for does) detaches and re-attaches them, and a
// re-attached element loses its running CSS transition: a tile that overtakes
// another would jump to its new total instead of rolling. TransitionGroup still
// FLIP-animates the slide, since it compares positions, not node identity.
const rankById = computed(
  () =>
    new Map(
      sortByTotalScore(game.players, game.getScoreboardScore).map((player, rank) => [
        player.id,
        rank,
      ]),
    ),
)
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
    <ScoreboardCard
      v-for="player in game.players"
      :key="player.id"
      :player="player"
      :style="{ order: rankById.get(player.id) }"
    />
  </TransitionGroup>
</template>
