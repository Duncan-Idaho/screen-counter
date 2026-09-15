// Local Font Access API wrapper, kept out of the store for the same reason as
// backgroundImage.ts: the store stays free of DOM APIs. Chromium only - Firefox
// and Safari have declined to ship this on fingerprinting grounds, so every
// caller needs a path that works without it.

export type LocalFontsFailure = 'unsupported' | 'denied' | 'failed'

// A typed reason rather than a message: the caller maps each case to its own
// translated string instead of matching on English text.
export class LocalFontsError extends Error {
  constructor(readonly reason: LocalFontsFailure) {
    super(`Could not list local fonts: ${reason}`)
    this.name = 'LocalFontsError'
  }
}

export function canQueryLocalFonts(): boolean {
  return typeof window !== 'undefined' && typeof window.queryLocalFonts === 'function'
}

// Must be called straight from a click handler: queryLocalFonts() needs
// transient user activation and a secure context, and prompts for the
// `local-fonts` permission the first time.
export async function queryInstalledFontFamilies(): Promise<string[]> {
  if (!window.queryLocalFonts) {
    throw new LocalFontsError('unsupported')
  }

  let fonts: FontData[]

  try {
    fonts = await window.queryLocalFonts()
  } catch (error) {
    // Refusing the permission prompt and a non-secure context both land here.
    const name = error instanceof DOMException ? error.name : ''
    const denied = name === 'NotAllowedError' || name === 'SecurityError'

    throw new LocalFontsError(denied ? 'denied' : 'failed')
  }

  // One entry per face, so several per family - the picker lists families.
  const families = new Set(fonts.map((font) => font.family))

  return Array.from(families).sort((a, b) => a.localeCompare(b))
}
