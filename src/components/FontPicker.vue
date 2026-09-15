<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { normalizeFontFamily } from '@/lib/font'
import { canQueryLocalFonts, LocalFontsError, queryInstalledFontFamilies } from '@/lib/localFonts'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

// Unlike ColorPicker this one resolves its own strings: it needs a label, a
// placeholder, a button, a hint and two error states, and passing five resolved
// labels down would be worse than the `useI18n` every screen already installs.
const { t } = useI18n({ useScope: 'global' })

// Free text, so the input carries a draft the store never sees until it is
// committed. Writing on every keystroke would restyle both windows - the
// projection included - while a half-typed name like `Comic S` matches nothing.
const draft = ref(props.modelValue)
const families = ref<string[]>([])
const error = ref('')

// The list narrows on what the operator types, never on what is committed. The
// field starts out holding a whole stack (or a family name picked earlier),
// which matches nothing, so seeding the filter from it left Browse looking
// broken - it fetched every family and then hid all of them.
const filter = ref('')

// Distinguishes "no families fetched yet" from "fetched, none match", so the
// button always visibly does something.
const browsed = ref(false)

// Chromium only. Everywhere else the text input is the whole feature, so the
// template swaps the browse button for a note saying why it is missing.
const canBrowse = canQueryLocalFonts()

watch(
  () => props.modelValue,
  (value) => {
    draft.value = value
  },
)

// Every sample goes through the validator, so an unusable name renders as the
// fallback instead of leaking into a style binding.
function sampleFont(family: string) {
  const normalized = normalizeFontFamily(family)

  return normalized ? `${normalized}, sans-serif` : 'sans-serif'
}

// Driven by the draft rather than the committed value: typing shows what a font
// looks like before the whole app takes it.
const previewFont = computed(() => sampleFont(draft.value))

// The input doubles as the list filter - a machine can have hundreds of faces.
const visibleFamilies = computed(() => {
  const needle = filter.value.trim().toLowerCase()

  if (!needle) {
    return families.value
  }

  return families.value.filter((family) => family.toLowerCase().includes(needle))
})

function onInput(event: Event) {
  draft.value = (event.target as HTMLInputElement).value
  filter.value = draft.value
}

function commit(value: string) {
  const normalized = normalizeFontFamily(value)

  if (!normalized) {
    return
  }

  draft.value = normalized
  emit('update:modelValue', normalized)
}

async function browse() {
  error.value = ''
  // Browsing is a fresh look at the whole list, so it drops any earlier filter.
  filter.value = ''

  try {
    families.value = await queryInstalledFontFamilies()
    browsed.value = true
  } catch (failure) {
    families.value = []
    browsed.value = false
    // A typed reason, so neither case has to be recognised from its message.
    error.value =
      failure instanceof LocalFontsError && failure.reason === 'denied'
        ? t('settings.font.errorDenied')
        : t('settings.font.error')
  }
}
</script>

<template>
  <div class="font-picker">
    <label class="font-picker-field">
      <span>{{ t('settings.font.label') }}</span>
      <input
        :value="draft"
        type="text"
        spellcheck="false"
        autocapitalize="off"
        autocomplete="off"
        :placeholder="t('settings.font.placeholder')"
        @input="onInput"
        @change="commit(draft)"
      />
    </label>

    <button v-if="canBrowse" type="button" class="font-picker-browse" @click="browse">
      {{ t('settings.font.browse') }}
    </button>
    <p v-else class="font-picker-note">{{ t('settings.font.unsupportedHint') }}</p>

    <p v-if="error" class="font-picker-error">{{ error }}</p>

    <!-- A rendered list rather than a <datalist>: each row is drawn in its own
         font, which is the point when hunting for one particular face, and
         datalist options cannot be styled. -->
    <ul v-if="visibleFamilies.length" class="font-picker-list">
      <li v-for="family in visibleFamilies" :key="family">
        <button type="button" :style="{ fontFamily: sampleFont(family) }" @click="commit(family)">
          {{ family }}
        </button>
      </li>
    </ul>
    <p v-else-if="browsed" class="font-picker-note">{{ t('settings.font.noMatches') }}</p>

    <p class="font-picker-preview" :style="{ fontFamily: previewFont }">
      <span class="font-picker-preview-name">{{ t('settings.font.previewName') }}</span>
      <span class="font-picker-preview-score">42</span>
    </p>
  </div>
</template>

<style scoped>
.font-picker {
  display: grid;
  gap: 0.5vmax;
  padding: 0.5vmax 0.8vmax;
  border-radius: 0.45vmax;
  background: var(--card-bg);
}

.font-picker-field {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.6vmax;
}

.font-picker-note,
.font-picker-error {
  font-size: 0.9em;
}

.font-picker-note {
  opacity: 0.75;
}

.font-picker-error {
  color: #ffd7c7;
}

/* Capped and scrolled on its own: .settings-panel already scrolls, and a
   machine with hundreds of families would otherwise push the theme pickers off
   the bottom of every screen. */
.font-picker-list {
  max-height: 18vmax;
  margin: 0;
  padding: 0;
  list-style: none;
  overflow: auto;
  border: 1px solid var(--card-border);
  border-radius: 0.45vmax;
}

.font-picker-list button {
  width: 100%;
  padding: 0.35vmax 0.6vmax;
  border: 0;
  border-radius: 0;
  text-align: left;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.font-picker-list button:hover {
  background: var(--control-bg-hover);
}

/* The two things actually read across the room: a name and a score. */
.font-picker-preview {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.6vmax;
  padding: 0.4vmax 0.6vmax;
  border-radius: 0.35vmax;
  background: var(--control-bg);
}

.font-picker-preview-name {
  font-size: clamp(14px, 1.4vmax, 26px);
  font-weight: 700;
}

.font-picker-preview-score {
  font-size: clamp(20px, 2.4vmax, 44px);
  font-weight: 800;
  line-height: 1;
}
</style>
