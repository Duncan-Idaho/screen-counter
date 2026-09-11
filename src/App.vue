<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from './stores/settings'
import { DEFAULT_BACKGROUND_URL } from '@/lib/backgroundImage'

const settings = useSettingsStore()
const { locale: i18nLocale } = useI18n({ useScope: 'global' })

// The settings store owns the authoritative locale; mirror it onto the i18n
// instance (and the document) synchronously, so the first render is already in
// the right language and every later dropdown change re-renders. This must
// live here rather than in a routed screen: every window (main or projection)
// has its own document/i18n instance and needs this applied regardless of
// which route it's showing.
watchEffect(() => {
  i18nLocale.value = settings.locale
  document.documentElement.lang = settings.locale
})

const bgImage = computed(() => settings.backgroundImage || DEFAULT_BACKGROUND_URL)

// Theme overrides ride alongside --bg-image on `.app`, so they also apply to
// every routed screen (including a projection window, which reads the same
// settings store fresh from localStorage).
const appStyle = computed(() => ({
  '--bg-image': `url('${bgImage.value}')`,
  ...settings.cssVars,
}))
</script>

<template>
  <div class="app" :style="appStyle">
    <main class="shell">
      <router-view />
    </main>
  </div>
</template>
