<script setup lang="ts">
import { useGameStore } from '@/stores/game'
import ScoreCard from './ScoreCard.vue'

// The control window's grid, for both the round screen (mode: 'tally') and the
// reveal screen (mode: 'reveal'). Always in roster order: the operator's cards
// must stay where they were last time they looked. Sorting and animation belong
// to the projection window alone - see ScoreboardGrid.vue and TotalGrid.vue.
defineProps<{ mode: 'tally' | 'reveal' }>()

const game = useGameStore()
</script>

<template>
  <div
    class="score-grid"
    :style="{ '--grid-major': game.gridMajor, '--grid-minor': game.gridMinor }"
  >
    <ScoreCard v-for="player in game.players" :key="player.id" :player="player" :mode="mode" />
  </div>
</template>
