import { describe, expect, it } from 'vitest'
import type { Player } from '@/stores/game'
import { sortByFinalScore, sortByTotalScore } from '../projectionOrder'

function player(id: number, name: string, scores: number[], penalties = 0): Player {
  return { id, name, scores, penalties }
}

function total(p: Player) {
  return p.scores.reduce((sum, score) => sum + score, 0)
}

function net(p: Player) {
  return total(p) - p.penalties
}

function penalty(p: Player) {
  return p.penalties
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

describe('sortByFinalScore', () => {
  it('breaks a tie on the net total by the smaller penalty', () => {
    // 37-7 and 38-8 both come to 30; 36-7 and 37-8 both come to 29. Within each
    // pair the team that lost less to penalties places higher.
    const players = [
      player(1, '37-8', [37], 8),
      player(2, '37-7', [37], 7),
      player(3, '38-8', [38], 8),
      player(4, '36-7', [36], 7),
    ]

    expect(sortByFinalScore(players, net, penalty).map((p) => p.name)).toEqual([
      '37-7',
      '38-8',
      '36-7',
      '37-8',
    ])
  })

  it('still ranks by the net total first', () => {
    // The bigger penalty wins here: 40-9 nets 31, ahead of a clean 30. The
    // penalty is only ever a tiebreak, never a ranking of its own.
    const players = [player(1, 'Clean', [30]), player(2, 'Penalised', [40], 9)]

    expect(sortByFinalScore(players, net, penalty).map((p) => p.name)).toEqual([
      'Penalised',
      'Clean',
    ])
  })

  it('keeps the original relative order for teams level on both', () => {
    const players = [player(1, 'A', [30], 5), player(2, 'B', [30], 5), player(3, 'C', [30], 5)]

    expect(sortByFinalScore(players, net, penalty).map((p) => p.name)).toEqual(['A', 'B', 'C'])
  })

  it('does not mutate the input array', () => {
    const players = [player(1, 'Penalised', [37], 8), player(2, 'Clean', [37])]

    sortByFinalScore(players, net, penalty)

    expect(players.map((p) => p.name)).toEqual(['Penalised', 'Clean'])
  })
})
