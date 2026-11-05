import { describe, expect, it } from 'vitest'
import {
  normalizeChannel,
  prefixForChannel,
  storageKey,
  storageKeyFor,
  PROJECTION_WINDOW_NAME,
} from '../storageKey'

describe('storageKey', () => {
  it('keeps the stable prefix unchanged', () => {
    expect(prefixForChannel('stable')).toBe('screen-counter')
    expect(storageKeyFor('stable', 'players')).toBe('screen-counter:players')
  })

  it('uses a distinct prefix for beta', () => {
    expect(prefixForChannel('beta')).toBe('screen-counter-beta')
    expect(storageKeyFor('beta', 'players')).toBe('screen-counter-beta:players')
  })

  it('falls back to stable for unknown channels', () => {
    expect(normalizeChannel(undefined)).toBe('stable')
    expect(normalizeChannel('whatever')).toBe('stable')
    expect(normalizeChannel('beta')).toBe('beta')
  })

  it('defaults to stable in tests', () => {
    expect(storageKey('locale')).toBe('screen-counter:locale')
    expect(PROJECTION_WINDOW_NAME).toBe('screen-counter-projection')
  })
})
