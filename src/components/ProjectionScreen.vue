<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useGameStore } from '@/stores/game'
import ScoreboardGrid from './ScoreboardGrid.vue'
import TotalGrid from './TotalGrid.vue'

// Read-only mirror for a second monitor: no header, no controls, and never any
// score that has not been settled. Which view to show is driven entirely by
// `game.projectionScreen`, a field the main window's store keeps in sync (see
// stores/game.ts) - this window never mutates game state itself.
//
// The order of the branches matters: 'round' and 'reveal' share one
// ScoreboardGrid instance, so moving from the reveal to the next round keeps
// the very same cards mounted instead of remounting them - which would replay
// every glow and confetti burst at once.
const game = useGameStore()
const { t } = useI18n({ useScope: 'global' })
</script>

<template>
  <section v-if="!game.hasPlayers" class="panel projection-waiting">
    <p>{{ t('projection.waiting') }}</p>
  </section>

  <!-- The total view is the end-of-game reveal: it opens empty and gains one
       card per operator click, so `revealing` is as true here as it is on the
       scoreboard below. -->
  <section v-else-if="game.projectionScreen === 'total'" class="panel total-panel no-header">
    <TotalGrid sorted revealing />
  </section>

  <section v-else class="panel round-panel no-header">
    <ScoreboardGrid :revealing="game.projectionScreen === 'reveal'" />
  </section>
</template>
