import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { i18n } from '@/i18n'
import LabeledNumber from '../LabeledNumber.vue'

describe('LabeledNumber', () => {
  it.each([
    ['en', 'Total: 7'],
    ['fr', 'Total : 7'],
  ] as const)('renders the %s translation with only the number in .digits', (locale, text) => {
    i18n.global.locale.value = locale
    const wrapper = mount(LabeledNumber, {
      props: { keypath: 'round.total', n: 7 },
      global: { plugins: [i18n] },
    })

    expect(wrapper.text().replace(/\s+/g, ' ')).toBe(text.replace(/\s+/g, ' '))
    expect(wrapper.get('.digits').text()).toBe('7')
    i18n.global.locale.value = 'en'
  })

  it('respects tag and passes class and style onto it', () => {
    const wrapper = mount(LabeledNumber, {
      props: { keypath: 'round.title', n: 3, tag: 'h2' },
      attrs: { class: 'x', style: '--chars: 7' },
      global: { plugins: [i18n] },
    })

    expect(wrapper.element.tagName).toBe('H2')
    expect(wrapper.classes()).toContain('x')
    expect(wrapper.attributes('style')).toContain('--chars')
    expect(wrapper.get('.digits').text()).toBe('3')
  })
})
