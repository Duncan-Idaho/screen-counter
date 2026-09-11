<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useGameStore, type Player } from '@/stores/game'
import { sortByTotalScore, SORT_DELAY_MS } from '@/lib/projectionOrder'
import ScoreCard from './ScoreCard.vue'

// Shared by MainScreen's round screen (interactive: score taps/± buttons
// change songDeltas) and ProjectionScreen's round view (interactive: false -
// same visual content, no click targets, plus the sort/highlight below).
const props = defineProps<{ interactive: boolean }>()

const game = useGameStore()

// MainScreen (interactive) keeps the operator's click order stable and never
// reorders - only the projection window sorts by score.
const sortedIds = ref<number[]>([])

if (!props.interactive) {
  sortedIds.value = sortByTotalScore(game.players, game.getTotalScore).map((player) => player.id)

  let sortTimer: ReturnType<typeof setTimeout> | undefined

  // Keyed on both songNumber and currentRound: nextRound() resets currentSong
  // to 0, which alone wouldn't change songNumber if the outgoing round had
  // only one song - watching both closes that gap while staying the same
  // "wait 2s after it changes, then resort" mechanism.
  watch(
    () => [game.songNumber, game.currentRound],
    () => {
      clearTimeout(sortTimer)
      sortTimer = setTimeout(() => {
        sortedIds.value = sortByTotalScore(game.players, game.getTotalScore).map(
          (player) => player.id,
        )
      }, SORT_DELAY_MS)
    },
  )

  // Roster changes (add/remove) reconcile immediately, no animation - in
  // practice unreachable during round view since players only change in setup.
  watch(
    () => game.players.map((player) => player.id),
    (ids) => {
      const idSet = new Set(ids)
      const kept = sortedIds.value.filter((id) => idSet.has(id))
      sortedIds.value = [...kept, ...ids.filter((id) => !kept.includes(id))]
    },
  )

  onUnmounted(() => clearTimeout(sortTimer))
}

const displayPlayers = computed(() => {
  if (props.interactive) {
    return game.players
  }

  return sortedIds.value
    .map((id) => game.players.find((player) => player.id === id))
    .filter((player): player is Player => player !== undefined)
})
</script>

<template>
  <TransitionGroup
    tag="div"
    class="score-grid"
    name="score-order"
    :style="{ '--grid-major': game.gridMajor, '--grid-minor': game.gridMinor }"
  >
    <ScoreCard
      v-for="player in displayPlayers"
      :key="player.id"
      :player="player"
      :interactive="interactive"
    />
  </TransitionGroup>
</template>
