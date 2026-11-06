import { onUnmounted, ref, watch } from 'vue'
import { REVEAL_GAIN_CHIP_MS, REVEAL_HIGHLIGHT_HOLD_MS } from '@/lib/projectionOrder'

// The transient effects of a tile going from "not revealed" to "revealed": a
// "+N" chip and a celebration (strong glow + confetti). Fires on the
// *transition*, never on mount - `watch` has no `immediate` - so a reload or a
// projection window opened mid-reveal is silent by construction.
//
// Knows neither the store nor the round: takes two getters. The end-of-game view
// does not use it (its chip and confetti are two distinct instants separated by
// the penalty step, derived from the phase clock in TotalGrid).
export function useRevealEffects(revealed: () => boolean, gain: () => number) {
  const chip = ref<number | null>(null)
  const celebrating = ref(false)

  let chipTimer: ReturnType<typeof setTimeout> | undefined
  let celebrateTimer: ReturnType<typeof setTimeout> | undefined

  function cancel() {
    clearTimeout(chipTimer)
    clearTimeout(celebrateTimer)
    chip.value = null
    celebrating.value = false
  }

  watch(revealed, (now, before) => {
    cancel()

    const amount = gain()

    if (!now || before || amount <= 0) {
      return
    }

    chip.value = amount
    celebrating.value = true
    chipTimer = setTimeout(() => {
      chip.value = null
    }, REVEAL_GAIN_CHIP_MS)
    celebrateTimer = setTimeout(() => {
      celebrating.value = false
    }, REVEAL_HIGHLIGHT_HOLD_MS)
  })

  onUnmounted(() => {
    clearTimeout(chipTimer)
    clearTimeout(celebrateTimer)
  })

  return { chip, celebrating }
}
