import { computed } from 'vue'
import { defineStore } from 'pinia'
import { useLocalStorage } from '@vueuse/core'

export type ScreenName = 'setup' | 'round' | 'total'

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
  const screen = useLocalStorage<ScreenName>('screen-counter:screen', 'setup')
  const nextPlayerId = useLocalStorage('screen-counter:next-player-id', 1)

  const hasPlayers = computed(() => players.value.length > 0)
  const roundNumber = computed(() => currentRound.value + 1)

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

  function sanitizeState() {
    players.value = normalizePlayers(players.value)
    currentRound.value = Math.max(0, Math.floor(Number(currentRound.value) || 0))

    if (!['setup', 'round', 'total'].includes(screen.value)) {
      screen.value = 'setup'
    }

    const maxPlayerId = players.value.reduce((max, player) => Math.max(max, player.id), 0)
    nextPlayerId.value = Math.max(Math.floor(Number(nextPlayerId.value) || 1), maxPlayerId + 1, 1)

    if (players.value.length === 0) {
      currentRound.value = 0
      screen.value = 'setup'
      return
    }

    ensureRound(currentRound.value)
  }

  sanitizeState()

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

  function incrementScore(playerId: number) {
    ensureRound(currentRound.value)
    const playerIndex = players.value.findIndex((entry) => entry.id === playerId)

    if (playerIndex < 0) {
      return
    }

    const player = players.value[playerIndex]
    if (!player) {
      return
    }

    const score = player.scores[currentRound.value] ?? 0
    player.scores[currentRound.value] = Math.min(MAX_SCORE, score + 1)
  }

  function decrementScore(playerId: number) {
    ensureRound(currentRound.value)
    const playerIndex = players.value.findIndex((entry) => entry.id === playerId)

    if (playerIndex < 0) {
      return
    }

    const player = players.value[playerIndex]
    if (!player) {
      return
    }

    const score = player.scores[currentRound.value] ?? 0
    player.scores[currentRound.value] = Math.max(MIN_SCORE, score - 1)
  }

  function nextRound() {
    currentRound.value += 1
    ensureRound(currentRound.value)
  }

  function endGame() {
    screen.value = 'total'
  }

  function backToGame() {
    screen.value = 'round'
  }

  function goToSetup() {
    screen.value = 'setup'
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
    screen,
    hasPlayers,
    addPlayer,
    removePlayer,
    startGame,
    resumeGame,
    incrementScore,
    decrementScore,
    nextRound,
    endGame,
    backToGame,
    goToSetup,
    getCurrentRoundScore,
    getTotalScore,
  }
})
