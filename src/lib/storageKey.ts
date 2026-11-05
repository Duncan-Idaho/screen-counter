// One place decides which localStorage namespace this build writes to.
// localStorage is shared per origin (not per path), so the stable build at `/`
// and the beta build at `/beta/` would otherwise read and write the same keys.
// Every localStorage key in the app MUST go through `storageKey`.

export type AppChannel = 'stable' | 'beta'

export const STABLE_PREFIX = 'screen-counter'
export const BETA_PREFIX = 'screen-counter-beta'

export function normalizeChannel(value: unknown): AppChannel {
  return value === 'beta' ? 'beta' : 'stable'
}

export function prefixForChannel(channel: AppChannel): string {
  return channel === 'beta' ? BETA_PREFIX : STABLE_PREFIX
}

export function storageKeyFor(channel: AppChannel, name: string): string {
  return `${prefixForChannel(channel)}:${name}`
}

export const APP_CHANNEL: AppChannel = normalizeChannel(import.meta.env.VITE_APP_CHANNEL)
export const IS_BETA = APP_CHANNEL === 'beta'

export function storageKey(name: string): string {
  return storageKeyFor(APP_CHANNEL, name)
}

/** Name of the projection window; per channel so beta never reuses stable's. */
export const PROJECTION_WINDOW_NAME = `${prefixForChannel(APP_CHANNEL)}-projection`
