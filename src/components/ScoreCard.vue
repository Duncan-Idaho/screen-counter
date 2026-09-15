<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useGameStore, type Player } from '@/stores/game'

// The control window's card, in both of its phases: `tally` while the round is
// being scored (+/- controls, private points), `reveal` once it is closed (no
// controls, the whole card reveals the team on the projection). The projection
// window has its own animated card - see ScoreboardCard.vue; this one never moves.
defineProps<{ player: Player; mode: 'tally' | 'reveal' }>()

const game = useGameStore()
const { t } = useI18n({ useScope: 'global' })
</script>

<template>
  <article
    class="score-card"
    :class="{
      'score-card--readonly': mode === 'reveal',
      'score-card--revealed': mode === 'reveal' && game.isRevealed(player),
    }"
  >
    <h3>{{ player.name }}</h3>

    <!-- Tally: the round in progress, plus the operator-only running total
         (settled score + the points being tallied right now). -->
    <button
      v-if="mode === 'tally'"
      type="button"
      class="score-content"
      :aria-label="t('round.increment', { name: player.name })"
      @click="game.incrementScore(player.id)"
    >
      <span class="round-score">{{ game.getCurrentRoundScore(player) }}</span>
      <span class="total-score">{{ t('round.total', { n: game.getTotalScore(player) }) }}</span>
    </button>
    <!-- Reveal: the exact pair of numbers the audience is about to see, so the
         operator reads the same card they are projecting. -->
    <button
      v-else
      type="button"
      class="score-content"
      :aria-label="t('reveal.reveal', { name: player.name })"
      @click="game.revealPlayer(player.id)"
    >
      <span class="round-score">{{ game.getRevealScore(player) }}</span>
      <span class="total-score">{{ t('round.total', { n: game.getSettledScore(player) }) }}</span>
    </button>

    <div v-if="mode === 'tally'" class="score-controls">
      <button
        type="button"
        class="plus"
        :class="{ 'is-positive': game.getCurrentRoundScore(player) > 0 }"
        @click="game.incrementScore(player.id)"
      >
        +
      </button>
      <button type="button" class="minus" @click="game.decrementScore(player.id)">−</button>
    </div>
  </article>
</template>
