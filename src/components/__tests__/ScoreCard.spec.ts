import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { i18n } from '@/i18n'
import { useGameStore } from '@/stores/game'
import { useSettingsStore } from '@/stores/settings'
import ScoreCard from '../ScoreCard.vue'

function setUpGame() {
  const game = useGameStore()
  game.addPlayer('Alia')
  game.startGame()
  return game
}

function mountCard(game: ReturnType<typeof useGameStore>, mode: 'tally' | 'reveal' = 'tally') {
  return mount(ScoreCard, {
    props: { player: game.players[0]!, mode },
    global: { plugins: [i18n] },
  })
}

describe('ScoreCard', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('shows two controls when penalties are off and four when they are on', () => {
    const game = setUpGame()
    const settings = useSettingsStore()

    // Set explicitly rather than leaning on the default, which is on: this test
    // is about what the flag does, not about which way it starts (see
    // settings.spec for that).
    settings.setPenaltiesEnabled(false)

    expect(mountCard(game).findAll('.score-controls button').length).toBe(2)

    settings.setPenaltiesEnabled(true)

    expect(mountCard(game).findAll('.score-controls button').length).toBe(4)
  })

  it('shows the penalty beside the total only once there is one', () => {
    const game = setUpGame()
    useSettingsStore().setPenaltiesEnabled(true)

    expect(mountCard(game).find('.penalty-score').exists()).toBe(false)

    game.incrementPenalty(game.players[0]!.id)

    expect(mountCard(game).find('.penalty-score').text()).toContain('1')
  })

  it('keeps the tally total gross while the penalty stands beside it', () => {
    const game = setUpGame()
    useSettingsStore().setPenaltiesEnabled(true)
    const id = game.players[0]!.id

    for (let index = 0; index < 5; index += 1) game.incrementScore(id)
    game.incrementPenalty(id)

    const wrapper = mountCard(game)

    expect(wrapper.find('.total-score').text()).toContain('5')
    expect(wrapper.find('.penalty-score').text()).toContain('1')
  })

  it('leaves the reveal card free of penalty controls and numbers', () => {
    const game = setUpGame()
    useSettingsStore().setPenaltiesEnabled(true)
    game.incrementPenalty(game.players[0]!.id)
    game.endRound()

    const wrapper = mountCard(game, 'reveal')

    expect(wrapper.find('.score-controls').exists()).toBe(false)
    expect(wrapper.find('.penalty-score').exists()).toBe(false)
  })
})
