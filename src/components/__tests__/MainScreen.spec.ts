import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { i18n } from '@/i18n'
import { useGameStore } from '@/stores/game'
import { useSettingsStore } from '@/stores/settings'
import MainScreen from '../MainScreen.vue'

function mountSettings() {
  localStorage.setItem('screen-counter:screen', 'settings')
  return mount(MainScreen, { global: { plugins: [i18n] } })
}

function button(wrapper: ReturnType<typeof mountSettings>, label: string) {
  const found = wrapper.findAll('button').find((node) => node.text() === label)

  expect(found).toBeDefined()
  return found!
}

describe('MainScreen settings', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('has a text font picker and a number font picker writing to their own settings', async () => {
    const settings = useSettingsStore()
    const wrapper = mountSettings()
    const pickers = wrapper.findAll('.font-picker')

    expect(pickers.length).toBe(2)

    await pickers[1]!.get('input[type="text"]').setValue('Impact')

    expect(settings.digitFont).toBe('Impact')
    expect(settings.font).not.toBe('Impact')
  })

  it('exposes the banner height as a live slider', async () => {
    const settings = useSettingsStore()
    const wrapper = mountSettings()
    const slider = wrapper.get('.range-input')

    expect(slider.attributes('min')).toBe('10')
    expect(slider.attributes('max')).toBe('50')
    expect((slider.element as HTMLInputElement).value).toBe('33')

    // `input` alone, no `change`: the projection must follow while dragging.
    ;(slider.element as HTMLInputElement).value = '45'
    await slider.trigger('input')

    expect(settings.bannerHeight).toBe(45)
    expect(wrapper.get('.range-value').text()).toBe('45%')
  })

  it('resets each setting on its own', async () => {
    const settings = useSettingsStore()
    settings.setFont('Georgia')
    settings.setDigitFont('Impact')
    settings.setBannerHeight(20)
    const wrapper = mountSettings()

    await button(wrapper, 'Reset number font').trigger('click')
    expect(settings.digitFont).toBe('')
    expect(settings.font).toBe('Georgia')
    expect(settings.bannerHeight).toBe(20)

    await button(wrapper, 'Reset round title height').trigger('click')
    expect(settings.bannerHeight).toBe(33)
    expect(settings.font).toBe('Georgia')
  })

  it('draws the round number of the control header in the digits font', () => {
    const game = useGameStore()
    game.addPlayer('Alia')
    game.startGame()
    const wrapper = mount(MainScreen, { global: { plugins: [i18n] } })

    expect(wrapper.get('h2 .digits').text()).toBe('1')
  })
})
