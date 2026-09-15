import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { i18n } from '@/i18n'
import { useGameStore } from '@/stores/game'
import { useSettingsStore } from '@/stores/settings'
import TotalGrid from '../TotalGrid.vue'

// Four settled rounds, deliberately: splitGrid(4) is {2, 2} and splitGrid(5) is
// {3, 2}, so a grid sized for the rounds alone and one sized for the rounds plus
// the penalty chip are actually distinguishable. At three rounds both are
// {2, 2} and the regression test below would pass with the bug present.
const ROUNDS = 4

function mountGrid(sorted = false) {
  return mount(TotalGrid, { props: { sorted }, global: { plugins: [i18n] } })
}

function playRounds(names: string[], pointsPerRound: number[][]) {
  const game = useGameStore()

  for (const name of names) game.addPlayer(name)
  game.startGame()

  for (let round = 0; round < ROUNDS; round += 1) {
    game.players.forEach((player, index) => {
      for (let point = 0; point < (pointsPerRound[index]?.[round] ?? 0); point += 1) {
        game.incrementScore(player.id)
      }
    })
    game.endRound()
    if (round < ROUNDS - 1) game.nextRound()
  }

  return game
}

function roundGridVars(wrapper: ReturnType<typeof mountGrid>) {
  const style = wrapper.find('.round-list').attributes('style') ?? ''

  return {
    major: Number(/--round-major:\s*([\d.]+)/.exec(style)?.[1]),
    minor: Number(/--round-minor:\s*([\d.]+)/.exec(style)?.[1]),
  }
}

describe('TotalGrid', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('sizes the breakdown grid for the extra penalty cell', () => {
    const game = playRounds(
      ['Alia', 'Chani'],
      [
        [1, 2, 3, 4],
        [4, 5, 6, 7],
      ],
    )
    useSettingsStore().setPenaltiesEnabled(true)
    game.incrementPenalty(game.players[0]!.id)

    // splitGrid(5) - four rounds plus the chip - not splitGrid(4). Sizing for
    // the rounds alone lets .round-list clip the chip silently.
    expect(roundGridVars(mountGrid())).toEqual({ major: 3, minor: 2 })
  })

  it('sizes the breakdown grid for the rounds alone when nobody is penalised', () => {
    playRounds(['Alia'], [[1, 2, 3, 4]])
    useSettingsStore().setPenaltiesEnabled(true)

    expect(roundGridVars(mountGrid())).toEqual({ major: 2, minor: 2 })
  })

  it('gives every card the same split as soon as any team is penalised', () => {
    const game = playRounds(
      ['Penalised', 'Clean'],
      [
        [1, 1, 1, 1],
        [1, 1, 1, 1],
      ],
    )
    useSettingsStore().setPenaltiesEnabled(true)
    game.incrementPenalty(game.players[0]!.id)

    const styles = mountGrid()
      .findAll('.round-list')
      .map((node) => node.attributes('style'))

    // Chips have to stay the same size across cards, so the clean team's grid is
    // split for the extra cell too - it simply renders one cell fewer.
    expect(styles[0]).toBe(styles[1])
  })

  it('ranks the projection by the net total', () => {
    const game = playRounds(
      ['Leader', 'Runner'],
      [
        [5, 5, 5, 5],
        [4, 4, 4, 4],
      ],
    )
    useSettingsStore().setPenaltiesEnabled(true)

    // 20 - 6 = 14, behind Runner's clean 16.
    const leaderId = game.players[0]!.id
    for (let index = 0; index < 6; index += 1) game.incrementPenalty(leaderId)

    const wrapper = mountGrid(true)

    expect(wrapper.findAll('.total-card h3').map((node) => node.text())).toEqual([
      'Runner',
      'Leader',
    ])
    expect(wrapper.findAll('.grand-total').map((node) => node.text())).toEqual(['16', '14'])
  })

  it('ignores penalties entirely when the setting is off', () => {
    const game = playRounds(['Alia'], [[1, 2, 3, 4]])
    game.incrementPenalty(game.players[0]!.id)

    const wrapper = mountGrid()

    expect(wrapper.find('.round-item--penalty').exists()).toBe(false)
    expect(wrapper.find('.grand-total').text()).toBe('10')
    expect(roundGridVars(wrapper)).toEqual({ major: 2, minor: 2 })
  })

  it('shows the penalty as the last breakdown cell', () => {
    const game = playRounds(['Alia'], [[1, 2, 3, 4]])
    useSettingsStore().setPenaltiesEnabled(true)
    game.incrementPenalty(game.players[0]!.id)
    game.incrementPenalty(game.players[0]!.id)

    const wrapper = mountGrid()
    const cells = wrapper.findAll('.round-item')

    expect(cells.length).toBe(ROUNDS + 1)
    expect(cells[ROUNDS]?.classes()).toContain('round-item--penalty')
    expect(cells[ROUNDS]?.text()).toContain('2')
    expect(wrapper.find('.grand-total').text()).toBe('8')
  })
})
