import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { useGameStore } from '../game'

function firstPlayer(game: ReturnType<typeof useGameStore>) {
  const [player] = game.players

  expect(player).toBeDefined()
  return player!
}

describe('game store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('starts a new game by resetting scores and opening round screen', () => {
    const game = useGameStore()

    game.addPlayer('Leto')
    game.incrementSongDelta(firstPlayer(game).id)
    game.startGame()

    expect(game.screen).toBe('round')
    expect(game.currentRound).toBe(0)
    expect(firstPlayer(game).scores).toEqual([0])
    expect(game.getSongDelta(firstPlayer(game))).toBe(0)
  })

  it('resumes game without resetting scores', () => {
    const game = useGameStore()

    game.addPlayer('Jessica')
    game.incrementSongDelta(firstPlayer(game).id)
    game.nextSong()
    game.resumeGame()

    expect(game.screen).toBe('round')
    expect(firstPlayer(game).scores).toEqual([1])
  })

  it('creates a new round with zero scores and computes totals', () => {
    const game = useGameStore()

    game.addPlayer('Paul')
    game.addPlayer('Chani')
    const paulId = firstPlayer(game).id

    game.incrementSongDelta(paulId)
    game.incrementSongDelta(paulId)
    game.nextRound()

    expect(game.currentRound).toBe(1)
    expect(firstPlayer(game).scores).toEqual([2, 0])
    expect(game.getTotalScore(firstPlayer(game))).toBe(2)
  })

  it('keeps scores within two-digit bounds', () => {
    const game = useGameStore()

    game.addPlayer('Gurney')
    const id = firstPlayer(game).id

    for (let index = 0; index < 120; index += 1) {
      game.incrementSongDelta(id)
    }
    game.nextSong()

    expect(firstPlayer(game).scores[0]).toBe(99)

    for (let index = 0; index < 130; index += 1) {
      game.decrementSongDelta(id)
    }
    game.nextSong()

    expect(firstPlayer(game).scores[0]).toBe(0)
  })

  it('tracks the current song number, resetting on next round or a new game', () => {
    const game = useGameStore()

    game.addPlayer('Stilgar')
    expect(game.songNumber).toBe(1)

    game.nextSong()
    game.nextSong()
    expect(game.songNumber).toBe(3)

    game.nextRound()
    expect(game.songNumber).toBe(1)

    game.nextSong()
    expect(game.songNumber).toBe(2)

    game.startGame()
    expect(game.songNumber).toBe(1)
  })

  it('tracks a pending song delta and shows plus/minus feedback until committed', () => {
    const game = useGameStore()

    game.addPlayer('Duncan')
    const id = firstPlayer(game).id

    expect(game.getSongDelta(firstPlayer(game))).toBe(0)

    game.incrementSongDelta(id)
    game.incrementSongDelta(id)
    expect(game.getSongDelta(firstPlayer(game))).toBe(2)
    // Not applied to the round score yet - only read on nextSong/nextRound/endGame.
    expect(firstPlayer(game).scores).toEqual([0])

    game.decrementSongDelta(id)
    expect(game.getSongDelta(firstPlayer(game))).toBe(1)

    game.nextSong()
    expect(game.getSongDelta(firstPlayer(game))).toBe(0)
    expect(firstPlayer(game).scores).toEqual([1])

    game.decrementSongDelta(id)
    game.decrementSongDelta(id)
    expect(game.getSongDelta(firstPlayer(game))).toBe(-2)

    game.endGame()
    expect(game.getSongDelta(firstPlayer(game))).toBe(0)
    expect(firstPlayer(game).scores).toEqual([0])
  })

  it('sizes the score grid to the player count', () => {
    const game = useGameStore()

    // 0 players -> guarded to a 1x1 grid.
    expect([game.gridMajor, game.gridMinor]).toEqual([1, 1])

    const cases: Array<[number, number, number]> = [
      [1, 1, 1],
      [4, 2, 2],
      [8, 4, 2],
      [12, 4, 3],
    ]

    let added = 0
    for (const [count, major, minor] of cases) {
      while (added < count) {
        game.addPlayer(`P${added + 1}`)
        added += 1
      }

      expect([game.gridMajor, game.gridMinor]).toEqual([major, minor])
    }
  })

  it('tracks the played round count and its breakdown grid', () => {
    const game = useGameStore()

    expect(game.roundCount).toBe(1)
    expect([game.roundMajor, game.roundMinor]).toEqual([1, 1])

    game.addPlayer('Feyd')
    for (let round = 0; round < 11; round += 1) {
      game.nextRound()
    }

    expect(game.roundCount).toBe(12)
    // splitGrid(12): minor = ceil(sqrt(6)) = 3, major = ceil(12 / 3) = 4
    expect([game.roundMajor, game.roundMinor]).toEqual([4, 3])
  })

  it('returns to the screen settings was opened from', () => {
    const game = useGameStore()
    game.addPlayer('Alia')
    game.startGame()
    game.endGame()

    game.openSettings()
    expect(game.screen).toBe('settings')

    game.closeSettings()
    expect(game.screen).toBe('total')
  })

  it('does not stack the return screen when settings is already open', () => {
    const game = useGameStore()
    game.addPlayer('Alia')
    game.startGame()

    game.openSettings()
    game.openSettings()
    game.closeSettings()

    expect(game.screen).toBe('round')
  })

  it('keeps a persisted settings screen on reload, even without players', () => {
    // useLocalStorage keeps string refs raw, so no JSON.stringify here.
    localStorage.setItem('screen-counter:screen', 'settings')

    const game = useGameStore()

    expect(game.screen).toBe('settings')
  })

  it('falls back to setup when closing settings with no players', () => {
    localStorage.setItem('screen-counter:screen', 'settings')
    localStorage.setItem('screen-counter:settings-return', 'round')

    const game = useGameStore()
    game.closeSettings()

    expect(game.screen).toBe('setup')
  })

  it('mirrors the projection screen onto round and total, defaulting to round', () => {
    const game = useGameStore()

    expect(game.projectionScreen).toBe('round')

    game.addPlayer('Chani')
    game.startGame()
    expect(game.projectionScreen).toBe('round')

    game.endGame()
    expect(game.projectionScreen).toBe('total')

    game.backToGame()
    expect(game.projectionScreen).toBe('round')
  })

  it('freezes the projection screen while on setup or settings', () => {
    const game = useGameStore()

    game.addPlayer('Duncan')
    game.startGame()
    game.endGame()
    expect(game.projectionScreen).toBe('total')

    game.openSettings()
    expect(game.projectionScreen).toBe('total')

    game.closeSettings()
    game.goToSetup()
    expect(game.projectionScreen).toBe('total')
  })

  it('shares the projection screen across store instances via local storage', async () => {
    const firstSessionStore = useGameStore()

    firstSessionStore.addPlayer('Alia')
    firstSessionStore.startGame()
    firstSessionStore.endGame()
    await nextTick()

    setActivePinia(createPinia())
    const secondSessionStore = useGameStore()

    expect(secondSessionStore.projectionScreen).toBe('total')
  })

  it('falls back to round when the persisted projection screen is invalid', () => {
    // useLocalStorage keeps string refs raw, so no JSON.stringify here.
    localStorage.setItem('screen-counter:projection-screen', 'bogus')

    const game = useGameStore()

    expect(game.projectionScreen).toBe('round')
  })

  it('restores persisted game state from local storage', async () => {
    const firstSessionStore = useGameStore()

    firstSessionStore.addPlayer('Alia')
    firstSessionStore.incrementSongDelta(firstPlayer(firstSessionStore).id)
    firstSessionStore.nextRound()
    await nextTick()

    setActivePinia(createPinia())
    const secondSessionStore = useGameStore()

    expect(secondSessionStore.players.map((player) => player.name)).toEqual(['Alia'])
    expect(secondSessionStore.currentRound).toBe(1)
    expect(secondSessionStore.players[0]?.scores).toEqual([1, 0])
  })
})
