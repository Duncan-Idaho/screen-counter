import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { i18n } from '@/i18n'
import { useGameStore } from '@/stores/game'
import { REVEAL_GAIN_CHIP_MS, REVEAL_HIGHLIGHT_HOLD_MS } from '@/lib/projectionOrder'
import ProjectionScreen from '../ProjectionScreen.vue'
import ScoreboardGrid from '../ScoreboardGrid.vue'

function mountGrid() {
  return mount(ScoreboardGrid, { global: { plugins: [i18n] } })
}

type Wrapper = ReturnType<typeof mountGrid>

// The DOM stays in roster order (a re-ordered node loses its running roll); the
// rank is the CSS `order` on each tile.
function ranked(wrapper: Wrapper) {
  return wrapper
    .findAll('article')
    .sort((a, b) => Number((a.element as HTMLElement).style.order) - Number((b.element as HTMLElement).style.order))
}

function names(wrapper: Wrapper) {
  return ranked(wrapper).map((node) => node.get('h3').text())
}

function totals(wrapper: Wrapper) {
  return ranked(wrapper).map((node) => node.get('.score-roll').attributes('aria-label'))
}

function tile(wrapper: Wrapper, name: string) {
  const found = wrapper.findAll('article').find((node) => node.get('h3').text() === name)

  expect(found).toBeDefined()
  return found!
}

function rollIndex(node: ReturnType<typeof tile>) {
  const style = node.get('.score-roll-track').attributes('style') ?? ''

  return Number(/--roll-index:\s*(-?[\d.]+)/.exec(style)?.[1])
}

function lines(node: ReturnType<typeof tile>) {
  return node.findAll('.score-roll-line').map((line) => line.text())
}

function points(game: ReturnType<typeof useGameStore>, name: string, n: number) {
  const player = game.players.find((candidate) => candidate.name === name)!

  for (let i = 0; i < n; i += 1) game.incrementScore(player.id)

  return player
}

// Round 1 settled at Alia 3 / Bene 1 / Chani 0 / Duncan 2; round 2 tallied at
// Alia 2 / Bene 5 / Chani 0 / Duncan 0. Bene overtakes Alia once revealed.
function playedGame() {
  const game = useGameStore()

  for (const name of ['Alia', 'Bene', 'Chani', 'Duncan']) game.addPlayer(name)
  game.startGame()
  points(game, 'Alia', 3)
  points(game, 'Bene', 1)
  points(game, 'Duncan', 2)
  game.endRound()
  for (const player of game.players) game.revealPlayer(player.id)
  game.nextRound()
  points(game, 'Alia', 2)
  points(game, 'Bene', 5)

  return game
}

