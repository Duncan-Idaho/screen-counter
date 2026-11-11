<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameStore } from '@/stores/game'
import LabeledNumber from './LabeledNumber.vue'
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
// the very same cards mounted instead of remounting them.
const game = useGameStore()
const { t } = useI18n({ useScope: 'global' })

// Only used to count characters, so the title can be sized to fill the banner.
const title = computed(() => t('round.title', { n: game.roundNumber }))
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

  <!-- A banner of fixed height (a setting, see --projection-banner-height) so the
       grid below never resizes as the operator types a theme mid-round: only the
       text shrinks inside it. The same "Round N" shows in round and reveal, so
       nothing jumps between them. -->
  <section v-else class="panel round-panel projection-round-panel">
    <header
      class="projection-banner"
      :class="{ 'projection-banner--themed': !!game.currentRoundTheme }"
    >
      <LabeledNumber
        keypath="round.title"
        :n="game.roundNumber"
        tag="h2"
        class="projection-banner-title"
        :style="{ '--chars': title.length }"
      />
      <p
        v-if="game.currentRoundTheme"
        class="projection-banner-theme"
        :style="{ '--chars': game.currentRoundTheme.length }"
      >
        {{ game.currentRoundTheme }}
      </p>
    </header>

    <ScoreboardGrid />
  </section>
</template>
