<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameStore, type Player } from '@/stores/game'
import { HIGHLIGHT_HOLD_MS } from '@/lib/projectionOrder'

// Extracted from ScoreGrid so each card can locally diff its own total score
// (see projectionOrder.ts) instead of a parent computing deltas for everyone.
const props = defineProps<{ player: Player; interactive: boolean }>()

const game = useGameStore()
const { t } = useI18n({ useScope: 'global' })

const highlight = ref<'positive' | 'negative' | null>(null)

// Only the projection window's read-only cards animate - MainScreen's own
// total also changes when the operator hits next-song/next-round, but the
// highlight/confetti feature is projection-only, and `interactive` is
// exactly that signal already.
if (!props.interactive) {
  const total = computed(() => game.getTotalScore(props.player))
  let fadeTimer: ReturnType<typeof setTimeout> | undefined

  watch(total, (next, prev) => {
    if (next === prev) {
      return
    }

    highlight.value = next > prev ? 'positive' : 'negative'
    clearTimeout(fadeTimer)
    // Glow holds through the 0-2s burst and the 2-4s reorder; the final ~1s
    // fade is a CSS transition on .score-card (main.css), not a JS phase.
    fadeTimer = setTimeout(() => {
      highlight.value = null
    }, HIGHLIGHT_HOLD_MS)
  })

  onUnmounted(() => clearTimeout(fadeTimer))
}
</script>

<template>
  <article
    class="score-card"
    :class="{
      'score-card--readonly': !interactive,
      'score-card--positive': highlight === 'positive',
      'score-card--negative': highlight === 'negative',
    }"
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

    <div v-if="highlight === 'positive'" class="confetti-burst" aria-hidden="true">
      <span v-for="n in 10" :key="n" class="confetti-piece" :style="{ '--i': n }" />
    </div>
  </article>
</template>
