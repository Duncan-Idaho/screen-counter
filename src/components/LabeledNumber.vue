<script setup lang="ts">
// A translated string with one `{n}` slot, where only the number is drawn in the
// digits font ("Total" and "Round" are text). Single root, so class/style fall
// through onto the rendered tag.
withDefaults(defineProps<{ keypath: string; n: number; tag?: string }>(), { tag: 'span' })
</script>

<template>
  <i18n-t :keypath="keypath" :tag="tag" scope="global">
    <template #n
      ><span class="digits">{{ n }}</span></template
    >
  </i18n-t>
</template>
