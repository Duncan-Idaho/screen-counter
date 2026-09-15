import { describe, expect, it } from 'vitest'
import { MAX_FONT_FAMILY_LENGTH, normalizeFontFamily } from '../font'

describe('normalizeFontFamily', () => {
  it('keeps a plain family name as an unquoted identifier', () => {
    expect(normalizeFontFamily('Roboto')).toBe('Roboto')
  })

  it('quotes a family name containing spaces', () => {
    expect(normalizeFontFamily('Segoe UI')).toBe('"Segoe UI"')
  })

  it('leaves generic families and leading-hyphen identifiers unquoted', () => {
    expect(normalizeFontFamily('sans-serif')).toBe('sans-serif')
    expect(normalizeFontFamily('-apple-system')).toBe('-apple-system')
    expect(normalizeFontFamily('BlinkMacSystemFont')).toBe('BlinkMacSystemFont')
  })

  it('normalizes a whole stack and is idempotent over it', () => {
    const once = normalizeFontFamily("Inter, 'Segoe UI', -apple-system, sans-serif")

    expect(once).toBe('Inter, "Segoe UI", -apple-system, sans-serif')
    expect(normalizeFontFamily(once)).toBe(once)
  })

  it('trims parts and collapses whitespace inside a name', () => {
    expect(normalizeFontFamily('  Fira   Sans ,  Roboto  ')).toBe('"Fira Sans", Roboto')
  })

  it('rejects anything that could escape the css declaration', () => {
    expect(normalizeFontFamily('Arial; background: red')).toBeNull()
    expect(normalizeFontFamily('Arial}body{color:red')).toBeNull()
    expect(normalizeFontFamily('url(evil.woff2)')).toBeNull()
    expect(normalizeFontFamily('Arial/*x*/')).toBeNull()
    expect(normalizeFontFamily('Arial\\0041')).toBeNull()
    expect(normalizeFontFamily('Arial\nRoboto')).toBeNull()
  })

  it('rejects malformed lists and empty input', () => {
    expect(normalizeFontFamily('Arial,,Roboto')).toBeNull()
    expect(normalizeFontFamily(',Arial')).toBeNull()
    expect(normalizeFontFamily('Arial,')).toBeNull()
    expect(normalizeFontFamily('')).toBeNull()
    expect(normalizeFontFamily('   ')).toBeNull()
  })

  it('rejects an unbalanced quote', () => {
    expect(normalizeFontFamily('"Segoe UI')).toBeNull()
  })

  it('rejects a value past the length cap', () => {
    expect(normalizeFontFamily('a'.repeat(MAX_FONT_FAMILY_LENGTH + 1))).toBeNull()
  })

  it('rejects non-strings', () => {
    expect(normalizeFontFamily(null)).toBeNull()
    expect(normalizeFontFamily(42)).toBeNull()
    expect(normalizeFontFamily({})).toBeNull()
  })
})
