<script setup lang="ts">
import { computed } from 'vue'

// An odometer: a one-line window over a column holding every value from one
// score to another, scrolled from the first line to the last. Down for the
// end-of-game penalty deduction (13, 12, 11, 10 for a penalty of 3), up for a
// round reveal (8, 9, 10, 11, 12).
//
// Deliberately store-free and i18n-free, like ColorPicker: it prints digits and
// nothing else, so it takes both ends of the count as numbers and leaves every
// decision about which two numbers those are to TotalCard.
//
// The timing is a CSS transition, not a JS animation, and that is what makes
// the silent cases silent: a transition never fires for a value that was
// already there at first paint, so a card that mounts with `rolled` set - the
// control window, or a projection window opened after the ceremony - prints the
// net score instantly and only a card whose `rolled` flips later scrolls.
//
// `highOnTop` is the end-of-game convention: the column always lists the highest
// value first, so a gain climbs towards the top line and a penalty sinks away
// from it. The track is anchored at the bottom for a gain and at the top for a
// penalty, so `from` stays framed while the column grows around it.
const props = defineProps<{ from: number; to: number; rolled?: boolean; highOnTop?: boolean }>()

// Counts either way, and is allowed to cross zero: `getFinalScore` may go
// negative on purpose (see stores/game.ts). `from === to` (no penalty, no gain)
// yields the single line the card then never scrolls - and, for a reveal, means
// the new total is not in the DOM at all until it is earned.
const values = computed(() => {
  const step = props.to >= props.from ? 1 : -1
  if (props.highOnTop) {
    const low = Math.min(props.from, props.to)
    const high = Math.max(props.from, props.to)

    return Array.from({ length: high - low + 1 }, (_, index) => high - index)
  }
  const span = Math.abs(props.from - props.to)

  return Array.from({ length: span + 1 }, (_, index) => props.from + index * step)
})

const index = computed(() => (props.rolled ? values.value.length - 1 : 0))

const gaining = computed(() => props.to > props.from)
// Signed distance, in lines, from the framed `from` line: positive moves the
// column down (revealing higher values), negative moves it up.
const offset = computed(() => {
  return props.rolled ? props.to - props.from : 0
})
const trackStyle = computed(() =>
  props.highOnTop
    ? { '--roll-offset': offset.value, '--roll-count': values.value.length }
    : { '--roll-index': index.value, '--roll-count': values.value.length },
)
</script>

<template>
  <span class="score-roll digits" role="img" :aria-label="String(rolled ? to : from)">
    <!-- The track carries every intermediate number, which a screen reader would
         otherwise recite one by one; the role and label on the element above
         reduce it to the number a sighted viewer can actually read right now.
         Kept inside, so the component keeps a single root element. -->
    <span
      class="score-roll-track"
      :class="highOnTop && (gaining ? 'score-roll-track--bottom' : 'score-roll-track--top')"
      :style="trackStyle"
      aria-hidden="true"
    >
      <span v-for="value in values" :key="value" class="score-roll-line">{{ value }}</span>
    </span>
  </span>
</template>
