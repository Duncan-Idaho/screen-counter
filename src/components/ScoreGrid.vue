<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useGameStore } from '@/stores/game'

// Shared by MainScreen's round screen (interactive: score taps/± buttons
// change songDeltas) and ProjectionScreen's round view (interactive: false -
// same visual content, no click targets at all, not even the score itself).
defineProps<{ interactive: boolean }>()

const game = useGameStore()
const { t } = useI18n({ useScope: 'global' })
</script>

<template>
  <div
    class="score-grid"
    :style="{ '--grid-major': game.gridMajor, '--grid-minor': game.gridMinor }"
  >
    <article
      v-for="player in game.players"
      :key="player.id"
      class="score-card"
      :class="{ 'score-card--readonly': !interactive }"
    >
      <h3>{{ player.name }}</h3>

      <button
        v-if="interactive"
        type="button"
        class="score-content"
        :aria-label="t('round.increment', { name: player.name })"
        @click="game.incrementSongDelta(player.id)"
      >
        <span class="round-score">{{ game.getCurrentRoundScore(player) }}</span>
        <span class="total-score">{{ t('round.total', { n: game.getTotalScore(player) }) }}</span>
      </button>
      <div v-else class="score-content">
        <span class="round-score">{{ game.getCurrentRoundScore(player) }}</span>
        <span class="total-score">{{ t('round.total', { n: game.getTotalScore(player) }) }}</span>
      </div>

      <div v-if="interactive" class="score-controls">
        <button
          type="button"
          class="plus"
          :class="{ 'is-positive': game.getSongDelta(player) > 0 }"
          @click="game.incrementSongDelta(player.id)"
        >
          {{ game.getSongDelta(player) > 1 ? game.getSongDelta(player) : '+' }}
        </button>
        <button
          type="button"
          class="minus"
          :class="{ 'is-negative': game.getSongDelta(player) < 0 }"
          @click="game.decrementSongDelta(player.id)"
        >
          {{ game.getSongDelta(player) < -1 ? -game.getSongDelta(player) : '−' }}
        </button>
      </div>
    </article>
  </div>
</template>
