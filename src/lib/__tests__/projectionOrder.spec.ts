import { describe, expect, it } from 'vitest'
import type { Player } from '@/stores/game'
import { sortByTotalScore } from '../projectionOrder'

function player(id: number, name: string, scores: number[]): Player {
  return { id, name, scores }
}

function total(p: Player) {
  return p.scores.reduce((sum, score) => sum + score, 0)
}

describe('sortByTotalScore', () => {
  it('orders players from highest to lowest total score', () => {
    const players = [player(1, 'Low', [5]), player(2, 'High', [20]), player(3, 'Mid', [10])]

    expect(sortByTotalScore(players, total).map((p) => p.name)).toEqual(['High', 'Mid', 'Low'])
  })

  it('keeps the original relative order for tied scores', () => {
    const players = [player(1, 'A', [10]), player(2, 'B', [10]), player(3, 'C', [10])]

    expect(sortByTotalScore(players, total).map((p) => p.name)).toEqual(['A', 'B', 'C'])
  })

  it('does not mutate the input array', () => {
    const players = [player(1, 'Low', [5]), player(2, 'High', [20])]

    sortByTotalScore(players, total)

    expect(players.map((p) => p.name)).toEqual(['Low', 'High'])
  })
})
