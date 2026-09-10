import { describe, expect, it } from 'vitest'
import { formatColor, parseColor, toHex } from '../color'

describe('parseColor', () => {
  it('parses a short hex', () => {
    expect(parseColor('#abc')).toEqual({ r: 170, g: 187, b: 204, a: 1 })
  })

  it('parses a long hex', () => {
    expect(parseColor('#1f130b')).toEqual({ r: 31, g: 19, b: 11, a: 1 })
  })

  it('parses rgb() as fully opaque', () => {
    expect(parseColor('rgb(28, 18, 12)')).toEqual({ r: 28, g: 18, b: 12, a: 1 })
  })

  it('parses rgba() including the alpha', () => {
    expect(parseColor('rgba(28, 18, 12, 0.65)')).toEqual({ r: 28, g: 18, b: 12, a: 0.65 })
  })

  it('tolerates surrounding whitespace', () => {
    expect(parseColor('  #abc  ')).toEqual({ r: 170, g: 187, b: 204, a: 1 })
  })

  it.each([
    ['', 'empty string'],
    ['red', 'named color'],
    ['#12345', 'wrong hex length'],
    ['#ggg', 'non-hex digits'],
    ['rgb(300, 0, 0)', 'channel out of range'],
    ['rgba(0, 0, 0, 2)', 'alpha out of range'],
    ['javascript:alert(1)', 'garbage'],
  ])('rejects %s (%s)', (value) => {
    expect(parseColor(value)).toBeNull()
  })

  it('rejects a non-string', () => {
    expect(parseColor(undefined)).toBeNull()
    expect(parseColor(42)).toBeNull()
  })
})

describe('toHex', () => {
  it('pads single-digit channels', () => {
    expect(toHex({ r: 1, g: 2, b: 3, a: 1 })).toBe('#010203')
  })

  it('drops the alpha, since <input type="color"> cannot carry it', () => {
    expect(toHex({ r: 28, g: 18, b: 12, a: 0.65 })).toBe('#1c120c')
  })
})

describe('formatColor', () => {
  it('emits a hex when the color is opaque', () => {
    expect(formatColor({ r: 247, g: 242, b: 236, a: 1 })).toBe('#f7f2ec')
  })

  it('emits rgba() when the color is translucent', () => {
    expect(formatColor({ r: 28, g: 18, b: 12, a: 0.65 })).toBe('rgba(28, 18, 12, 0.65)')
  })

  it('rounds a slider-sized alpha to two decimals', () => {
    expect(formatColor({ r: 0, g: 0, b: 0, a: 1 / 3 })).toBe('rgba(0, 0, 0, 0.33)')
  })

  it('round-trips every default the theme ships', () => {
    for (const value of ['#f7f2ec', 'rgba(28, 18, 12, 0.65)', 'rgba(255, 255, 255, 0.22)']) {
      const parsed = parseColor(value)

      expect(parsed).not.toBeNull()
      expect(formatColor(parsed!)).toBe(value)
    }
  })
})
