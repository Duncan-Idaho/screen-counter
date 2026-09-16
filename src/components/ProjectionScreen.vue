<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useGameStore } from '@/stores/game'
import ScoreboardGrid from './ScoreboardGrid.vue'
import TotalGrid from './TotalGrid.vue'

// Read-only mirror for a second monitor: no controls, and never any score
// that has not been settled. The total view has no header at all; round and
// reveal keep a permanent one (round counter + theme) so the grid below never
// resizes as a theme is typed. Which view to show is driven entirely by
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

  <!-- A permanent header (round counter, plus the theme when one is set) so the
       grid below never resizes as the operator types a theme mid-round - the
       header row is always there, at a constant height, whether or not it has
       a theme to show next to the round number. -->
  <section v-else class="panel round-panel">
    <header class="panel-header projection-header">
      <div class="round-heading">
        <h2>{{ t(game.projectionScreen === 'reveal' ? 'reveal.title' : 'round.title', { n: game.roundNumber }) }}</h2>
        <span v-if="game.currentRoundTheme" class="theme-readonly">{{ game.currentRoundTheme }}</span>
      </div>
    </header>

    <ScoreboardGrid :revealing="game.projectionScreen === 'reveal'" />
  </section>
</template>
