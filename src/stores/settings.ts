import { computed } from 'vue'
import { defineStore } from 'pinia'
import { useLocalStorage } from '@vueuse/core'
import { fileToBackgroundDataUrl, isValidBackgroundValue } from '@/lib/backgroundImage'
import { parseColor } from '@/lib/color'

// Appearance only: no player, score or screen state lives here. The defaults
// are the colors main.css ships in `:root`, so an untouched theme renders
// exactly like before the settings screen existed.
export const DEFAULT_THEME = {
  text: '#f7f2ec',
  overlay: 'rgba(28, 18, 12, 0.65)',
  panel: 'rgba(0, 0, 0, 0.24)',
  card: 'rgba(15, 9, 6, 0.78)',
  border: 'rgba(255, 255, 255, 0.22)',
  button: 'rgba(205, 135, 70, 0.86)',
  control: 'rgba(84, 42, 18, 0.65)',
  danger: 'rgba(168, 65, 44, 0.82)',
} as const

export type ThemeKey = keyof typeof DEFAULT_THEME
export type Theme = Record<ThemeKey, string>

// Order drives the settings screen; the label is the user-facing wording.
export const THEME_FIELDS: { key: ThemeKey; label: string }[] = [
  { key: 'text', label: 'Text' },
  { key: 'overlay', label: 'Background overlay' },
  { key: 'panel', label: 'Panel' },
  { key: 'card', label: 'Cards' },
  { key: 'border', label: 'Borders' },
  { key: 'button', label: 'Buttons' },
  { key: 'control', label: 'Plus / minus buttons' },
  { key: 'danger', label: 'Danger' },
]

const THEME_CSS_VARS: Record<ThemeKey, string> = {
  text: '--app-text',
  overlay: '--overlay',
  panel: '--panel-bg',
  card: '--card-bg',
  border: '--card-border',
  button: '--button-bg',
  control: '--control-bg',
  danger: '--danger-bg',
}

const THEME_KEYS = Object.keys(DEFAULT_THEME) as ThemeKey[]

export const useSettingsStore = defineStore('settings', () => {
  const backgroundImage = useLocalStorage<string>('screen-counter:bg-image', '')
  const theme = useLocalStorage<Theme>('screen-counter:theme', { ...DEFAULT_THEME })

  // Repair whatever came back from localStorage. Keep this defensive: persisted
  // data from older versions can be any shape.
  function sanitizeSettings() {
    if (backgroundImage.value && !isValidBackgroundValue(backgroundImage.value)) {
      backgroundImage.value = ''
    }

    const source = (theme.value ?? {}) as Partial<Record<ThemeKey, unknown>>

    // Rebuilt from DEFAULT_THEME rather than patched in place, so unknown keys
    // from an older persisted shape are dropped.
    theme.value = THEME_KEYS.reduce((result, key) => {
      result[key] = parseColor(source[key]) ? String(source[key]) : DEFAULT_THEME[key]
      return result
    }, {} as Theme)
  }

  sanitizeSettings()

  // Bound inline on `.app` in App.vue, the same way `--bg-image` already is, so
  // the overrides win over the `:root` defaults in main.css.
  const cssVars = computed(() =>
    THEME_KEYS.reduce<Record<string, string>>((vars, key) => {
      vars[THEME_CSS_VARS[key]] = theme.value[key]
      return vars
    }, {}),
  )

  function setColor(key: ThemeKey, value: string) {
    if (!parseColor(value)) {
      return
    }

    theme.value = { ...theme.value, [key]: value }
  }

  function resetTheme() {
    theme.value = { ...DEFAULT_THEME }
  }

  async function setBackgroundImage(file: File) {
    const previous = backgroundImage.value

    try {
      backgroundImage.value = await fileToBackgroundDataUrl(file)
    } catch (error) {
      backgroundImage.value = previous
      throw error
    }
  }

  function clearBackgroundImage() {
    backgroundImage.value = ''
  }

  return {
    backgroundImage,
    theme,
    cssVars,
    setColor,
    resetTheme,
    setBackgroundImage,
    clearBackgroundImage,
  }
})
