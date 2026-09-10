<script setup lang="ts">
import { computed } from 'vue'
import { formatColor, parseColor, toHex, type Rgba } from '@/lib/color'

const props = withDefaults(
  defineProps<{
    modelValue: string
    label: string
    alpha?: boolean
  }>(),
  { alpha: true },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const FALLBACK: Rgba = { r: 0, g: 0, b: 0, a: 1 }

// Never null downstream: an unparseable value still has to render something.
const color = computed<Rgba>(() => parseColor(props.modelValue) ?? FALLBACK)

const hex = computed(() => toHex(color.value))
const opacityPercent = computed(() => Math.round(color.value.a * 100))

// Both inputs rebuild a full Rgba from the current one, so editing the hue
// keeps the alpha and moving the slider keeps the hue.
function onHexInput(event: Event) {
  const parsed = parseColor((event.target as HTMLInputElement).value)

  if (!parsed) {
    return
  }

  emit('update:modelValue', formatColor({ ...parsed, a: color.value.a }))
}

function onOpacityInput(event: Event) {
  const percent = Number((event.target as HTMLInputElement).value)

  if (!Number.isFinite(percent)) {
    return
  }

  emit('update:modelValue', formatColor({ ...color.value, a: percent / 100 }))
}
</script>

<template>
  <div class="color-picker">
    <span class="color-picker-label">{{ label }}</span>

    <input
      type="color"
      class="color-picker-swatch"
      :value="hex"
      :aria-label="`${label} color`"
      @input="onHexInput"
    />

    <input
      v-if="alpha"
      type="range"
      class="color-picker-opacity"
      min="0"
      max="100"
      step="1"
      :value="opacityPercent"
      :aria-label="`${label} opacity`"
      @input="onOpacityInput"
    />

    <span v-if="alpha" class="color-picker-value">{{ opacityPercent }}%</span>
  </div>
</template>

<style scoped>
/* Fixed tracks rather than auto-placement: an alpha-less row (no slider, no
   percentage) leaves columns 3-4 empty, and they must still hold their width so
   its swatch lines up with every other row. */
.color-picker {
  display: grid;
  grid-template-columns: 1fr auto max(10vmax, 90px) 4ch;
  align-items: center;
  gap: 0.6vmax;
  padding: 0.5vmax 0.8vmax;
  border-radius: 0.45vmax;
  background: var(--card-bg);
}

.color-picker-label {
  grid-column: 1;
}

.color-picker-swatch {
  grid-column: 2;
}

.color-picker-opacity {
  grid-column: 3;
}

.color-picker-value {
  grid-column: 4;
}

/* Reset the platform chrome so the swatch reads as a tile of the color. */
.color-picker-swatch {
  width: 4vmax;
  min-width: 44px;
  height: 2.4vmax;
  min-height: 28px;
  padding: 0;
  border: 1px solid var(--card-border);
  border-radius: 0.35vmax;
  background: none;
  cursor: pointer;
}

.color-picker-swatch::-webkit-color-swatch-wrapper {
  padding: 2px;
}

.color-picker-swatch::-webkit-color-swatch {
  border: none;
  border-radius: 0.25vmax;
}

.color-picker-opacity {
  width: 100%;
  padding: 0;
  accent-color: var(--button-bg);
  cursor: pointer;
}

.color-picker-value {
  text-align: right;
  font-variant-numeric: tabular-nums;
  opacity: 0.85;
}
</style>
