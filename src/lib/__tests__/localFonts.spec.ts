import { afterEach, describe, expect, it, vi } from 'vitest'
import { LocalFontsError, canQueryLocalFonts, queryInstalledFontFamilies } from '../localFonts'

function stubQueryLocalFonts(implementation: () => Promise<FontData[]>) {
  vi.stubGlobal('queryLocalFonts', vi.fn(implementation))
}

function face(family: string, style: string): FontData {
  return { family, style, fullName: `${family} ${style}`, postscriptName: `${family}-${style}` }
}

describe('localFonts', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reports the api as absent in a browser that does not ship it', () => {
    expect(canQueryLocalFonts()).toBe(false)
  })

  it('reports the api as present once it exists', () => {
    stubQueryLocalFonts(async () => [])

    expect(canQueryLocalFonts()).toBe(true)
  })

  it('collapses the per-face list into sorted family names', async () => {
    stubQueryLocalFonts(async () => [
      face('Roboto', 'Regular'),
      face('Roboto', 'Bold'),
      face('Arial', 'Regular'),
    ])

    expect(await queryInstalledFontFamilies()).toEqual(['Arial', 'Roboto'])
  })

  it('reports a refused permission as denied', async () => {
    stubQueryLocalFonts(() => Promise.reject(new DOMException('nope', 'NotAllowedError')))

    await expect(queryInstalledFontFamilies()).rejects.toMatchObject({ reason: 'denied' })
  })

  it('reports an insecure context as denied', async () => {
    stubQueryLocalFonts(() => Promise.reject(new DOMException('nope', 'SecurityError')))

    await expect(queryInstalledFontFamilies()).rejects.toMatchObject({ reason: 'denied' })
  })

  it('reports any other rejection as a plain failure', async () => {
    stubQueryLocalFonts(() => Promise.reject(new Error('boom')))

    await expect(queryInstalledFontFamilies()).rejects.toMatchObject({ reason: 'failed' })
  })

  it('reports an absent api as unsupported', async () => {
    await expect(queryInstalledFontFamilies()).rejects.toBeInstanceOf(LocalFontsError)
    await expect(queryInstalledFontFamilies()).rejects.toMatchObject({ reason: 'unsupported' })
  })
})
