<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from './stores/game'
import { DEFAULT_BACKGROUND_URL } from '@/lib/backgroundImage'

const game = useGameStore()
const newPlayerName = ref('')
const backgroundError = ref('')
const backgroundInput = ref<HTMLInputElement | null>(null)

const bgImage = computed(() => game.backgroundImage || DEFAULT_BACKGROUND_URL)

function addPlayer() {
  game.addPlayer(newPlayerName.value)
  newPlayerName.value = ''
}

async function onPickBackground(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''

  if (!file) {
    return
  }

  backgroundError.value = ''

  try {
    await game.setBackgroundImage(file)
  } catch (error) {
    backgroundError.value =
      error instanceof Error ? error.message : 'Could not use that image.'
  }
}
</script>

<template>
  <div class="app" :style="{ '--bg-image': `url('${bgImage}')` }">
    <main class="shell">
      <section v-if="game.screen === 'setup'" class="panel setup-panel">
        <h1>Karaoke Score Counter</h1>

        <div class="setup-form">
          <input
            v-model="newPlayerName"
            type="text"
            placeholder="Add a player pseudo"
            aria-label="Player pseudo"
            @keydown.enter.prevent="addPlayer"
          />
          <button type="button" @click="addPlayer">Add</button>
        </div>

        <ul class="players-list">
          <li v-for="player in game.players" :key="player.id">
            <span>{{ player.name }}</span>
            <button type="button" class="danger" @click="game.removePlayer(player.id)">Remove</button>
          </li>
        </ul>

        <div class="setup-actions">
          <button type="button" :disabled="!game.hasPlayers" @click="game.startGame">Start game</button>
          <button type="button" :disabled="!game.hasPlayers" @click="game.resumeGame">Resume</button>
        </div>

        <hr class="setup-divider" />

        <div class="background-form">
          <button type="button" @click="backgroundInput?.click()">Choose background</button>
          <input
            ref="backgroundInput"
            type="file"
            accept="image/*"
            hidden
            @change="onPickBackground"
          />
          <button
            v-if="game.backgroundImage"
            type="button"
            class="danger"
            @click="game.clearBackgroundImage()"
          >
            Remove background
          </button>
        </div>
        <p v-if="backgroundError" class="background-error">{{ backgroundError }}</p>
      </section>

      <section v-else-if="game.screen === 'round'" class="panel round-panel">
        <header class="panel-header">
          <h2>Round {{ game.roundNumber }}</h2>
          <div class="actions">
            <button type="button" @click="game.nextRound">Next round</button>
            <button type="button" @click="game.endGame">End game</button>
            <button type="button" @click="game.goToSetup">Setup</button>
          </div>
        </header>

        <div
          class="score-grid"
          :style="{ '--grid-major': game.gridMajor, '--grid-minor': game.gridMinor }"
        >
          <article v-for="player in game.players" :key="player.id" class="score-card">
            <h3>{{ player.name }}</h3>

            <button
              type="button"
              class="score-content"
              :aria-label="`Increment ${player.name}`"
              @click="game.incrementScore(player.id)"
            >
              <span class="round-score">{{ game.getCurrentRoundScore(player) }}</span>
              <span class="total-score">Total: {{ game.getTotalScore(player) }}</span>
            </button>

            <div class="score-controls">
              <button type="button" class="plus" @click="game.incrementScore(player.id)">+</button>
              <button type="button" class="minus" @click="game.decrementScore(player.id)">−</button>
            </div>
          </article>
        </div>
      </section>

      <section v-else class="panel total-panel">
        <header class="panel-header">
          <h2>Totals</h2>
          <div class="actions">
            <button type="button" @click="game.backToGame">Back to game</button>
            <button type="button" @click="game.goToSetup">Setup</button>
          </div>
        </header>

        <div
          class="score-grid"
          :style="{ '--grid-major': game.gridMajor, '--grid-minor': game.gridMinor }"
        >
          <article v-for="player in game.players" :key="player.id" class="score-card total-card">
            <h3>{{ player.name }}</h3>
            <p class="grand-total">{{ game.getTotalScore(player) }}</p>
            <ol
              class="round-list"
              :style="{ '--round-major': game.roundMajor, '--round-minor': game.roundMinor }"
            >
              <li
                v-for="(score, index) in player.scores"
                :key="`${player.id}-${index}`"
                class="round-item"
              >
                <span>{{ score }}</span>
              </li>
            </ol>
          </article>
        </div>
      </section>
    </main>
  </div>
</template>
