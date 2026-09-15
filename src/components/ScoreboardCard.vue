<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameStore, type Player } from '@/stores/game'
import { REVEAL_HIGHLIGHT_HOLD_MS } from '@/lib/projectionOrder'

// The projection window's card. It animates on mount rather than on a score
// change: a card is only ever revealed once, already carrying its result. The
// sequence is glow -> placement (CSS, as the siblings slide aside) -> confetti
// (CSS, delayed until the placement settles) -> both fade out.
//
// `animate` is false for every card that is merely sitting on the scoreboard
// during a round: those mount too (on a reload, or on the way back from the
// total screen), and must do so in silence.
const props = defineProps<{ player: Player; animate: boolean }>()

const game = useGameStore()
const { t } = useI18n({ useScope: 'global' })

const gain = computed(() => game.getRevealScore(props.player))
const highlight = ref<'positive' | 'negative' | null>(null)

let fadeTimer: ReturnType<typeof setTimeout> | undefined

onMounted(() => {
  if (!props.animate || gain.value === 0) {
    return
  }

  highlight.value = gain.value > 0 ? 'positive' : 'negative'
  // The class comes off here; the last ~1s fade is the `box-shadow` transition
  // on .score-card (main.css), not a JS phase.
  fadeTimer = setTimeout(() => {
    highlight.value = null
  }, REVEAL_HIGHLIGHT_HOLD_MS)
})

onUnmounted(() => clearTimeout(fadeTimer))
</script>

<template>
  <article
    class="score-card score-card--readonly"
    :class="{
      'score-card--positive': highlight === 'positive',
      'score-card--negative': highlight === 'negative',
    }"
  >
    <h3>{{ player.name }}</h3>

    <div class="score-content">
      <span class="round-score">{{ gain }}</span>
      <span class="total-score">{{ t('round.total', { n: game.getSettledScore(player) }) }}</span>
    </div>

    <div v-if="highlight === 'positive'" class="confetti-burst" aria-hidden="true">
      <span v-for="n in 10" :key="n" class="confetti-piece" :style="{ '--i': n }" />
    </div>
  </article>
</template>
