import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ScoreRoll from '../ScoreRoll.vue'

function mountRoll(props: { from: number; to: number; rolled?: boolean }) {
  return mount(ScoreRoll, { props })
}

function lines(wrapper: ReturnType<typeof mountRoll>) {
  return wrapper.findAll('.score-roll-line').map((node) => node.text())
}

function rollIndex(wrapper: ReturnType<typeof mountRoll>) {
  const style = wrapper.find('.score-roll-track').attributes('style') ?? ''

  return Number(/--roll-index:\s*(-?[\d.]+)/.exec(style)?.[1])
}

describe('ScoreRoll', () => {
  it('stacks every value from the gross score down to the net one', () => {
    expect(lines(mountRoll({ from: 13, to: 10 }))).toEqual(['13', '12', '11', '10'])
  })

  it('scrolls from the first line to the last', () => {
    expect(rollIndex(mountRoll({ from: 13, to: 10 }))).toBe(0)
    expect(rollIndex(mountRoll({ from: 13, to: 10, rolled: true }))).toBe(3)
  })

  it('renders a single line when there is nothing to deduct', () => {
    const wrapper = mountRoll({ from: 7, to: 7, rolled: true })

    expect(lines(wrapper)).toEqual(['7'])
    expect(rollIndex(wrapper)).toBe(0)
  })

  it('counts past zero, because the net score is allowed to go negative', () => {
    expect(lines(mountRoll({ from: 2, to: -2 }))).toEqual(['2', '1', '0', '-1', '-2'])
  })

  it('announces only the value currently framed', () => {
    expect(mountRoll({ from: 13, to: 10 }).find('.score-roll').attributes('aria-label')).toBe('13')
    expect(
      mountRoll({ from: 13, to: 10, rolled: true }).find('.score-roll').attributes('aria-label'),
    ).toBe('10')
  })
})
