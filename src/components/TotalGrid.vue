<script setup lang="ts">
import { useGameStore } from '@/stores/game'

// Shared by MainScreen's total screen and ProjectionScreen's total view - this
// grid has never had any interactive elements, so unlike ScoreGrid there's no
// `interactive` prop to toggle.
const game = useGameStore()
</script>

<template>
  <div
    class="score-grid"
    :style="{ '--grid-major': game.gridMajor, '--grid-minor': game.gridMinor }"
  >
    <article v-for="player in game.players" :key="player.id" class="score-card total-card">
      <h3>{{ player.name }}</h3>
      <p class="grand-total">{{ game.getTotalScore(player) }}</p>
      <ol
        class="round-list"
        :style="{ '--round-major': game.roundMajor, '--round-minor': game.roundMinor }"
      >
        <li
          v-for="(score, index) in player.scores"
          :key="`${player.id}-${index}`"
          class="round-item"
        >
          <span>{{ score }}</span>
        </li>
      </ol>
    </article>
  </div>
</template>
