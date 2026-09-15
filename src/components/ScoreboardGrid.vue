<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore, type Player } from '@/stores/game'
import { sortByTotalScore } from '@/lib/projectionOrder'
import ScoreboardCard from './ScoreboardCard.vue'

// The projection window's scoreboard. Not two views but one, with two
// populations: during a round every team is on it, frozen on the last settled
// round's result, and `endRound` empties it so the operator can fill it back up
// one card per click. Because it is the same component instance either way (see
// ProjectionScreen.vue), moving on to the next round changes nothing on screen -
// the set goes from "all revealed" straight back to "all".
const props = defineProps<{ revealing: boolean }>()

const game = useGameStore()

const displayPlayers = computed(() => {
  const shown = props.revealing
    ? game.players.filter((player: Player) => game.isRevealed(player))
    : game.players

  return sortByTotalScore(shown, game.getSettledScore)
})
</script>

<template>
  <!-- --grid-major/--grid-minor come from the *roster* size, not the number of
       cards on screen, so a card keeps exactly the same box from the first
       reveal to the last. .scoreboard-grid centres whatever is there. -->
  <TransitionGroup
    tag="div"
    class="scoreboard-grid"
    name="scoreboard"
    :style="{ '--grid-major': game.gridMajor, '--grid-minor': game.gridMinor }"
  >
    <ScoreboardCard
      v-for="player in displayPlayers"
      :key="player.id"
      :player="player"
      :animate="revealing"
    />
  </TransitionGroup>
</template>
