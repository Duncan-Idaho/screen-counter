import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import { i18n } from './i18n'
import { router } from './router'

// Each browser window - the main control window, and any projection window
// opened via window.open (see MainScreen.vue's openProjectionWindow) - runs
// this file as a fully independent app instance: its own Pinia, its own
// router, its own i18n, its own document. Nothing is shared between windows
// except localStorage (see stores/game.ts's `projectionScreen`).
const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(i18n)

app.mount('#app')
