<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useGameStore } from '@/stores/game'
import ScoreGrid from './ScoreGrid.vue'
import TotalGrid from './TotalGrid.vue'

// Read-only mirror of MainScreen's round/total screens for a second monitor:
// no header, no controls. Which of round/total to show is driven entirely by
// `game.projectionScreen`, a field the main window's store keeps in sync (see
// stores/game.ts) - this window never mutates game state itself.
const game = useGameStore()
const { t } = useI18n({ useScope: 'global' })
</script>

<template>
  <section v-if="!game.hasPlayers" class="panel projection-waiting">
    <p>{{ t('projection.waiting') }}</p>
  </section>

  <section v-else-if="game.projectionScreen === 'round'" class="panel round-panel no-header">
    <ScoreGrid :interactive="false" />
  </section>

  <section v-else class="panel total-panel no-header">
    <TotalGrid />
  </section>
</template>
