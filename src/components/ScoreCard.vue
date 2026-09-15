<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameStore, type Player } from '@/stores/game'
import { useSettingsStore } from '@/stores/settings'

// The control window's card, in both of its phases: `tally` while the round is
// being scored (+/- controls, private points), `reveal` once it is closed (no
// controls, the whole card reveals the team on the projection). The projection
// window has its own animated card - see ScoreboardCard.vue; this one never moves.
const props = defineProps<{ player: Player; mode: 'tally' | 'reveal' }>()

const game = useGameStore()
const settings = useSettingsStore()
const { t } = useI18n({ useScope: 'global' })

// Penalties are collected during the game but only applied at the end, so they
// belong to the tally phase alone: the reveal card deliberately keeps showing
// the exact pair of numbers the audience is about to see, and nothing else.
const penaltiesOn = computed(() => props.mode === 'tally' && settings.penaltiesEnabled)
const penalty = computed(() => game.getPenalty(props.player))
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
         (settled score + the points being tallied right now). The total stays
         gross - the penalty is an annotation beside it, not a deduction from
         it, because penalties only land at the end of the game. -->
    <button
      v-if="mode === 'tally'"
      type="button"
      class="score-content"
      :aria-label="t('round.increment', { name: player.name })"
      @click="game.incrementScore(player.id)"
    >
      <span class="round-score">{{ game.getCurrentRoundScore(player) }}</span>
      <!-- Sized off the setting, not off this team's penalty: keying it to
           `penalty > 0` made penalised cards carry a visibly smaller total than
           clean ones, leaving the grid ragged. Same reason TotalGrid splits its
           breakdown per grid rather than per player. -->
      <span class="total-line" :class="{ 'total-line--penalty': penaltiesOn }">
        <span class="total-score">{{ t('round.total', { n: game.getTotalScore(player) }) }}</span>
        <span v-if="penaltiesOn && penalty > 0" class="penalty-score">
          {{ t('round.penalty', { n: penalty }) }}
        </span>
      </span>
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

    <!-- Two pairs of identical glyphs, so colour and the heavier rule between
         them are the only visual difference - which makes the aria-labels
         load-bearing rather than decoration, since neither reaches a screen
         reader. -->
    <div
      v-if="mode === 'tally'"
      class="score-controls"
      :class="{ 'score-controls--penalty': penaltiesOn }"
    >
      <button
        type="button"
        class="plus"
        :class="{ 'is-positive': game.getCurrentRoundScore(player) > 0 }"
        :aria-label="t('round.increment', { name: player.name })"
        @click="game.incrementScore(player.id)"
      >
        +
      </button>
      <button
        type="button"
        class="minus"
        :aria-label="t('round.decrement', { name: player.name })"
        @click="game.decrementScore(player.id)"
      >
        −
      </button>

      <template v-if="penaltiesOn">
        <button
          type="button"
          class="penalty-plus"
          :aria-label="t('round.penaltyIncrement', { name: player.name })"
          @click="game.incrementPenalty(player.id)"
        >
          +
        </button>
        <button
          type="button"
          class="penalty-minus"
          :aria-label="t('round.penaltyDecrement', { name: player.name })"
          @click="game.decrementPenalty(player.id)"
        >
          −
        </button>
      </template>
    </div>
  </article>
</template>
