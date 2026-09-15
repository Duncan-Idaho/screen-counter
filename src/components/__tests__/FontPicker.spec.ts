import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { i18n } from '@/i18n'
import FontPicker from '../FontPicker.vue'

function mountPicker(modelValue = 'Roboto') {
  return mount(FontPicker, { props: { modelValue }, global: { plugins: [i18n] } })
}

// tsconfig.vitest.json sets `lib: []`, so Array.prototype.at is not typed here.
function lastEmitted(wrapper: ReturnType<typeof mountPicker>) {
  const events = wrapper.emitted('update:modelValue')

  expect(events).toBeDefined()
  return events![events!.length - 1]?.[0]
}

function face(family: string): FontData {
  return { family, style: 'Regular', fullName: family, postscriptName: family }
}

// setValue() fires `input` *and* `change` (for v-model.lazy), which is a commit,
// not typing. Typing is the input event on its own.
async function type(wrapper: ReturnType<typeof mountPicker>, value: string) {
  const input = wrapper.get('input[type="text"]')
  ;(input.element as HTMLInputElement).value = value
  await input.trigger('input')
  return input
}

describe('FontPicker', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not commit while the operator is still typing', async () => {
    const wrapper = mountPicker()

    await type(wrapper, 'Comic S')

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('commits the normalized value once the field is left', async () => {
    const wrapper = mountPicker()

    const input = await type(wrapper, 'Segoe UI')
    await input.trigger('change')

    expect(lastEmitted(wrapper)).toBe('"Segoe UI"')
  })

  it('ignores a value the validator rejects', async () => {
    const wrapper = mountPicker()

    const input = await type(wrapper, 'Arial; background: red')
    await input.trigger('change')

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('previews the draft before it is committed', async () => {
    const wrapper = mountPicker()

    await type(wrapper, 'Segoe UI')

    expect(wrapper.get('.font-picker-preview').attributes('style')).toContain('Segoe UI')
  })

  it('offers the hint instead of a browse button where the api is missing', () => {
    const wrapper = mountPicker()

    expect(wrapper.find('.font-picker-browse').exists()).toBe(false)
    expect(wrapper.get('.font-picker-note').text()).toContain('Chrome or Edge')
  })

  it('lists the installed families and commits the one that is clicked', async () => {
    vi.stubGlobal('queryLocalFonts', vi.fn(async () => [face('Fira Sans'), face('Roboto')]))
    const wrapper = mountPicker('')

    await wrapper.get('.font-picker-browse').trigger('click')
    await nextFlush(wrapper)

    const rows = wrapper.findAll('.font-picker-list button')
    expect(rows.map((row) => row.text())).toEqual(['Fira Sans', 'Roboto'])

    await rows[0]!.trigger('click')
    expect(lastEmitted(wrapper)).toBe('"Fira Sans"')
  })

  it('filters the list by what is in the input', async () => {
    vi.stubGlobal('queryLocalFonts', vi.fn(async () => [face('Fira Sans'), face('Roboto')]))
    const wrapper = mountPicker('')

    await wrapper.get('.font-picker-browse').trigger('click')
    await nextFlush(wrapper)
    await type(wrapper, 'rob')

    const rows = wrapper.findAll('.font-picker-list button')
    expect(rows.map((row) => row.text())).toEqual(['Roboto'])
  })

  // Regression: the field is prefilled with the committed value - a whole stack
  // on a fresh screen - and seeding the list filter from it hid every family, so
  // Browse looked like it had done nothing at all.
  it('lists every family when the field still holds the committed stack', async () => {
    vi.stubGlobal('queryLocalFonts', vi.fn(async () => [face('Fira Sans'), face('Roboto')]))
    const wrapper = mountPicker('Inter, -apple-system, "Segoe UI"')

    await wrapper.get('.font-picker-browse').trigger('click')
    await nextFlush(wrapper)

    expect(wrapper.findAll('.font-picker-list button')).toHaveLength(2)
  })

  it('says so when the filter matches nothing, rather than showing an empty box', async () => {
    vi.stubGlobal('queryLocalFonts', vi.fn(async () => [face('Fira Sans'), face('Roboto')]))
    const wrapper = mountPicker('')

    await wrapper.get('.font-picker-browse').trigger('click')
    await nextFlush(wrapper)
    await type(wrapper, 'zzz')

    expect(wrapper.find('.font-picker-list').exists()).toBe(false)
    expect(wrapper.get('.font-picker-note').text()).toContain('No installed font matches')
  })

  it('explains a refused permission', async () => {
    vi.stubGlobal(
      'queryLocalFonts',
      vi.fn(() => Promise.reject(new DOMException('nope', 'NotAllowedError'))),
    )
    const wrapper = mountPicker()

    await wrapper.get('.font-picker-browse').trigger('click')
    await nextFlush(wrapper)

    expect(wrapper.get('.font-picker-error').text()).toContain('denied')
    expect(wrapper.find('.font-picker-list').exists()).toBe(false)
  })
})

// The click handler awaits the API before it renders, so one tick is not enough.
async function nextFlush(wrapper: ReturnType<typeof mountPicker>) {
  await Promise.resolve()
  await Promise.resolve()
  await wrapper.vm.$nextTick()
}
