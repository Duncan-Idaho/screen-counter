import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { i18n } from '@/i18n'
import { useGameStore } from '@/stores/game'
import { useSettingsStore } from '@/stores/settings'
import { FINAL_GROSS_HOLD_MS, FINAL_SETTLE_MS } from '@/lib/projectionOrder'
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

  return Number(/--roll-index:\s*(-?[\d.]+)/.exec(style)?.[1])
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

  // The end of the game is a reveal too: the control window lists every team as
  // a button, and the projection fills up one card per click, each running the
  // three-beat ceremony (see lib/projectionOrder.ts).
  describe('the end-of-game reveal', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    // Leader is ahead on points (20 v 16) and behind on the net (14 v 16), so
    // the moment the penalty lands is the moment the two cards swap.
    function playPenalisedLeader() {
      const game = playRounds(
        ['Leader', 'Runner'],
        [
          [5, 5, 5, 5],
          [4, 4, 4, 4],
        ],
      )
      useSettingsStore().setPenaltiesEnabled(true)

      for (let index = 0; index < 6; index += 1) game.incrementPenalty(game.players[0]!.id)

      game.endGame()

      return game
    }

    it('lists every team as a reveal button on the control window', async () => {
      const game = playPenalisedLeader()
      const wrapper = mountGrid({ selectable: true })
      const buttons = wrapper.findAll('.card-reveal')

      expect(buttons.length).toBe(2)
      expect(buttons[0]?.attributes('aria-label')).toBe('Reveal Leader')

      await buttons[0]!.trigger('click')

      expect(game.revealedIds).toEqual([game.players[0]!.id])
      // Roster order, never the ranking: the operator's cards must not move
      // under their finger.
      expect(wrapper.findAll('.total-card h3').map((node) => node.text())).toEqual([
        'Leader',
        'Runner',
      ])
      expect(wrapper.findAll('.total-card')[0]?.classes()).toContain('score-card--revealed')
    })

    it('shows only the revealed teams on the projection', async () => {
      const game = playPenalisedLeader()
      const wrapper = mountGrid({ sorted: true, revealing: true })

      expect(wrapper.findAll('.total-card').length).toBe(0)

      game.revealPlayer(game.players[1]!.id)
      await nextTick()

      expect(wrapper.findAll('.total-card h3').map((node) => node.text())).toEqual(['Runner'])
    })

    it('walks a penalised team through the three beats', async () => {
      const game = playPenalisedLeader()
      const wrapper = mountGrid({ sorted: true, revealing: true })

      game.revealPlayer(game.players[0]!.id)
      await nextTick()

      // Beat one: the gross score, glowing, with the chip laid out but hidden.
      expect(grandTotals(wrapper)).toEqual(['20'])
      expect(rollIndex(wrapper)).toBe(0)
      expect(wrapper.find('.total-card').classes()).toContain('score-card--positive')
      expect(wrapper.find('.round-item--penalty').classes()).toContain('round-item--pending')
      expect(wrapper.find('.confetti-burst').exists()).toBe(false)

      // Beat two: the chip pulses and the total rolls down to the net score.
      vi.advanceTimersByTime(FINAL_GROSS_HOLD_MS)
      await nextTick()

      expect(wrapper.find('.round-item--penalty').classes()).toContain('round-item--pulsing')
      expect(wrapper.find('.round-item--penalty').classes()).not.toContain('round-item--pending')
      expect(grandTotals(wrapper)).toEqual(['14'])
      expect(rollIndex(wrapper)).toBe(6)

      // Beat three: the pulse stops and the confetti fires.
      vi.advanceTimersByTime(FINAL_SETTLE_MS - FINAL_GROSS_HOLD_MS)
      await nextTick()

      expect(wrapper.find('.round-item--penalty').classes()).not.toContain('round-item--pulsing')
      expect(wrapper.find('.total-card').classes()).not.toContain('score-card--positive')
      expect(wrapper.find('.confetti-burst').exists()).toBe(true)
    })

    it('holds a newcomer at its gross rank until the penalty lands', async () => {
      const game = playPenalisedLeader()
      const wrapper = mountGrid({ sorted: true, revealing: true })

      game.revealPlayer(game.players[1]!.id)
      await nextTick()
      vi.advanceTimersByTime(FINAL_SETTLE_MS)
      await nextTick()

      game.revealPlayer(game.players[0]!.id)
      await nextTick()

      // 20 points still beat Runner's 16, so Leader comes in on top...
      expect(wrapper.findAll('.total-card h3').map((node) => node.text())).toEqual([
        'Leader',
        'Runner',
      ])

      vi.advanceTimersByTime(FINAL_SETTLE_MS)
      await nextTick()

      // ...and drops past them the moment the deduction is applied. That late
      // switch of the sort key is the whole point of the third beat.
      expect(wrapper.findAll('.total-card h3').map((node) => node.text())).toEqual([
        'Runner',
        'Leader',
      ])
    })

    it('settles a team with nothing to deduct a beat early', async () => {
      const game = playPenalisedLeader()
      const wrapper = mountGrid({ sorted: true, revealing: true })

      game.revealPlayer(game.players[1]!.id)
      await nextTick()
      vi.advanceTimersByTime(FINAL_GROSS_HOLD_MS)
      await nextTick()

      // No chip to pulse and nothing to count down, so the middle beat is
      // skipped rather than held empty.
      expect(wrapper.find('.total-card').classes()).not.toContain('score-card--positive')
      expect(wrapper.find('.confetti-burst').exists()).toBe(true)
    })

    it('repaints an already-revealed board in silence', async () => {
      const game = playPenalisedLeader()
      game.revealPlayer(game.players[0]!.id)

      // Mounting into a reveal already in progress - a reload, or a projection
      // window opened late - must not replay anything.
      const wrapper = mountGrid({ sorted: true, revealing: true })

      expect(grandTotals(wrapper)).toEqual(['14'])
      expect(wrapper.find('.total-card').classes()).not.toContain('score-card--positive')
      expect(wrapper.find('.round-item--penalty').classes()).not.toContain('round-item--pending')
      expect(wrapper.find('.confetti-burst').exists()).toBe(false)

      vi.advanceTimersByTime(FINAL_SETTLE_MS)
      await nextTick()

      expect(wrapper.find('.confetti-burst').exists()).toBe(false)
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
      vi.advanceTimersByTime(FINAL_SETTLE_MS)
      game.revealPlayer(game.players[1]!.id)
      await nextTick()
      vi.advanceTimersByTime(FINAL_SETTLE_MS)
      await nextTick()

      expect(grandTotals(wrapper)).toEqual(['30', '30'])
      expect(wrapper.findAll('.total-card h3').map((node) => node.text())).toEqual([
        'Docked7',
        'Docked8',
      ])
    })

    it('ties as though the newcomer had no penalty until its own lands', async () => {
      const game = playRounds(
        ['Seated', 'Newcomer'],
        [
          [10, 10, 10, 7],
          [10, 10, 5, 5],
        ],
      )
      useSettingsStore().setPenaltiesEnabled(true)

      // Seated: 37 - 7 = 30, already on the board. Newcomer: 30 - 9 = 21.
      for (let index = 0; index < 7; index += 1) game.incrementPenalty(game.players[0]!.id)
      for (let index = 0; index < 9; index += 1) game.incrementPenalty(game.players[1]!.id)

      game.endGame()

      const wrapper = mountGrid({ sorted: true, revealing: true })

      game.revealPlayer(game.players[0]!.id)
      await nextTick()
      vi.advanceTimersByTime(FINAL_SETTLE_MS)
      await nextTick()

      game.revealPlayer(game.players[1]!.id)
      await nextTick()

      // Level at 30, and the newcomer's 9 has not landed yet - so it ties as a
      // clean team and goes first. Ranking it by a penalty the audience cannot
      // see yet would seat it low with no explanation.
      expect(wrapper.findAll('.total-card h3').map((node) => node.text())).toEqual([
        'Newcomer',
        'Seated',
      ])

      vi.advanceTimersByTime(FINAL_SETTLE_MS)
      await nextTick()

      expect(grandTotals(wrapper)).toEqual(['30', '21'])
      expect(wrapper.findAll('.total-card h3').map((node) => node.text())).toEqual([
        'Seated',
        'Newcomer',
      ])
    })

    it('never runs the ceremony on the control window', async () => {
      const game = playPenalisedLeader()
      const wrapper = mountGrid({ selectable: true })

      game.revealPlayer(game.players[0]!.id)
      await nextTick()

      expect(grandTotals(wrapper)).toEqual(['14', '16'])
      expect(wrapper.find('.score-card--positive').exists()).toBe(false)

      vi.advanceTimersByTime(FINAL_SETTLE_MS)
      await nextTick()

      expect(wrapper.find('.confetti-burst').exists()).toBe(false)
    })
  })
})
