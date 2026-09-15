<script setup lang="ts">
import { computed } from 'vue'

// An odometer for the end-of-game penalty deduction: a one-line window over a
// column holding every value from the gross score down to the net one, scrolled
// from the first line to the last (13, 12, 11, 10 for a penalty of 3).
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
const props = defineProps<{ from: number; to: number; rolled?: boolean }>()

// Counts down, and is allowed to cross zero: `getFinalScore` may go negative on
// purpose (see stores/game.ts). `from === to` (no penalty, or penalties off)
// yields the single line the card then never scrolls.
const values = computed(() => {
  const span = Math.max(0, props.from - props.to)

  return Array.from({ length: span + 1 }, (_, index) => props.from - index)
})

const index = computed(() => (props.rolled ? values.value.length - 1 : 0))
</script>

<template>
  <span class="score-roll" role="img" :aria-label="String(rolled ? to : from)">
    <!-- The track carries every intermediate number, which a screen reader would
         otherwise recite one by one; the role and label on the element above
         reduce it to the number a sighted viewer can actually read right now.
         Kept inside, so the component keeps a single root element. -->
    <span class="score-roll-track" :style="{ '--roll-index': index }" aria-hidden="true">
      <span v-for="value in values" :key="value" class="score-roll-line">{{ value }}</span>
    </span>
  </span>
</template>