describe('ScoreboardGrid', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows a single settled total per tile during a round, never the tally', () => {
    playedGame()
    const wrapper = mountGrid()

    expect(names(wrapper)).toEqual(['Alia', 'Duncan', 'Bene', 'Chani'])
    expect(totals(wrapper)).toEqual(['3', '2', '1', '0'])
    expect(wrapper.find('.round-score').exists()).toBe(false)
    expect(wrapper.find('.total-score').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Total')
    expect(wrapper.find('.score-card--glow').exists()).toBe(false)
    // The private tally (Bene's 5) is nowhere in the DOM.
    expect(wrapper.html()).not.toContain('>6<')
  })

  it('keeps every tile, on the pre-round total and rank, when the round closes', async () => {
    const game = playedGame()
    const wrapper = mountGrid()

    game.endRound()
    await nextTick()

    expect(names(wrapper)).toEqual(['Alia', 'Duncan', 'Bene', 'Chani'])
    expect(totals(wrapper)).toEqual(['3', '2', '1', '0'])
    expect(wrapper.html()).not.toContain('>6<')
    expect(wrapper.find('.score-card--glow').exists()).toBe(false)
  })

  it('shows +N, rolls, reorders and celebrates when a tile is revealed', async () => {
    const game = playedGame()
    game.endRound()
    const wrapper = mountGrid()
    const before = tile(wrapper, 'Bene').get('.score-roll-track').element

    game.revealPlayer(game.players.find((p) => p.name === 'Bene')!.id)
    await nextTick()
    vi.advanceTimersByTime(40)
    await nextTick()

    const bene = tile(wrapper, 'Bene')

    expect(bene.get('.gain-chip').text()).toBe('+5')
    expect(lines(bene)).toEqual(['1', '2', '3', '4', '5', '6'])
    expect(rollIndex(bene)).toBe(5)
    expect(bene.get('.score-roll').attributes('aria-label')).toBe('6')
    // Same element, so the CSS transition has something to run on.
    expect(bene.get('.score-roll-track').element).toBe(before)
    expect(names(wrapper)).toEqual(['Bene', 'Alia', 'Duncan', 'Chani'])
    expect(bene.find('.confetti-burst').exists()).toBe(true)
    expect(bene.classes()).toContain('score-card--positive')
    expect(bene.classes()).toContain('score-card--glow')

    vi.advanceTimersByTime(REVEAL_HIGHLIGHT_HOLD_MS)
    await nextTick()
    expect(tile(wrapper, 'Bene').find('.confetti-burst').exists()).toBe(false)
    expect(tile(wrapper, 'Bene').classes()).not.toContain('score-card--positive')
    expect(tile(wrapper, 'Bene').classes()).toContain('score-card--glow')
    expect(tile(wrapper, 'Bene').find('.gain-chip').exists()).toBe(true)

    vi.advanceTimersByTime(REVEAL_GAIN_CHIP_MS - REVEAL_HIGHLIGHT_HOLD_MS)
    await nextTick()
    expect(tile(wrapper, 'Bene').find('.gain-chip').exists()).toBe(false)
  })

  it('marks a zero gain as revealed without chip, roll or confetti', async () => {
    const game = playedGame()
    game.endRound()
    const wrapper = mountGrid()

    game.revealPlayer(game.players.find((p) => p.name === 'Chani')!.id)
    await nextTick()

    const chani = tile(wrapper, 'Chani')

    expect(chani.find('.gain-chip').exists()).toBe(false)
    expect(chani.find('.confetti-burst').exists()).toBe(false)
    expect(lines(chani)).toEqual(['0'])
    expect(chani.classes()).toContain('score-card--glow')
    expect(chani.classes()).not.toContain('score-card--positive')
  })

  it('drops the glow and cancels the chip on the next round, remounting the roll silently', async () => {
    const game = playedGame()
    game.endRound()
    const wrapper = mountGrid()

    game.revealPlayer(game.players.find((p) => p.name === 'Bene')!.id)
    await nextTick()
    const before = tile(wrapper, 'Bene').get('.score-roll-track').element

    game.nextRound()
    await nextTick()

    const bene = tile(wrapper, 'Bene')

    expect(wrapper.find('.score-card--glow').exists()).toBe(false)
    expect(bene.find('.gain-chip').exists()).toBe(false)
    expect(bene.find('.confetti-burst').exists()).toBe(false)
    expect(bene.get('.score-roll-track').element).not.toBe(before)
    expect(lines(bene)).toEqual(['6'])
  })

  it('moves an unrevealed tile to its new total without a chip when the operator moves on', async () => {
    const game = playedGame()
    game.endRound()
    const wrapper = mountGrid()

    game.revealPlayer(game.players.find((p) => p.name === 'Alia')!.id)
    game.nextRound()
    await nextTick()

    const bene = tile(wrapper, 'Bene')

    expect(bene.get('.score-roll').attributes('aria-label')).toBe('6')
    expect(bene.find('.gain-chip').exists()).toBe(false)
    expect(bene.find('.confetti-burst').exists()).toBe(false)
  })

  it('rolls a tile that overtakes another: same node, same track, destination a frame later', async () => {
    const game = playedGame()
    game.endRound()
    const wrapper = mountGrid()
    const order = wrapper.findAll('article').map((node) => node.get('h3').text())
    const bene = tile(wrapper, 'Bene')
    const track = bene.get('.score-roll-track').element

    game.revealPlayer(game.players.find((p) => p.name === 'Bene')!.id)
    await nextTick()

    // Roster order in the DOM (a moved node would lose its running transition);
    // the new rank is only the CSS order.
    expect(wrapper.findAll('article').map((node) => node.get('h3').text())).toEqual(order)
    expect(names(wrapper)[0]).toBe('Bene')
    expect(tile(wrapper, 'Bene').element).toBe(bene.element)
    // Not yet at the new total: the roll starts from a clean style next frame.
    expect(tile(wrapper, 'Bene').get('.score-roll').attributes('aria-label')).toBe('1')

    vi.advanceTimersByTime(40)
    await nextTick()

    expect(tile(wrapper, 'Bene').get('.score-roll-track').element).toBe(track)
    expect(tile(wrapper, 'Bene').get('.score-roll').attributes('aria-label')).toBe('6')
  })

  it('stays silent when mounted mid-reveal, and still animates the next click', async () => {
    const game = playedGame()
    game.endRound()
    game.revealPlayer(game.players.find((p) => p.name === 'Bene')!.id)
    const wrapper = mountGrid()

    expect(names(wrapper)).toEqual(['Bene', 'Alia', 'Duncan', 'Chani'])
    expect(totals(wrapper)).toEqual(['6', '3', '2', '0'])
    expect(tile(wrapper, 'Bene').classes()).toContain('score-card--glow')
    expect(tile(wrapper, 'Alia').classes()).not.toContain('score-card--glow')
    expect(wrapper.find('.gain-chip').exists()).toBe(false)
    expect(wrapper.find('.confetti-burst').exists()).toBe(false)
    expect(wrapper.find('.score-card--positive').exists()).toBe(false)

    game.revealPlayer(game.players.find((p) => p.name === 'Alia')!.id)
    await nextTick()

    expect(tile(wrapper, 'Alia').get('.gain-chip').text()).toBe('+2')
    expect(wrapper.findAll('.gain-chip')).toHaveLength(1)
  })

  it('ignores penalties on the number and the rank', async () => {
    const game = playedGame()
    const alia = game.players.find((p) => p.name === 'Alia')!

    for (let i = 0; i < 4; i += 1) game.incrementPenalty(alia.id)

    const wrapper = mountGrid()

    expect(names(wrapper)[0]).toBe('Alia')
    expect(tile(wrapper, 'Alia').get('.score-roll').attributes('aria-label')).toBe('3')

    game.endRound()
    await nextTick()
    expect(names(wrapper)[0]).toBe('Alia')
    expect(tile(wrapper, 'Alia').get('.score-roll').attributes('aria-label')).toBe('3')
  })

  it('keeps the very same tiles from the round to the reveal and back', async () => {
    const game = playedGame()
    const wrapper = mount(ProjectionScreen, { global: { plugins: [i18n] } })
    // By name: the unrevealed tiles re-rank when the operator skips the reveal.
    const byName = () =>
      new Map(wrapper.findAll('article').map((node) => [node.get('h3').text(), node.element]))
    const before = byName()

    game.endRound()
    await nextTick()
    expect(byName()).toEqual(before)

    game.nextRound()
    await nextTick()
    for (const [name, element] of byName()) expect(element).toBe(before.get(name))
  })
})
