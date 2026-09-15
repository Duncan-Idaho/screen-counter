/// <reference types="vite/client" />

// `@intlify/unplugin-vue-i18n` transforms YAML locale files into precompiled
// message modules; type their default export for `vue-tsc`.
declare module '*.yaml' {
  const messages: Record<string, unknown>
  export default messages
}

// The Local Font Access API is not in TypeScript's DOM lib yet. Optional on
// purpose: it only exists in Chromium, and `src/lib/localFonts.ts` branches on
// that rather than assuming it.
interface FontData {
  readonly family: string
  readonly fullName: string
  readonly postscriptName: string
  readonly style: string
}

interface Window {
  queryLocalFonts?(options?: { postscriptNames?: string[] }): Promise<FontData[]>
}
