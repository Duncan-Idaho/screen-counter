import { afterEach, describe, expect, it, vi } from 'vitest'
import { detectBrowserLocale } from '../locale'

function stubLanguages(languages: string[]) {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(languages)
  vi.spyOn(navigator, 'language', 'get').mockReturnValue(languages[0] ?? '')
}

describe('detectBrowserLocale', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns fr when the browser prefers French', () => {
    stubLanguages(['fr-FR', 'en-US'])

    expect(detectBrowserLocale()).toBe('fr')
  })

  it('matches on the primary subtag', () => {
    stubLanguages(['fr-CA'])

    expect(detectBrowserLocale()).toBe('fr')
  })

  it('falls back to the default locale when nothing is supported', () => {
    stubLanguages(['de-DE', 'es'])

    expect(detectBrowserLocale()).toBe('en')
  })
})
