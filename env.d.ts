/// <reference types="vite/client" />

// `@intlify/unplugin-vue-i18n` transforms YAML locale files into precompiled
// message modules; type their default export for `vue-tsc`.
declare module '*.yaml' {
  const messages: Record<string, unknown>
  export default messages
}
