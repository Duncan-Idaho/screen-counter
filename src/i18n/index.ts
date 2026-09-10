import { createI18n, type I18nOptions } from 'vue-i18n'
import { DEFAULT_LOCALE } from './locale'
import en from './locales/en.yaml'
import fr from './locales/fr.yaml'

const messages = { en, fr } as I18nOptions['messages']

// `@intlify/unplugin-vue-i18n` precompiles the YAML catalogs at build time, so
// the default runtime-only `vue-i18n` build is enough. The store owns the
// authoritative locale (`useSettingsStore().locale`); App.vue keeps this
// instance in sync with it.
export const i18n = createI18n({
  legacy: false,
  locale: DEFAULT_LOCALE,
  fallbackLocale: DEFAULT_LOCALE,
  messages,
})
