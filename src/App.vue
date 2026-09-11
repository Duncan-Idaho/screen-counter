<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameStore } from './stores/game'
import { THEME_FIELDS, themeFieldLabelKey, useSettingsStore } from './stores/settings'
import ColorPicker from './components/ColorPicker.vue'
import { DEFAULT_BACKGROUND_URL } from '@/lib/backgroundImage'
import type { Locale } from '@/i18n/locale'

const game = useGameStore()
const settings = useSettingsStore()
const { t, locale: i18nLocale } = useI18n({ useScope: 'global' })
const newPlayerName = ref('')
const backgroundError = ref('')
const backgroundInput = ref<HTMLInputElement | null>(null)

// The settings store owns the authoritative locale; mirror it onto the i18n
// instance (and the document) synchronously, so the first render is already in
// the right language and every later dropdown change re-renders.
watchEffect(() => {
  i18nLocale.value = settings.locale
  document.documentElement.lang = settings.locale
})

const bgImage = computed(() => settings.backgroundImage || DEFAULT_BACKGROUND_URL)

// Theme overrides ride alongside --bg-image on `.app`, so they also apply to the
// settings screen itself: picking a color previews it live.
const appStyle = computed(() => ({
  '--bg-image': `url('${bgImage.value}')`,
  ...settings.cssVars,
}))

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
    await settings.setBackgroundImage(file)
  } catch (error) {
    // The lib throws English, developer-facing detail (wrong file type, decode
    // failure, …); wrap it in a translated frame rather than swallowing it.
    backgroundError.value =
      error instanceof Error
        ? t('settings.background.errorDetail', { message: error.message })
        : t('settings.background.error')
  }
}
</script>

<template>
  <div class="app" :style="appStyle">
    <main class="shell">
      <section v-if="game.screen === 'setup'" class="panel setup-panel">
        <h1>{{ t('setup.title') }}</h1>

        <div class="setup-form">
          <input
            v-model="newPlayerName"
            type="text"
            :placeholder="t('setup.playerNamePlaceholder')"
            :aria-label="t('setup.playerNameLabel')"
            @keydown.enter.prevent="addPlayer"
          />
          <button type="button" @click="addPlayer">{{ t('setup.add') }}</button>
        </div>

        <ul class="players-list">
          <li v-for="player in game.players" :key="player.id">
            <span>{{ player.name }}</span>
            <button type="button" class="danger" @click="game.removePlayer(player.id)">
              {{ t('setup.remove') }}
            </button>
          </li>
        </ul>

        <div class="setup-actions">
          <button type="button" :disabled="!game.hasPlayers" @click="game.startGame">
            {{ t('setup.startGame') }}
          </button>
          <button type="button" :disabled="!game.hasPlayers" @click="game.resumeGame">
            {{ t('setup.resume') }}
          </button>
        </div>

        <hr class="setup-divider" />

        <div class="setup-actions">
          <button type="button" @click="game.openSettings">{{ t('common.settings') }}</button>
        </div>
      </section>

      <section v-else-if="game.screen === 'round'" class="panel round-panel">
        <header class="panel-header">
          <h2>{{ t('round.title', { n: game.roundNumber, song: game.songNumber }) }}</h2>
          <div class="actions">
            <button type="button" @click="game.nextSong">{{ t('round.nextSong') }}</button>
            <button type="button" @click="game.nextRound">{{ t('round.nextRound') }}</button>
            <button type="button" @click="game.endGame">{{ t('round.endGame') }}</button>
            <button type="button" @click="game.goToSetup">{{ t('common.setup') }}</button>
            <button type="button" @click="game.openSettings">{{ t('common.settings') }}</button>
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
              :aria-label="t('round.increment', { name: player.name })"
              @click="game.incrementSongDelta(player.id)"
            >
              <span class="round-score">{{ game.getCurrentRoundScore(player) }}</span>
              <span class="total-score">{{ t('round.total', { n: game.getTotalScore(player) }) }}</span>
            </button>

            <div class="score-controls">
              <button
                type="button"
                class="plus"
                :class="{ 'is-positive': game.getSongDelta(player) > 0 }"
                @click="game.incrementSongDelta(player.id)"
              >
                {{ game.getSongDelta(player) > 1 ? game.getSongDelta(player) : '+' }}
              </button>
              <button
                type="button"
                class="minus"
                :class="{ 'is-negative': game.getSongDelta(player) < 0 }"
                @click="game.decrementSongDelta(player.id)"
              >
                {{ game.getSongDelta(player) < -1 ? -game.getSongDelta(player) : '−' }}
              </button>
            </div>
          </article>
        </div>
      </section>

      <section v-else-if="game.screen === 'total'" class="panel total-panel">
        <header class="panel-header">
          <h2>{{ t('total.title') }}</h2>
          <div class="actions">
            <button type="button" @click="game.backToGame">{{ t('total.backToGame') }}</button>
            <button type="button" @click="game.goToSetup">{{ t('common.setup') }}</button>
            <button type="button" @click="game.openSettings">{{ t('common.settings') }}</button>
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

      <section v-else class="panel settings-panel">
        <header class="panel-header">
          <h2>{{ t('settings.title') }}</h2>
          <div class="actions">
            <button type="button" @click="game.closeSettings">{{ t('settings.back') }}</button>
          </div>
        </header>

        <h3>{{ t('settings.language.title') }}</h3>

        <div class="language-form">
          <select
            class="language-select"
            :value="settings.locale"
            :aria-label="t('settings.language.title')"
            @change="settings.setLocale(($event.target as HTMLSelectElement).value as Locale)"
          >
            <option value="en">English</option>
            <option value="fr">Français</option>
          </select>
        </div>

        <hr class="setup-divider" />

        <h3>{{ t('settings.background.title') }}</h3>

        <div class="background-form">
          <button type="button" @click="backgroundInput?.click()">
            {{ t('settings.background.choose') }}
          </button>
          <input
            ref="backgroundInput"
            type="file"
            accept="image/*"
            hidden
            @change="onPickBackground"
          />
          <button
            v-if="settings.backgroundImage"
            type="button"
            class="danger"
            @click="settings.clearBackgroundImage()"
          >
            {{ t('settings.background.remove') }}
          </button>
        </div>
        <p v-if="backgroundError" class="background-error">{{ backgroundError }}</p>

        <hr class="setup-divider" />

        <h3>{{ t('settings.theme.title') }}</h3>

        <div class="theme-form">
          <ColorPicker
            v-for="key in THEME_FIELDS"
            :key="key"
            :label="t(themeFieldLabelKey(key))"
            :alpha="key !== 'text'"
            :model-value="settings.theme[key]"
            @update:model-value="settings.setColor(key, $event)"
          />
        </div>

        <div class="setup-actions">
          <button type="button" class="danger" @click="settings.resetTheme()">
            {{ t('settings.theme.reset') }}
          </button>
        </div>
      </section>
    </main>
  </div>
</template>
