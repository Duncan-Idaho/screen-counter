import { computed, watch } from 'vue'
import { defineStore } from 'pinia'
import { useLocalStorage } from '@vueuse/core'

export type ScreenName = 'setup' | 'round' | 'total' | 'settings'

// Screens the settings screen can return to; `settings` itself is excluded so a
// round-trip can never land back on it.
export type ReturnScreenName = Exclude<ScreenName, 'settings'>

export interface Player {
  id: number
  name: string
  scores: number[]
}

const MIN_SCORE = 0
const MAX_SCORE = 99

export const useGameStore = defineStore('game', () => {
  const players = useLocalStorage<Player[]>('screen-counter:players', [])
  const currentRound = useLocalStorage('screen-counter:current-round', 0)
  // Count of songs played in the current round. Bumped by `nextSong`, reset to
  // zero by `nextRound` and by starting a new game.
  const currentSong = useLocalStorage('screen-counter:current-song', 0)
  // Points tallied for the song currently being played, per player id. Not part
  // of `scores` yet: `nextSong`/`nextRound`/`endGame` apply ("read") them into
  // the current round's score and reset this back to empty.
  const songDeltas = useLocalStorage<Record<number, number>>('screen-counter:song-deltas', {})
  const screen = useLocalStorage<ScreenName>('screen-counter:screen', 'setup')
  const nextPlayerId = useLocalStorage('screen-counter:next-player-id', 1)
  const settingsReturnScreen = useLocalStorage<ReturnScreenName>(
    'screen-counter:settings-return',
    'setup',
  )
  // Which screen a projection window (a second, fully independent app
  // instance opened via window.open - see MainScreen.vue's
  // openProjectionWindow and CLAUDE.md) should show. Kept as its own
  // localStorage-backed field, rather than read directly off `screen`, so it
  // can be frozen while the operator is on 'setup'/'settings': the audience
  // display must never flicker to an admin-only screen.
  const projectionScreen = useLocalStorage<'round' | 'total'>(
    'screen-counter:projection-screen',
    'round',
  )

  const hasPlayers = computed(() => players.value.length > 0)
  const roundNumber = computed(() => currentRound.value + 1)
  const songNumber = computed(() => currentSong.value + 1)

  // Split `count` cells into a landscape-biased grid: `minor` is the smaller
  // axis, `major` the larger (major >= minor). Used for both the player card
  // grid and the per-round breakdown; main.css maps major->columns / minor->rows
  // in landscape and swaps them in portrait.
  function splitGrid(count: number) {
    const n = Math.max(1, count)
    const minor = Math.ceil(Math.sqrt(n / 2))
    return { major: Math.ceil(n / minor), minor }
  }

  const gridMajor = computed(() => splitGrid(players.value.length).major)
  const gridMinor = computed(() => splitGrid(players.value.length).minor)

  // Number of played rounds (longest `scores` array, guarded to >= 1) and the
  // grid the total screen splits its per-round chips into so they always fit.
  const roundCount = computed(() =>
    Math.max(1, ...players.value.map((player) => player.scores.length), currentRound.value + 1),
  )
  const roundMajor = computed(() => splitGrid(roundCount.value).major)
  const roundMinor = computed(() => splitGrid(roundCount.value).minor)

  function normalizePlayers(rawPlayers: unknown) {
    const source = Array.isArray(rawPlayers) ? rawPlayers : []

    return source
      .filter((player) => Number.isInteger((player as Player).id) && (player as Player).id > 0)
      .map((player) => ({
        id: (player as Player).id,
        name: String((player as Player).name ?? '').trim(),
        scores:
          Array.isArray((player as Player).scores) && (player as Player).scores.length > 0
            ? (player as Player).scores.map((score) =>
                Math.max(MIN_SCORE, Math.min(MAX_SCORE, Number(score) || 0)),
              )
            : [0],
      }))
      .filter((player) => player.name.length > 0)
  }

  function normalizeSongDeltas(rawSongDeltas: unknown, playerIds: Set<number>) {
    const source =
      rawSongDeltas && typeof rawSongDeltas === 'object'
        ? (rawSongDeltas as Record<string, unknown>)
        : {}
    const result: Record<number, number> = {}

    for (const [key, value] of Object.entries(source)) {
      const id = Number(key)
      const delta = Math.trunc(Number(value))

      if (playerIds.has(id) && Number.isFinite(delta) && delta !== 0) {
        result[id] = delta
      }
    }

    return result
  }

  function sanitizeState() {
    players.value = normalizePlayers(players.value)
    currentRound.value = Math.max(0, Math.floor(Number(currentRound.value) || 0))
    currentSong.value = Math.max(0, Math.floor(Number(currentSong.value) || 0))
    songDeltas.value = normalizeSongDeltas(
      songDeltas.value,
      new Set(players.value.map((player) => player.id)),
    )

    if (!['setup', 'round', 'total', 'settings'].includes(screen.value)) {
      screen.value = 'setup'
    }

    if (!['setup', 'round', 'total'].includes(settingsReturnScreen.value)) {
      settingsReturnScreen.value = 'setup'
    }

    if (!['round', 'total'].includes(projectionScreen.value)) {
      projectionScreen.value = 'round'
    }

    const maxPlayerId = players.value.reduce((max, player) => Math.max(max, player.id), 0)
    nextPlayerId.value = Math.max(Math.floor(Number(nextPlayerId.value) || 1), maxPlayerId + 1, 1)

    if (players.value.length === 0) {
      currentRound.value = 0
      currentSong.value = 0
      songDeltas.value = {}
      // Settings needs no players, so it survives an empty roster; round/total
      // do not and fall back to setup.
      if (screen.value !== 'settings') {
        screen.value = 'setup'
      }
      settingsReturnScreen.value = 'setup'
      return
    }

    ensureRound(currentRound.value)
  }

  sanitizeState()

  // Mirrors `screen` into `projectionScreen` whenever it becomes 'round' or
  // 'total', and leaves it untouched otherwise (i.e. during 'setup'/
  // 'settings'). A reactive watcher rather than threading this into every
  // action that sets `screen` (startGame, resumeGame, backToGame, endGame,
  // goToSetup, openSettings, closeSettings) so it can't be forgotten at a
  // future call site.
  // `flush: 'sync'` so this is never one tick behind `screen` - actions like
  // `endGame()` must leave `projectionScreen` already updated by the time they
  // return, matching every other direct `screen.value = ...` assignment here.
  watch(
    screen,
    (next) => {
      if (next === 'round' || next === 'total') {
        projectionScreen.value = next
      }
    },
    { flush: 'sync' },
  )

  function addPlayer(name: string) {
    const pseudo = name.trim()

    if (!pseudo) {
      return
    }

    players.value.push({
      id: nextPlayerId.value++,
      name: pseudo,
      scores: [0],
    })
  }

  function removePlayer(id: number) {
    players.value = players.value.filter((player) => player.id !== id)
  }

  function resetScores() {
    players.value = players.value.map((player) => ({
      ...player,
      scores: [0],
    }))
    currentRound.value = 0
    currentSong.value = 0
    songDeltas.value = {}
  }

  function startGame() {
    if (!hasPlayers.value) {
      return
    }

    resetScores()
    screen.value = 'round'
  }

  function resumeGame() {
    if (!hasPlayers.value) {
      return
    }

    players.value = players.value.map((player) => ({
      ...player,
      scores: player.scores.length > 0 ? [...player.scores] : [0],
    }))

    screen.value = 'round'
  }

  function ensureRound(roundIndex: number) {
    players.value = players.value.map((player) => {
      const scores = [...player.scores]

      while (scores.length <= roundIndex) {
        scores.push(0)
      }

      return {
        ...player,
        scores,
      }
    })
  }

  function getSongDelta(player: Player) {
    return songDeltas.value[player.id] ?? 0
  }

  function incrementSongDelta(playerId: number) {
    songDeltas.value = {
      ...songDeltas.value,
      [playerId]: (songDeltas.value[playerId] ?? 0) + 1,
    }
  }

  function decrementSongDelta(playerId: number) {
    songDeltas.value = {
      ...songDeltas.value,
      [playerId]: (songDeltas.value[playerId] ?? 0) - 1,
    }
  }

  // Applies each player's pending song delta onto the current round's score
  // (clamped, like a direct score edit) and clears the deltas back to empty.
  function commitSongDeltas() {
    ensureRound(currentRound.value)

    players.value = players.value.map((player) => {
      const delta = songDeltas.value[player.id] ?? 0

      if (delta === 0) {
        return player
      }

      const scores = [...player.scores]
      const score = scores[currentRound.value] ?? 0
      scores[currentRound.value] = Math.max(MIN_SCORE, Math.min(MAX_SCORE, score + delta))

      return { ...player, scores }
    })

    songDeltas.value = {}
  }

  function nextSong() {
    commitSongDeltas()
    currentSong.value += 1
  }

  function nextRound() {
    commitSongDeltas()
    currentRound.value += 1
    currentSong.value = 0
    ensureRound(currentRound.value)
  }

  function endGame() {
    commitSongDeltas()
    screen.value = 'total'
  }

  function backToGame() {
    screen.value = 'round'
  }

  function goToSetup() {
    screen.value = 'setup'
  }

  // Settings is reachable from every screen, so remember where to go back to.
  function openSettings() {
    if (screen.value !== 'settings') {
      settingsReturnScreen.value = screen.value
    }

    screen.value = 'settings'
  }

  function closeSettings() {
    screen.value = hasPlayers.value ? settingsReturnScreen.value : 'setup'
  }

  function getCurrentRoundScore(player: Player) {
    return player.scores[currentRound.value] ?? 0
  }

  function getTotalScore(player: Player) {
    return player.scores.reduce((sum, score) => sum + score, 0)
  }

  return {
    players,
    currentRound,
    roundNumber,
    currentSong,
    songNumber,
    roundCount,
    roundMajor,
    roundMinor,
    gridMajor,
    gridMinor,
    screen,
    settingsReturnScreen,
    projectionScreen,
    hasPlayers,
    addPlayer,
    removePlayer,
    startGame,
    resumeGame,
    getSongDelta,
    incrementSongDelta,
    decrementSongDelta,
    nextSong,
    nextRound,
    endGame,
    backToGame,
    goToSetup,
    openSettings,
    closeSettings,
    getCurrentRoundScore,
    getTotalScore,
  }
})
