import { describe, expect, it } from 'vitest'
import { splitGrid } from '../grid'

describe('splitGrid', () => {
  it('splits a cell count into a landscape-biased grid', () => {
    // [count, major, minor] - minor = ceil(sqrt(count / 2)), major = ceil(count / minor)
    const cases: Array<[number, number, number]> = [
      [1, 1, 1],
      [4, 2, 2],
      [8, 4, 2],
      [12, 4, 3],
    ]

    for (const [count, major, minor] of cases) {
      expect(splitGrid(count)).toEqual({ major, minor })
    }
  })

  it('floors an empty count at a single cell', () => {
    expect(splitGrid(0)).toEqual({ major: 1, minor: 1 })
  })
})
