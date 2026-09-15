<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameStore } from '@/stores/game'
import { THEME_FIELDS, themeFieldLabelKey, useSettingsStore } from '@/stores/settings'
import ColorPicker from './ColorPicker.vue'
import FontPicker from './FontPicker.vue'
import ScoreGrid from './ScoreGrid.vue'
import TotalGrid from './TotalGrid.vue'
import type { Locale } from '@/i18n/locale'

const game = useGameStore()
const settings = useSettingsStore()
const { t } = useI18n({ useScope: 'global' })
const newPlayerName = ref('')
const backgroundError = ref('')
const backgroundInput = ref<HTMLInputElement | null>(null)

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

// Opens (or refocuses - the window name is stable, so repeat clicks don't
// spawn duplicates) the read-only projection view for a second monitor. Never
// hardcode '/projection': BASE_URL is '/' locally and '/<repo>/' on GitHub
// Pages. If no second window is ever opened, this screen alone continues to
// serve as both control and projection, exactly as before this feature.
function openProjectionWindow() {
  window.open(`${import.meta.env.BASE_URL}#/projection`, 'screen-counter-projection', "popup=yes")
}
</script>

<template>
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
      <h2>{{ t('round.title', { n: game.roundNumber }) }}</h2>
      <div class="actions">
        <button type="button" @click="game.endRound">{{ t('round.endRound') }}</button>
        <button type="button" @click="game.endGame">{{ t('round.endGame') }}</button>
        <button type="button" @click="game.goToSetup">{{ t('common.setup') }}</button>
        <button type="button" @click="openProjectionWindow">
          {{ t('common.openProjection') }}
        </button>
        <button type="button" @click="game.openSettings">{{ t('common.settings') }}</button>
      </div>
    </header>

    <ScoreGrid mode="tally" />
  </section>

  <!-- Same shell as the round screen, minus the +/- controls: the operator now
       only clicks a card to reveal that team on the projection window. -->
  <section v-else-if="game.screen === 'reveal'" class="panel round-panel">
    <header class="panel-header">
      <h2>{{ t('reveal.title', { n: game.roundNumber }) }}</h2>
      <div class="actions">
        <button type="button" @click="game.nextRound">{{ t('round.nextRound') }}</button>
        <button type="button" @click="game.endGame">{{ t('round.endGame') }}</button>
        <button type="button" @click="game.goToSetup">{{ t('common.setup') }}</button>
        <button type="button" @click="openProjectionWindow">
          {{ t('common.openProjection') }}
        </button>
        <button type="button" @click="game.openSettings">{{ t('common.settings') }}</button>
      </div>
    </header>

    <ScoreGrid mode="reveal" />
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

    <TotalGrid />
  </section>

  <section v-else class="panel settings-panel">
    <header class="panel-header">
      <h2>{{ t('settings.title') }}</h2>
      <div class="actions">
        <button type="button" @click="openProjectionWindow">
          {{ t('common.openProjection') }}
        </button>
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

    <h3>{{ t('settings.font.title') }}</h3>

    <div class="font-form">
      <FontPicker :model-value="settings.font" @update:model-value="settings.setFont($event)" />
    </div>

    <div class="setup-actions">
      <button type="button" class="danger" @click="settings.resetFont()">
        {{ t('settings.font.reset') }}
      </button>
    </div>

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
</template>
