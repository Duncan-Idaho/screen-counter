import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ColorPicker from '../ColorPicker.vue'

function mountPicker(modelValue: string, alpha = true) {
  return mount(ColorPicker, { props: { modelValue, label: 'Overlay', alpha } })
}

// tsconfig.vitest.json sets `lib: []`, so Array.prototype.at is not typed here.
function lastEmitted(wrapper: ReturnType<typeof mountPicker>) {
  const events = wrapper.emitted('update:modelValue')

  expect(events).toBeDefined()
  return events![events!.length - 1]?.[0]
}

describe('ColorPicker', () => {
  it('shows the color as hex and the alpha as a percentage', () => {
    const wrapper = mountPicker('rgba(28, 18, 12, 0.65)')

    expect(wrapper.get('input[type="color"]').attributes('value')).toBe('#1c120c')
    expect(wrapper.get('input[type="range"]').attributes('value')).toBe('65')
    expect(wrapper.text()).toContain('65%')
  })

  it('keeps the alpha when the hue changes', async () => {
    const wrapper = mountPicker('rgba(28, 18, 12, 0.65)')
    const input = wrapper.get('input[type="color"]')

    await input.setValue('#ff0000')

    expect(lastEmitted(wrapper)).toBe('rgba(255, 0, 0, 0.65)')
  })

  it('keeps the hue when the opacity changes', async () => {
    const wrapper = mountPicker('rgba(28, 18, 12, 0.65)')

    await wrapper.get('input[type="range"]').setValue('20')

    expect(lastEmitted(wrapper)).toBe('rgba(28, 18, 12, 0.2)')
  })

  it('emits a plain hex once the color is fully opaque', async () => {
    const wrapper = mountPicker('rgba(28, 18, 12, 0.65)')

    await wrapper.get('input[type="range"]').setValue('100')

    expect(lastEmitted(wrapper)).toBe('#1c120c')
  })

  it('hides the opacity slider when alpha is disabled', () => {
    const wrapper = mountPicker('#f7f2ec', false)

    expect(wrapper.find('input[type="range"]').exists()).toBe(false)
  })

  it('renders an unparseable value without throwing', () => {
    const wrapper = mountPicker('not-a-color')

    expect(wrapper.get('input[type="color"]').attributes('value')).toBe('#000000')
  })
})
