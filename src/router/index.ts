import { createRouter, createWebHashHistory } from 'vue-router'
import MainScreen from '@/components/MainScreen.vue'
import ProjectionScreen from '@/components/ProjectionScreen.vue'

// Hash history (`#/projection`) is deliberate: GitHub Pages (deploy-pages.yml)
// has no server-side SPA fallback, and `base` is dynamic ('/' locally,
// '/<repo>/' in CI - see vite.config.ts). A window opened directly on a deep
// path under createWebHistory would 404 on Pages; the hash fragment is never
// sent to the server, so this needs zero extra deploy configuration. Do not
// switch this to createWebHistory.
export const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'main', component: MainScreen },
    { path: '/projection', name: 'projection', component: ProjectionScreen },
  ],
})
