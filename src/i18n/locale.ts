// Locale detection and types, kept free of `vue-i18n` (and the YAML catalogs) so
// the settings store can import this without pulling in the i18n runtime.

export const SUPPORTED_LOCALES = ['en', 'fr'] as const

export type Locale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'en'

export function isSupportedLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

// Match the browser's preferred languages on their primary subtag (`fr-CA` ->
// `fr`), falling back to `DEFAULT_LOCALE` when none is supported.
export function detectBrowserLocale(): Locale {
  const candidates =
    typeof navigator === 'undefined'
      ? []
      : navigator.languages && navigator.languages.length > 0
        ? navigator.languages
        : [navigator.language]

  for (const candidate of candidates) {
    const primary = String(candidate ?? '')
      .toLowerCase()
      .split('-')[0]

    if (isSupportedLocale(primary)) {
      return primary
    }
  }

  return DEFAULT_LOCALE
}
