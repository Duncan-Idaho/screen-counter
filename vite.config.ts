import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'

// APP_CHANNEL: 'stable' (default) or 'beta'. The beta is served from `<base>beta/`
// and uses its own localStorage prefix (see src/lib/storageKey.ts).
// `--mode beta` (used by `npm run build:beta`) is equivalent to APP_CHANNEL=beta,
// which keeps the npm script free of shell-specific env syntax.
const root =
  process.env.GITHUB_ACTIONS && process.env.GITHUB_REPOSITORY
    ? `/${process.env.GITHUB_REPOSITORY.split('/')[1]}/`
    : '/'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const channel = process.env.APP_CHANNEL === 'beta' || mode === 'beta' ? 'beta' : 'stable'
  return {
  base: channel === 'beta' ? `${root}beta/` : root,
  define: {
    'import.meta.env.VITE_APP_CHANNEL': JSON.stringify(channel),
  },
  plugins: [
    vue(),
    VueI18nPlugin({
      include: [fileURLToPath(new URL('./src/i18n/locales/**', import.meta.url))],
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  }
})
