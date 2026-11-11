import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { DEFAULT_FONT, DEFAULT_THEME, useSettingsStore } from '../settings'
import type { Locale } from '@/i18n/locale'

describe('settings store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('stores a small image file verbatim as a data URL', async () => {
    const settings = useSettingsStore()
    const file = new File([new Uint8Array([1, 2, 3, 4])], 'bg.png', { type: 'image/png' })

    await settings.setBackgroundImage(file)

    expect(settings.backgroundImage.startsWith('data:image/png;base64,')).toBe(true)
  })

  it('rejects a non-image file and keeps the previous background', async () => {
    const settings = useSettingsStore()
    const file = new File(['not an image'], 'notes.txt', { type: 'text/plain' })

    await expect(settings.setBackgroundImage(file)).rejects.toThrow('image')
    expect(settings.backgroundImage).toBe('')
  })

  it('clears the background', async () => {
    const settings = useSettingsStore()
    await settings.setBackgroundImage(
      new File([new Uint8Array([1])], 'bg.png', { type: 'image/png' }),
    )

    settings.clearBackgroundImage()

    expect(settings.backgroundImage).toBe('')
  })

  it('drops a persisted background value that is not an image data URL', () => {
    localStorage.setItem('screen-counter:bg-image', 'https://example.com/evil.png')

    const settings = useSettingsStore()

    expect(settings.backgroundImage).toBe('')
  })

  it('restores a persisted background across sessions', async () => {
    const firstSession = useSettingsStore()
    await firstSession.setBackgroundImage(
      new File([new Uint8Array([9, 9, 9])], 'bg.png', { type: 'image/png' }),
    )
    await nextTick()

    setActivePinia(createPinia())
    const secondSession = useSettingsStore()

    expect(secondSession.backgroundImage.startsWith('data:image/png;base64,')).toBe(true)
  })

  it('defaults the theme to the palette main.css ships', () => {
    const settings = useSettingsStore()

    expect(settings.theme).toEqual(DEFAULT_THEME)
  })

  it('maps the theme onto the css custom properties main.css consumes', () => {
    const settings = useSettingsStore()

    settings.setColor('overlay', 'rgba(1, 2, 3, 0.5)')

    expect(settings.cssVars['--overlay']).toBe('rgba(1, 2, 3, 0.5)')
    expect(settings.cssVars['--app-text']).toBe(DEFAULT_THEME.text)
  })

  it('ignores a color it cannot parse', () => {
    const settings = useSettingsStore()

    settings.setColor('text', 'javascript:alert(1)')

    expect(settings.theme.text).toBe(DEFAULT_THEME.text)
  })

  it('restores a persisted theme across sessions', async () => {
    const firstSession = useSettingsStore()
    firstSession.setColor('text', '#00ff00')
    await nextTick()

    setActivePinia(createPinia())
    const secondSession = useSettingsStore()

    expect(secondSession.theme.text).toBe('#00ff00')
  })

  it('repairs a persisted theme that is corrupt or from an older shape', () => {
    localStorage.setItem(
      'screen-counter:theme',
      JSON.stringify({ text: 'not-a-color', overlay: '#123456', legacyKey: 'red' }),
    )

    const settings = useSettingsStore()

    expect(settings.theme.text).toBe(DEFAULT_THEME.text)
    expect(settings.theme.overlay).toBe('#123456')
    expect(settings.theme.card).toBe(DEFAULT_THEME.card)
    expect(Object.keys(settings.theme)).toEqual(Object.keys(DEFAULT_THEME))
  })

  it('resets every color back to the defaults', () => {
    const settings = useSettingsStore()
    settings.setColor('text', '#00ff00')
    settings.setColor('card', 'rgba(1, 2, 3, 0.4)')

    settings.resetTheme()

    expect(settings.theme).toEqual(DEFAULT_THEME)
  })

  describe('locale', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('defaults to the browser language on a first visit', () => {
      vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['fr-FR', 'en'])

      const settings = useSettingsStore()

      expect(settings.locale).toBe('fr')
    })

    it('persists an override across sessions', async () => {
      const firstSession = useSettingsStore()
      firstSession.setLocale('fr')
      await nextTick()

      setActivePinia(createPinia())
      const secondSession = useSettingsStore()

      expect(secondSession.locale).toBe('fr')
    })

    it('repairs an unsupported persisted locale', () => {
      localStorage.setItem('screen-counter:locale', 'de')

      const settings = useSettingsStore()

      expect(settings.locale).toBe('en')
    })

    it('ignores an unsupported locale passed to setLocale', () => {
      const settings = useSettingsStore()

      settings.setLocale('es' as Locale)

      expect(settings.locale).toBe('en')
    })
  })

  describe('font', () => {
    it('defaults to the stack main.css already shipped', () => {
      const settings = useSettingsStore()

      expect(settings.font).toBe(DEFAULT_FONT)
    })

    it('maps the font onto the css custom property main.css consumes', () => {
      const settings = useSettingsStore()

      settings.setFont('Comic Sans MS')

      expect(settings.cssVars['--app-font']).toBe('"Comic Sans MS"')
    })

    it('stores the normalized form', () => {
      const settings = useSettingsStore()

      settings.setFont("  'Segoe UI' ,Roboto ")

      expect(settings.font).toBe('"Segoe UI", Roboto')
    })

    it('ignores a value the validator rejects', () => {
      const settings = useSettingsStore()

      settings.setFont('Arial; background: red')

      expect(settings.font).toBe(DEFAULT_FONT)
    })

    it('persists an override across sessions', async () => {
      const firstSession = useSettingsStore()
      firstSession.setFont('Roboto')
      await nextTick()

      setActivePinia(createPinia())
      const secondSession = useSettingsStore()

      expect(secondSession.font).toBe('Roboto')
    })

    it('repairs a corrupt persisted font', () => {
      // A string ref, so useLocalStorage keeps it raw - no JSON.stringify.
      localStorage.setItem('screen-counter:font', 'Arial}body{color:red')

      const settings = useSettingsStore()

      expect(settings.font).toBe(DEFAULT_FONT)
    })

    it('normalizes a persisted font that was stored unnormalized', () => {
      localStorage.setItem('screen-counter:font', 'Segoe UI')

      const settings = useSettingsStore()

      expect(settings.font).toBe('"Segoe UI"')
    })

    it('is left alone by resetTheme and restored by resetFont', () => {
      const settings = useSettingsStore()
      settings.setFont('Roboto')

      settings.resetTheme()
      expect(settings.font).toBe('Roboto')

      settings.resetFont()
      expect(settings.font).toBe(DEFAULT_FONT)
    })
  })

  describe('penalties', () => {
    it('defaults to on', () => {
      const settings = useSettingsStore()

      // Penalties are on out of the box, so an operator who wants them never
      // has to find the setting first; the ones who do not, turn them off once
      // and the choice persists.
      expect(settings.penaltiesEnabled).toBe(true)
    })

    it('toggles off and back on', () => {
      const settings = useSettingsStore()

      settings.setPenaltiesEnabled(false)
      expect(settings.penaltiesEnabled).toBe(false)

      settings.setPenaltiesEnabled(true)
      expect(settings.penaltiesEnabled).toBe(true)
    })

    it('persists the flag across sessions', async () => {
      const firstSessionStore = useSettingsStore()
      // Persisting `false` is the case worth testing: `true` is what a fresh
      // store produces anyway, so it could not tell a restored choice from the
      // default.
      firstSessionStore.setPenaltiesEnabled(false)
      await nextTick()

      // useLocalStorage keeps booleans raw, so no JSON here.
      expect(localStorage.getItem('screen-counter:penalties-enabled')).toBe('false')

      setActivePinia(createPinia())
      expect(useSettingsStore().penaltiesEnabled).toBe(false)
    })

    it('reads any non-true persisted value as off', () => {
      localStorage.setItem('screen-counter:penalties-enabled', 'yes')

      const settings = useSettingsStore()

      expect(settings.penaltiesEnabled).toBe(false)
    })
  })
  describe('digit font', () => {
    it('defaults to empty and falls back to the text font in cssVars', () => {
      const settings = useSettingsStore()

      expect(settings.digitFont).toBe('')
      expect(settings.cssVars['--app-digit-font']).toBe('var(--app-font)')
    })

    it('stores the normalized form and leaves the text font alone', () => {
      const settings = useSettingsStore()

      settings.setDigitFont('Comic Sans MS')

      expect(settings.cssVars['--app-digit-font']).toBe('"Comic Sans MS"')
      expect(settings.cssVars['--app-font']).toBe(DEFAULT_FONT)
    })

    it('ignores an invalid value', () => {
      const settings = useSettingsStore()

      settings.setDigitFont('Arial}body{color:red')

      expect(settings.digitFont).toBe('')
    })

    it('persists under the screen-counter:digit-font key', async () => {
      const first = useSettingsStore()
      first.setDigitFont('Impact')
      await nextTick()

      expect(localStorage.getItem('screen-counter:digit-font')).toBe('Impact')

      setActivePinia(createPinia())
      expect(useSettingsStore().digitFont).toBe('Impact')
    })

    it('repairs a corrupt persisted value to the default', () => {
      localStorage.setItem('screen-counter:digit-font', 'Arial}body{color:red')

      expect(useSettingsStore().digitFont).toBe('')
    })

    it('normalizes a persisted family name', () => {
      localStorage.setItem('screen-counter:digit-font', 'Segoe UI')

      expect(useSettingsStore().digitFont).toBe('"Segoe UI"')
    })

    it('resets independently of the font and the theme', () => {
      const settings = useSettingsStore()
      settings.setFont('Georgia')
      settings.setColor('text', '#112233')
      settings.setDigitFont('Impact')

      settings.resetDigitFont()

      expect(settings.digitFont).toBe('')
      expect(settings.font).toBe('Georgia')
      expect(settings.theme.text).toBe('#112233')

      settings.setDigitFont('Impact')
      settings.resetFont()
      settings.resetTheme()
      expect(settings.digitFont).toBe('Impact')
    })
  })

  describe('banner height', () => {
    it('defaults to 33 and exposes it in dvh', () => {
      const settings = useSettingsStore()

      expect(settings.bannerHeight).toBe(33)
      expect(settings.cssVars['--projection-banner-height']).toBe('33dvh')
    })

    it.each([
      ['999', 50],
      ['5', 10],
      ['abc', 33],
      ['40.6', 41],
    ])('repairs a persisted %s to %i', (raw, expected) => {
      localStorage.setItem('screen-counter:banner-height', raw)

      expect(useSettingsStore().bannerHeight).toBe(expected)
    })

    it('clamps the setter and ignores NaN', () => {
      const settings = useSettingsStore()

      settings.setBannerHeight(0)
      expect(settings.bannerHeight).toBe(10)
      settings.setBannerHeight(100)
      expect(settings.bannerHeight).toBe(50)
      settings.setBannerHeight(Number.NaN)
      expect(settings.bannerHeight).toBe(50)
    })

    it('resets without touching the theme, and the theme reset leaves it alone', () => {
      const settings = useSettingsStore()
      settings.setBannerHeight(20)
      settings.resetTheme()
      expect(settings.bannerHeight).toBe(20)

      settings.resetBannerHeight()
      expect(settings.bannerHeight).toBe(33)
    })

    it('persists and follows a storage event from another window', async () => {
      const settings = useSettingsStore()
      settings.setBannerHeight(25)
      await nextTick()

      expect(localStorage.getItem('screen-counter:banner-height')).toBe('25')

      localStorage.setItem('screen-counter:banner-height', '40')
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'screen-counter:banner-height',
          newValue: '40',
          storageArea: localStorage,
        }),
      )
      await nextTick()

      expect(settings.cssVars['--projection-banner-height']).toBe('40dvh')
    })
  })
})
