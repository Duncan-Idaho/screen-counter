<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameStore, type Player } from '@/stores/game'
import { CONFETTI_DURATION_MS, type FinalPhase } from '@/lib/projectionOrder'
import ScoreRoll from './ScoreRoll.vue'

// One card of the end-of-game board, in all three of its lives: the control
// window's list (`selectable`, every team, click to reveal), the projection's
// ceremony (`phase` walking enter -> penalty -> settled), and a card that simply
// mounts already finished (a reload, or a projection window opened late), which
// is the same thing as a card whose `phase` never leaves 'settled'.
//
// Everything it needs to render arrives as plain numbers: whether penalties are
// enabled at all is TotalGrid's business, and `penalty === 0` already means
// "no chip" here exactly as it did when this markup lived there.
const props = defineProps<{
  player: Player
  roundScores: number[]
  penalty: number
  breakdown: { major: number; minor: number }
  phase: FinalPhase
  selectable?: boolean
}>()

const game = useGameStore()
const { t } = useI18n({ useScope: 'global' })

const gross = computed(() => props.roundScores.reduce((sum, score) => sum + score, 0))
const net = computed(() => gross.value - props.penalty)

// Keyed off the *transition* into 'settled', never off the value: a card that
// mounts settled has no transition to see, so a reload repaints the finished
// board in silence. Same rule as ScoreboardCard's `animate` flag - a card
// animates when it arrives, not when it is merely there.
const bursting = ref(false)
let burstTimer: ReturnType<typeof setTimeout> | undefined

watch(
  () => props.phase,
  (phase) => {
    if (phase !== 'settled') {
      return
    }

    bursting.value = true
    burstTimer = setTimeout(() => {
      bursting.value = false
    }, CONFETTI_DURATION_MS)
  },
)

onUnmounted(() => clearTimeout(burstTimer))
</script>

<template>
  <article
    class="score-card total-card"
    :class="{
      // Held across both animated beats rather than just the first: .score-card
      // fades its box-shadow over 1s, so a glow dropped at the one-second mark
      // would reach full strength at the very moment it is taken away.
      'score-card--positive': phase !== 'settled',
      'score-card--revealed': selectable && game.isRevealed(player),
    }"
  >
    <h3>{{ player.name }}</h3>

    <p class="grand-total">
      <!-- Mounted in every mode, including the ones that never roll. Swapping it
           for a plain number once settled would race the roll's own transition,
           which ends on that same tick; and re-keying it on the two ends means
           toggling the penalties setting while the board is up re-mounts it and
           snaps, rather than scrolling a total nobody asked it to scroll. -->
      <ScoreRoll
        :key="`${gross}-${net}`"
        :from="gross"
        :to="net"
        :rolled="phase !== 'enter'"
      />
    </p>

    <ol
      class="round-list"
      :style="{ '--round-major': breakdown.major, '--round-minor': breakdown.minor }"
    >
      <li
        v-for="(score, index) in roundScores"
        :key="`${player.id}-${index}`"
        class="round-item"
      >
        <span>{{ score }}</span>
      </li>
      <!-- Laid out from the first frame and merely hidden, never v-if'd:
           .round-list is a centred wrap, so a chip appearing at the one-second
           mark would shove the round chips sideways to re-centre them. The cell
           is already counted in `breakdown`. -->
      <li
        v-if="penalty > 0"
        :key="`${player.id}-penalty`"
        class="round-item round-item--penalty"
        :class="{
          'round-item--pending': phase === 'enter',
          'round-item--pulsing': phase === 'penalty',
        }"
        :title="t('total.penaltyLabel')"
      >
        <span>{{ t('round.penalty', { n: penalty }) }}</span>
      </li>
    </ol>

    <!-- Absolutely positioned rather than wrapping the content: .total-card is a
         two-column grid with three placed children, so an in-flow button would
         take a track of its own and break the layout. Already-revealed cards
         keep their button and rely on the store's guard, exactly as the round
         reveal's cards do - the dimming is the feedback. -->
    <button
      v-if="selectable"
      type="button"
      class="card-reveal"
      :aria-label="t('reveal.reveal', { name: player.name })"
      @click="game.revealPlayer(player.id)"
    />

    <div v-if="bursting" class="confetti-burst" aria-hidden="true">
      <span v-for="n in 10" :key="n" class="confetti-piece" :style="{ '--i': n }" />
    </div>
  </article>
</template>
