<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameStore, type Player } from '@/stores/game'
import { CONFETTI_DURATION_MS, type FinalPhase } from '@/lib/projectionOrder'
import ScoreRoll from './ScoreRoll.vue'

// One card of the end-of-game view, in all its lives: the control window's list
// (`selectable`, every team, full card, click to reveal then to toggle the
// detail), the projection's tile (compact: name and one number, `phase` walking
// idle -> gain -> gained -> penalty -> settled), and the projection's detail
// (the per-round breakdown and the penalty chip), shown once settled.
//
// Everything it needs arrives as plain numbers: whether penalties are enabled at
// all is TotalGrid's business, and `penalty === 0` already means "no chip".
const props = defineProps<{
  player: Player
  start: number
  gain: number
  roundScores: number[]
  roundThemes: string[]
  penalty: number
  breakdown: { major: number; minor: number }
  phase: FinalPhase
  detail: boolean
  selectable?: boolean
}>()

const game = useGameStore()
const { t } = useI18n({ useScope: 'global' })

// Not summed from `roundScores`: that depends on `settledRounds`, which changes
// in the intermediate frames of `endGame`. start + gain does not.
const gross = computed(() => props.start + props.gain)
const net = computed(() => gross.value - props.penalty)

const rollFrom = computed(() =>
  props.phase === 'idle' || props.phase === 'gain' ? props.start : gross.value,
)
const rollTo = computed(() => {
  if (props.phase === 'idle') return props.start

  return props.phase === 'gain' || props.phase === 'gained' ? gross.value : net.value
})
// Stable during the ceremony so that `to` changes on the same element and the CSS
// transition plays. Once settled it depends on both ends: toggling the penalties
// setting then snaps instead of scrolling.
const rollKey = computed(() =>
  props.phase === 'settled' ? `${gross.value}-${net.value}` : String(rollFrom.value),
)

// The control window's click: reveal first, then toggle the detail.
function onSelect() {
  if (game.isRevealed(props.player)) {
    game.toggleDetail(props.player.id)
  } else {
    game.revealPlayer(props.player.id)
  }
}

const buttonLabel = computed(() => {
  if (!game.isRevealed(props.player)) {
    return t('reveal.reveal', { name: props.player.name })
  }

  return t(game.isDetailOpen(props.player) ? 'total.hideDetail' : 'total.showDetail', {
    name: props.player.name,
  })
})

// Keyed off the *transition* into 'settled', never off the value: a card that
// mounts settled has no transition to see, so a reload repaints the finished
// board in silence. Same rule as ScoreboardCard's reveal effects - they run
// on a transition, not because a card is merely there.
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
      'total-card--compact': !detail,
      'score-card--glow': game.isRevealed(player),
      // Held across the animated beats: .score-card fades its box-shadow over 1s.
      'score-card--positive': phase === 'gain' || phase === 'gained' || phase === 'penalty',
      'score-card--detail': selectable && game.isDetailOpen(player),
    }"
  >
    <h3>{{ player.name }}</h3>

    <template v-if="detail">
      <p class="grand-total">
        <span class="total-label">{{ t('total.totalLabel') }}</span>
        <!-- Re-keyed on the two ends, so toggling the penalties setting while the
             board is up re-mounts it and snaps rather than scrolling. -->
        <ScoreRoll :key="`${gross}-${net}`" :from="gross" :to="net" rolled high-on-top />
      </p>

      <ol
        class="round-list"
        :style="{ '--round-major': breakdown.major, '--round-minor': breakdown.minor }"
      >
        <li
          v-for="(score, index) in roundScores"
          :key="`${player.id}-${index}`"
          class="round-item"
          :class="{ 'round-item--themed': !!roundThemes[index] }"
        >
          <span v-if="roundThemes[index]" class="round-item-theme">{{ roundThemes[index] }}</span>
          <span class="round-item-score digits">{{ score }}</span>
        </li>
        <li
          v-if="penalty > 0"
          :key="`${player.id}-penalty`"
          class="round-item round-item--penalty"
          :title="t('total.penaltyLabel')"
        >
          <span class="round-item-score digits">{{ t('round.penalty', { n: penalty }) }}</span>
        </li>
      </ol>
    </template>

    <div v-else class="score-content">
      <span class="scoreboard-total digits">
        <ScoreRoll :key="rollKey" :from="rollFrom" :to="rollTo" rolled high-on-top />
      </span>
    </div>

    <!-- One condition for both phases: the element is not re-created between
         them, so the CSS animation does not restart. -->
    <span v-if="phase === 'gain' || phase === 'gained'" class="gain-chip digits">{{
      t('reveal.gain', { n: gain })
    }}</span>
    <span v-if="phase === 'penalty'" class="gain-chip gain-chip--penalty digits">{{
      t('round.penalty', { n: penalty })
    }}</span>

    <!-- Absolutely positioned rather than wrapping the content, so an in-flow
         button does not take a grid track of its own. The button stays active on
         a revealed card: it then toggles the detail. -->
    <button
      v-if="selectable"
      type="button"
      class="card-reveal"
      :aria-label="buttonLabel"
      :aria-pressed="game.isRevealed(player) ? game.isDetailOpen(player) : undefined"
      @click="onSelect"
    />

    <span v-if="selectable && game.isDetailOpen(player)" class="detail-badge">{{
      t('total.detailOpen')
    }}</span>

    <div v-if="bursting" class="confetti-burst" aria-hidden="true">
      <span v-for="n in 10" :key="n" class="confetti-piece" :style="{ '--i': n }" />
    </div>
  </article>
</template>
