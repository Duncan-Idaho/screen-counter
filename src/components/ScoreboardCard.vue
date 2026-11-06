<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameStore, type Player } from '@/stores/game'
import { useRevealEffects } from '@/composables/useRevealEffects'
import ScoreRoll from './ScoreRoll.vue'

// The projection window's tile: one big number, the scoreboard score. It reads
// only penalty-free getters (getScoreBeforeRound / getScoreboardScore /
// getRevealScore / isRevealedOnScoreboard).
//
// Nothing animates on mount. A tile that is revealed when it appears (reload,
// projection opened late) just sits there with its permanent glow; the "+N" chip,
// the roll and the confetti hang off the not-revealed -> revealed transition
// (useRevealEffects), and the roll is a CSS transition on ScoreRoll's track.
const props = defineProps<{ player: Player }>()

const game = useGameStore()
const { t } = useI18n({ useScope: 'global' })

const revealed = computed(() => game.isRevealedOnScoreboard(props.player))
const from = computed(() => game.getScoreBeforeRound(props.player))
const to = computed(() => game.getScoreboardScore(props.player))

const { chip, celebrating } = useRevealEffects(
  () => revealed.value,
  () => game.getRevealScore(props.player),
)
</script>

<template>
  <article
    class="score-card score-card--readonly"
    :class="{
      'score-card--glow': revealed,
      'score-card--positive': celebrating,
    }"
  >
    <h3>{{ player.name }}</h3>

    <div class="score-content">
      <!-- Keyed on `from`: moving to the next round changes it, so the roll is
           remounted and shows the new total without scrolling. During a click
           `from` is constant, so the same track scrolls. -->
      <span class="scoreboard-total digits">
        <ScoreRoll :key="from" :from="from" :to="to" rolled />
      </span>
    </div>

    <span v-if="chip !== null" class="gain-chip digits">{{ t('reveal.gain', { n: chip }) }}</span>

    <div v-if="celebrating" class="confetti-burst" aria-hidden="true">
      <span v-for="n in 10" :key="n" class="confetti-piece" :style="{ '--i': n }" />
    </div>
  </article>
</template>
