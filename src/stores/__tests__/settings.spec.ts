import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { DEFAULT_THEME, useSettingsStore } from '../settings'

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
})
