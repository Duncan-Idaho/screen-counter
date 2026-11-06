import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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

  it('also scrolls upwards, which is what a round reveal does (8 -> 12)', () => {
    const wrapper = mountRoll({ from: 8, to: 12, rolled: true })

    expect(lines(wrapper)).toEqual(['8', '9', '10', '11', '12'])
    expect(rollIndex(wrapper)).toBe(4)
    expect(wrapper.find('.score-roll').attributes('aria-label')).toBe('12')
  })

  it('announces only the value currently framed', () => {
    expect(mountRoll({ from: 13, to: 10 }).find('.score-roll').attributes('aria-label')).toBe('13')
    expect(
      mountRoll({ from: 13, to: 10, rolled: true }).find('.score-roll').attributes('aria-label'),
    ).toBe('10')
  })

  it('exposes the line count so the offset can be a percentage of the track', () => {
    const style = mountRoll({ from: 13, to: 10 }).find('.score-roll-track').attributes('style')

    expect(style).toMatch(/--roll-count:\s*4/)
  })

  it('keeps the track offset independent of the tile size (no em/cqmin length)', () => {
    const css = readFileSync(resolve(__dirname, '../../assets/main.css'), 'utf8')
    const rule = /\.score-roll-track\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    const transform = /transform:\s*([^;]*);/.exec(rule)?.[1] ?? ''

    expect(transform).toContain('%')
    expect(transform).not.toMatch(/\d(em|cqmin|vmax|px)\b|-1em|var\(--roll-line-height/)
  })

  it('draws its numbers in the digits font', () => {
    expect(mountRoll({ from: 3, to: 3 }).get('.score-roll').classes()).toContain('digits')
  })
})

describe('ScoreRoll highOnTop (end-of-game view)', () => {
  function mountTop(props: { from: number; to: number; rolled?: boolean }) {
    return mount(ScoreRoll, { props: { ...props, highOnTop: true } })
  }
  function offset(wrapper: ReturnType<typeof mountTop>) {
    const style = wrapper.find('.score-roll-track').attributes('style') ?? ''

    return Number(/--roll-offset:\s*(-?[\d.]+)/.exec(style)?.[1])
  }

  it('stacks a gain with the highest value on top, resting on the start line', () => {
    const wrapper = mountTop({ from: 8, to: 10 })

    expect(lines(wrapper)).toEqual(['10', '9', '8'])
    expect(wrapper.find('.score-roll').classes()).toContain('score-roll--bottom')
    expect(offset(wrapper)).toBe(0)
  })

  it('climbs a gain to the top line', () => {
    const wrapper = mountTop({ from: 8, to: 10, rolled: true })

    expect(offset(wrapper)).toBe(2)
    expect(wrapper.find('.score-roll').attributes('aria-label')).toBe('10')
  })

  it('stacks a penalty with the highest value on top, starting on it', () => {
    const wrapper = mountTop({ from: 8, to: 5 })

    expect(lines(wrapper)).toEqual(['8', '7', '6', '5'])
    expect(wrapper.find('.score-roll').classes()).toContain('score-roll--top')
    expect(offset(wrapper)).toBe(0)
    expect(offset(mountTop({ from: 8, to: 5, rolled: true }))).toBe(-3)
  })

  it('renders a single silent line when nothing changes', () => {
    const wrapper = mountTop({ from: 7, to: 7, rolled: true })

    expect(lines(wrapper)).toEqual(['7'])
    expect(offset(wrapper)).toBe(0)
  })

  it('never takes the track out of flow (an absolute track collapsed the tile to 0px)', () => {
    const css = readFileSync(resolve(__dirname, '../../assets/main.css'), 'utf8')
    const rules = [...css.matchAll(/(\.score-roll[^{}]*)\{([^}]*)\}/g)]

    expect(rules.length).toBeGreaterThan(0)
    for (const [, selector, body] of rules) {
      expect(`${selector}{${body}}`).not.toMatch(/position:\s*absolute/)
    }
  })

  it('anchors a gain on its bottom line and a penalty on its top line through the window', () => {
    const css = readFileSync(resolve(__dirname, '../../assets/main.css'), 'utf8')

    expect(/\.score-roll--bottom\s*\{[^}]*justify-content:\s*flex-end/.test(css)).toBe(true)
    expect(/\.score-roll--top\s*>\s*\.score-roll-track[^{]*\{[^}]*translateY\([^;]*%\)/.test(css)).toBe(
      true,
    )
  })

  it('keeps the same track element from a gain to a penalty', async () => {
    const wrapper = mountTop({ from: 8, to: 10, rolled: true })
    const track = wrapper.find('.score-roll-track').element

    await wrapper.setProps({ from: 10, to: 7 })

    expect(wrapper.find('.score-roll-track').element).toBe(track)
    expect(lines(wrapper)).toEqual(['10', '9', '8', '7'])
    expect(offset(wrapper)).toBe(-3)
  })
})
