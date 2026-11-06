import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { i18n } from '@/i18n'
import { useGameStore } from '@/stores/game'
import { useSettingsStore } from '@/stores/settings'
import { FINAL_BEAT_MS, REVEAL_ROLL_MS } from '@/lib/projectionOrder'
import TotalGrid from '../TotalGrid.vue'

// Four settled rounds, deliberately: splitGrid(4) is {2, 2} and splitGrid(5) is
// {3, 2}, so a grid sized for the rounds alone and one sized for the rounds plus
// the penalty chip are actually distinguishable. At three rounds both are
// {2, 2} and the regression test below would pass with the bug present.
const ROUNDS = 4

function mountGrid(props: { sorted?: boolean; revealing?: boolean; selectable?: boolean } = {}) {
  return mount(TotalGrid, { props, global: { plugins: [i18n] } })
}

// The grand total is an odometer (ScoreRoll.vue), so its text node is every
// value it can scroll through at once; the label is the one currently framed.
function grandTotals(wrapper: ReturnType<typeof mountGrid>) {
  return wrapper.findAll('.score-roll').map((node) => node.attributes('aria-label'))
}

function rollIndex(wrapper: ReturnType<typeof mountGrid>) {
  const style = wrapper.find('.score-roll-track').attributes('style') ?? ''

  return Number(/--roll-offset:\s*(-?[\d.]+)/.exec(style)?.[1])
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

    const wrapper = mountGrid({ sorted: true })

    expect(wrapper.findAll('.total-card h3').map((node) => node.text())).toEqual([
      'Runner',
      'Leader',
    ])
    expect(grandTotals(wrapper)).toEqual(['16', '14'])
  })

  it('ignores penalties entirely when the setting is off', () => {
    const game = playRounds(['Alia'], [[1, 2, 3, 4]])
    useSettingsStore().setPenaltiesEnabled(false)
    game.incrementPenalty(game.players[0]!.id)

    const wrapper = mountGrid()

    expect(wrapper.find('.round-item--penalty').exists()).toBe(false)
    expect(grandTotals(wrapper)).toEqual(['10'])
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
    expect(grandTotals(wrapper)).toEqual(['8'])
  })

  // The end of the game is the last round's reveal plus the penalties: the
  // projection opens full, the control window drives one click per team (see
  // lib/projectionOrder.ts for the clock).
  describe('the end-of-game view', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    // Leader: 15 before the last round + 5, minus 7 = 13. Runner: 12 + 2 = 14.
    // Ahead on points and behind on the net, so the settle is where they swap.
    function playPenalisedLeader() {
      const game = playRounds(
        ['Leader', 'Runner'],
        [
          [5, 5, 5, 5],
          [4, 4, 4, 2],
        ],
      )
      useSettingsStore().setPenaltiesEnabled(true)

      for (let index = 0; index < 7; index += 1) game.incrementPenalty(game.players[0]!.id)

      game.endGame()

      return game
    }

    function names(wrapper: ReturnType<typeof mountGrid>) {
      return wrapper.findAll('.total-card h3').map((node) => node.text())
    }

    async function advance(ms: number) {
      vi.advanceTimersByTime(ms)
      await nextTick()
    }

    it('lists every team as a button on the control window: reveal, then detail', async () => {
      const game = playPenalisedLeader()
      const wrapper = mountGrid({ selectable: true })
      const button = () => wrapper.findAll('.card-reveal')[0]!

      expect(wrapper.findAll('.card-reveal').length).toBe(2)
      expect(button().attributes('aria-label')).toBe('Reveal Leader')
      expect(button().attributes('aria-pressed')).toBeUndefined()

      await button().trigger('click')

      expect(game.revealedIds).toEqual([game.players[0]!.id])
      expect(game.detailIds).toEqual([])
      // Roster order, never the ranking: the operator's cards must not move
      // under their finger.
      expect(names(wrapper)).toEqual(['Leader', 'Runner'])
      expect(wrapper.findAll('.total-card')[0]?.classes()).toContain('score-card--glow')
      expect(wrapper.findAll('.total-card')[0]?.classes()).not.toContain('score-card--revealed')
      expect(button().attributes('aria-label')).toBe('Show detail for Leader')
      expect(button().attributes('aria-pressed')).toBe('false')

      await button().trigger('click')

      expect(game.detailIds).toEqual([game.players[0]!.id])
      expect(wrapper.findAll('.total-card')[0]?.classes()).toContain('score-card--detail')
      expect(wrapper.find('.detail-badge').text()).toBe('Detail shown')
      expect(button().attributes('aria-label')).toBe('Hide detail for Leader')
      expect(button().attributes('aria-pressed')).toBe('true')

      await button().trigger('click')

      expect(game.detailIds).toEqual([])
      expect(wrapper.find('.detail-badge').exists()).toBe(false)
    })

    it('opens the projection full: every team, its starting score, one number', () => {
      playPenalisedLeader()
      const wrapper = mountGrid({ sorted: true, revealing: true })

      expect(names(wrapper)).toEqual(['Leader', 'Runner'])
      expect(grandTotals(wrapper)).toEqual(['15', '12'])
      expect(wrapper.findAll('.score-roll').length).toBe(2)
      expect(wrapper.find('.round-list').exists()).toBe(false)
      expect(wrapper.find('.total-label').exists()).toBe(false)
      expect(wrapper.find('.gain-chip').exists()).toBe(false)
      expect(wrapper.find('.score-card--glow').exists()).toBe(false)
    })

    it('walks a penalised team through gain, penalty and settle', async () => {
      const game = playPenalisedLeader()
      const wrapper = mountGrid({ sorted: true, revealing: true })

      game.revealPlayer(game.players[1]!.id)
      await nextTick()
      await advance(FINAL_BEAT_MS)
      expect(names(wrapper)).toEqual(['Leader', 'Runner'])

      game.revealPlayer(game.players[0]!.id)
      await nextTick()

      // +5: the number rolls from 15 up to 20.
      const card = () => wrapper.findAll('.total-card').find((c) => c.find('h3').text() === 'Leader')!
      expect(card().find('.gain-chip').text()).toBe('+5')
      expect(card().find('.gain-chip--penalty').exists()).toBe(false)
      expect(card().classes()).toContain('score-card--positive')
      expect(card().find('.score-roll').attributes('aria-label')).toBe('20')

      // The roll is over: same chip, same number, the roll is now from = to.
      await advance(REVEAL_ROLL_MS)
      expect(card().find('.gain-chip').text()).toBe('+5')
      expect(card().find('.score-roll').attributes('aria-label')).toBe('20')

      // -6: the number rolls down from 20 to 14.
      await advance(FINAL_BEAT_MS - REVEAL_ROLL_MS)
      expect(card().find('.gain-chip').exists()).toBe(true)
      expect(card().find('.gain-chip--penalty').text()).toBe('− 7')
      expect(card().find('.score-roll').attributes('aria-label')).toBe('13')
      expect(Number(/--roll-offset:\s*(-?\d+)/.exec(card().find('.score-roll-track').attributes('style')!)![1])).toBe(-7)
      expect(wrapper.find('.confetti-burst').exists()).toBe(false)
      // Still in its starting place: no tile moves during +N or -P.
      expect(names(wrapper)).toEqual(['Leader', 'Runner'])

      // Settled: no chip, confetti, the tile slides to its net rank.
      await advance(FINAL_BEAT_MS)
      expect(card().find('.gain-chip').exists()).toBe(false)
      expect(card().classes()).not.toContain('score-card--positive')
      expect(wrapper.find('.confetti-burst').exists()).toBe(true)
      expect(names(wrapper)).toEqual(['Runner', 'Leader'])
      // The glow outlives the ceremony.
      expect(card().classes()).toContain('score-card--glow')
    })

    it('keeps both chips inside the score block', async () => {
      const game = playPenalisedLeader()
      const wrapper = mountGrid({ sorted: true, revealing: true })

      game.revealPlayer(game.players[0]!.id)
      await advance(10)
      expect(wrapper.find('.score-content > .gain-chip').exists()).toBe(true)
      await advance(1300)
      expect(wrapper.find('.score-content > .gain-chip').exists()).toBe(true)
      await advance(1300)
      expect(wrapper.find('.score-content > .gain-chip--penalty').exists()).toBe(true)
    })

    it('skips the penalty step for a team with none', async () => {
      const game = playPenalisedLeader()
      const wrapper = mountGrid({ sorted: true, revealing: true })

      game.revealPlayer(game.players[1]!.id)
      await nextTick()
      const card = () => wrapper.findAll('.total-card')[1]!

      expect(card().find('.gain-chip').text()).toBe('+2')

      await advance(FINAL_BEAT_MS)

      expect(card().find('.gain-chip').exists()).toBe(false)
      expect(grandTotals(wrapper)[1]).toBe('14')
      expect(wrapper.find('.confetti-burst').exists()).toBe(true)
    })

    it('plays only the penalty for a team with no gain', async () => {
      const game = playRounds(['Quiet'], [[5, 5, 5, 0]])
      useSettingsStore().setPenaltiesEnabled(true)
      for (let index = 0; index < 3; index += 1) game.incrementPenalty(game.players[0]!.id)
      game.endGame()
      const wrapper = mountGrid({ sorted: true, revealing: true })

      game.revealPlayer(game.players[0]!.id)
      await nextTick()

      expect(wrapper.find('.gain-chip--penalty').text()).toBe('− 3')
      expect(grandTotals(wrapper)).toEqual(['12'])

      await advance(FINAL_BEAT_MS)
      expect(wrapper.find('.gain-chip').exists()).toBe(false)
      expect(wrapper.find('.confetti-burst').exists()).toBe(true)
    })

    it('settles at once, with confetti, a team with neither gain nor penalty', async () => {
      const game = playRounds(['Still'], [[5, 5, 5, 0]])
      useSettingsStore().setPenaltiesEnabled(true)
      game.endGame()
      const wrapper = mountGrid({ sorted: true, revealing: true })

      game.revealPlayer(game.players[0]!.id)
      await nextTick()

      expect(wrapper.find('.gain-chip').exists()).toBe(false)
      expect(grandTotals(wrapper)).toEqual(['15'])
      expect(wrapper.find('.confetti-burst').exists()).toBe(true)
    })

    it('plays no penalty step when the setting is off', async () => {
      const game = playPenalisedLeader()
      useSettingsStore().setPenaltiesEnabled(false)
      const wrapper = mountGrid({ sorted: true, revealing: true })

      game.revealPlayer(game.players[0]!.id)
      await nextTick()
      await advance(FINAL_BEAT_MS)

      expect(wrapper.find('.gain-chip').exists()).toBe(false)
      expect(grandTotals(wrapper)[0]).toBe('20')
      expect(names(wrapper)).toEqual(['Leader', 'Runner'])
    })

    it('does not give the gain twice to a team already revealed at the round reveal', async () => {
      const game = playRounds(
        ['Leader', 'Runner'],
        [
          [5, 5, 5, 5],
          [4, 4, 4, 4],
        ],
      )
      game.revealPlayer(game.players[0]!.id)
      game.endGame()
      const wrapper = mountGrid({ sorted: true, revealing: true })

      // Leader keeps the +5 it received; Runner has not got its +4 yet.
      expect(grandTotals(wrapper)).toEqual(['20', '12'])

      game.revealPlayer(game.players[0]!.id)
      await nextTick()

      expect(wrapper.find('.gain-chip').exists()).toBe(false)
      expect(grandTotals(wrapper)[0]).toBe('20')
    })

    it('places the lighter penalty first when two teams tie on the net', async () => {
      const game = playRounds(
        ['Docked8', 'Docked7'],
        [
          [10, 10, 10, 8],
          [10, 10, 10, 7],
        ],
      )
      useSettingsStore().setPenaltiesEnabled(true)

      // 38 - 8 and 37 - 7 both come to 30.
      for (let index = 0; index < 8; index += 1) game.incrementPenalty(game.players[0]!.id)
      for (let index = 0; index < 7; index += 1) game.incrementPenalty(game.players[1]!.id)

      game.endGame()

      const wrapper = mountGrid({ sorted: true, revealing: true })

      // Revealed heavier-first on purpose: the order has to come from the
      // tiebreak, not from the order the operator happened to click in.
      game.revealPlayer(game.players[0]!.id)
      await nextTick()
      await advance(FINAL_BEAT_MS * 2)
      game.revealPlayer(game.players[1]!.id)
      await nextTick()
      await advance(FINAL_BEAT_MS * 2)

      expect(grandTotals(wrapper)).toEqual(['30', '30'])
      expect(names(wrapper)).toEqual(['Docked7', 'Docked8'])
    })

    it('ties as though the newcomer had no penalty until it settles', async () => {
      const game = playRounds(
        ['Seated', 'Newcomer'],
        [
          [10, 10, 10, 7],
          [10, 10, 5, 5],
        ],
      )
      useSettingsStore().setPenaltiesEnabled(true)

      // Seated: 37 - 7 = 30. Newcomer: 30 - 9 = 21, starting at 25.
      for (let index = 0; index < 7; index += 1) game.incrementPenalty(game.players[0]!.id)
      for (let index = 0; index < 9; index += 1) game.incrementPenalty(game.players[1]!.id)

      game.endGame()

      const wrapper = mountGrid({ sorted: true, revealing: true })

      game.revealPlayer(game.players[0]!.id)
      await nextTick()
      await advance(FINAL_BEAT_MS * 2)

      // Seated is on 30, Newcomer still on its starting 25: Seated leads.
      expect(names(wrapper)).toEqual(['Seated', 'Newcomer'])

      game.revealPlayer(game.players[1]!.id)
      await nextTick()
      await advance(FINAL_BEAT_MS * 2)

      expect(names(wrapper)).toEqual(['Seated', 'Newcomer'])
      expect(grandTotals(wrapper)).toEqual(['30', '21'])
    })

    it('shows a toggled detail on a settled tile: rounds, penalty chip, net', async () => {
      const game = playPenalisedLeader()
      const wrapper = mountGrid({ sorted: true, revealing: true })

      game.revealPlayer(game.players[0]!.id)
      await nextTick()
      await advance(FINAL_BEAT_MS * 2)

      game.toggleDetail(game.players[0]!.id)
      await nextTick()

      const detailed = wrapper.findAll('.total-card').find((card) => card.find('h3').text() === 'Leader')!

      expect(detailed.findAll('.round-item').length).toBe(ROUNDS + 1)
      expect(detailed.find('.round-item--penalty').text()).toContain('7')
      expect(detailed.find('.score-roll').attributes('aria-label')).toBe('13')
      expect(detailed.find('.total-label').exists()).toBe(true)

      game.toggleDetail(game.players[0]!.id)
      await nextTick()

      expect(wrapper.find('.round-list').exists()).toBe(false)
    })

    it('opens several details side by side, each tile on its own', async () => {
      const game = playPenalisedLeader()
      const wrapper = mountGrid({ sorted: true, revealing: true })

      for (const player of game.players) game.revealPlayer(player.id)
      await nextTick()
      await advance(FINAL_BEAT_MS * 2)

      game.toggleDetail(game.players[0]!.id)
      game.toggleDetail(game.players[1]!.id)
      await nextTick()
      expect(wrapper.findAll('.round-list').length).toBe(2)

      game.toggleDetail(game.players[0]!.id)
      await nextTick()
      expect(wrapper.findAll('.round-list').length).toBe(1)
    })

    it('holds a detail toggled mid-ceremony back until the tile settles', async () => {
      const game = playPenalisedLeader()
      const wrapper = mountGrid({ sorted: true, revealing: true })

      game.revealPlayer(game.players[0]!.id)
      game.toggleDetail(game.players[0]!.id)
      await nextTick()

      expect(game.detailIds).toEqual([game.players[0]!.id])
      expect(wrapper.find('.round-list').exists()).toBe(false)
      expect(wrapper.find('.gain-chip').exists()).toBe(true)

      await advance(FINAL_BEAT_MS * 2)

      expect(wrapper.find('.round-list').exists()).toBe(true)
    })

    it('repaints a ceremony in progress in silence, detail included', async () => {
      const game = playPenalisedLeader()
      game.revealPlayer(game.players[1]!.id)
      game.revealPlayer(game.players[0]!.id)
      game.toggleDetail(game.players[0]!.id)

      // A reload, or a projection window opened late.
      const wrapper = mountGrid({ sorted: true, revealing: true })

      expect(names(wrapper)).toEqual(['Runner', 'Leader'])
      const leader = wrapper.findAll('.total-card')[1]!

      expect(leader.find('.score-roll').attributes('aria-label')).toBe('13')
      expect(leader.find('.round-list').exists()).toBe(true)
      expect(leader.classes()).not.toContain('score-card--positive')
      expect(wrapper.find('.gain-chip').exists()).toBe(false)
      expect(wrapper.find('.confetti-burst').exists()).toBe(false)

      await advance(FINAL_BEAT_MS * 3)

      expect(wrapper.find('.gain-chip').exists()).toBe(false)
      expect(wrapper.find('.confetti-burst').exists()).toBe(false)
    })

    it('re-mounts a settled tile’s roll when the penalties setting flips', async () => {
      const game = playPenalisedLeader()
      game.revealPlayer(game.players[0]!.id)
      const wrapper = mountGrid({ sorted: true, revealing: true })

      useSettingsStore().setPenaltiesEnabled(false)
      await nextTick()

      expect(grandTotals(wrapper)).toContain('20')
      expect(rollIndex(wrapper)).toBe(0)
      expect(wrapper.find('.gain-chip').exists()).toBe(false)
    })

    it('never runs the ceremony on the control window', async () => {
      const game = playPenalisedLeader()
      const wrapper = mountGrid({ selectable: true })

      game.revealPlayer(game.players[0]!.id)
      await nextTick()

      expect(grandTotals(wrapper)).toEqual(['13', '14'])
      expect(wrapper.find('.score-card--positive').exists()).toBe(false)
      expect(wrapper.find('.gain-chip').exists()).toBe(false)

      await advance(FINAL_BEAT_MS * 3)

      expect(wrapper.find('.confetti-burst').exists()).toBe(false)
    })
  })

  it('draws the round and penalty chips in the digits font, but not themes or labels', () => {
    const game = playRounds(['Alia'], [[1, 2, 3, 4]])
    useSettingsStore().setPenaltiesEnabled(true)
    game.incrementPenalty(game.players[0]!.id)
    game.setRoundTheme(0, 'Eighties')

    const wrapper = mountGrid()

    const scores = wrapper.findAll('.round-item-score')
    expect(scores.length).toBe(ROUNDS + 1)
    expect(scores.every((node) => node.classes().includes('digits'))).toBe(true)
    expect(wrapper.get('.round-item-theme').classes()).not.toContain('digits')
    expect(wrapper.get('.total-label').classes()).not.toContain('digits')
  })
})
