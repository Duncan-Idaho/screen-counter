import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { i18n } from '@/i18n'
import { useGameStore } from '@/stores/game'
import ProjectionScreen from '../ProjectionScreen.vue'

function mountProjection() {
  return mount(ProjectionScreen, { global: { plugins: [i18n] } })
}

function setUpGame() {
  const game = useGameStore()
  game.addPlayer('Alia')
  game.addPlayer('Chani')
  game.startGame()
  return game
}

describe('ProjectionScreen', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('has no banner without players', () => {
    const wrapper = mountProjection()

    expect(wrapper.find('.projection-banner').exists()).toBe(false)
  })

  it('shows the round title in a banner, with the number in the digits font', () => {
    setUpGame()
    const wrapper = mountProjection()
    const banner = wrapper.get('.projection-banner')

    expect(banner.text()).toBe('Round 1')
    expect(banner.get('.digits').text()).toBe('1')
    expect(banner.get('h2').attributes('style')).toContain('--chars: 7')
    expect(banner.classes()).not.toContain('projection-banner--themed')
    expect(wrapper.find('.projection-banner-theme').exists()).toBe(false)
  })

  it('shows the same title during the reveal, without the results suffix', async () => {
    const game = setUpGame()
    const wrapper = mountProjection()
    const grid = wrapper.get('.scoreboard-grid').element

    game.endRound()
    await nextTick()

    expect(wrapper.get('.projection-banner').text()).toBe('Round 1')
    // Same instance: remounting would replay every glow and confetti burst.
    expect(wrapper.get('.scoreboard-grid').element).toBe(grid)
  })

  it('adds the round theme under the title when there is one', () => {
    const game = setUpGame()
    game.setRoundTheme(0, 'Eighties')
    const wrapper = mountProjection()

    expect(wrapper.get('.projection-banner').classes()).toContain('projection-banner--themed')
    expect(wrapper.get('.projection-banner-theme').text()).toBe('Eighties')
  })

  it('drops the banner on the final view', async () => {
    const game = setUpGame()
    const wrapper = mountProjection()

    game.endGame()
    await nextTick()

    expect(wrapper.find('.projection-banner').exists()).toBe(false)
    expect(wrapper.find('.total-panel').exists()).toBe(true)
  })
})
