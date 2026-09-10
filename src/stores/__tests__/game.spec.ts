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
    game.incrementScore(firstPlayer(game).id)
    game.startGame()

    expect(game.screen).toBe('round')
    expect(game.currentRound).toBe(0)
    expect(firstPlayer(game).scores).toEqual([0])
  })

  it('resumes game without resetting scores', () => {
    const game = useGameStore()

    game.addPlayer('Jessica')
    game.incrementScore(firstPlayer(game).id)
    game.resumeGame()

    expect(game.screen).toBe('round')
    expect(firstPlayer(game).scores).toEqual([1])
  })

  it('creates a new round with zero scores and computes totals', () => {
    const game = useGameStore()

    game.addPlayer('Paul')
    game.addPlayer('Chani')
    const paulId = firstPlayer(game).id

    game.incrementScore(paulId)
    game.incrementScore(paulId)
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
      game.incrementScore(id)
    }

    expect(firstPlayer(game).scores[0]).toBe(99)

    for (let index = 0; index < 130; index += 1) {
      game.decrementScore(id)
    }

    expect(firstPlayer(game).scores[0]).toBe(0)
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

  it('stores a small image file verbatim as a data URL', async () => {
    const game = useGameStore()
    const file = new File([new Uint8Array([1, 2, 3, 4])], 'bg.png', { type: 'image/png' })

    await game.setBackgroundImage(file)

    expect(game.backgroundImage.startsWith('data:image/png;base64,')).toBe(true)
  })

  it('rejects a non-image file and keeps the previous background', async () => {
    const game = useGameStore()
    const file = new File(['not an image'], 'notes.txt', { type: 'text/plain' })

    await expect(game.setBackgroundImage(file)).rejects.toThrow('image')
    expect(game.backgroundImage).toBe('')
  })

  it('clears the background', async () => {
    const game = useGameStore()
    await game.setBackgroundImage(new File([new Uint8Array([1])], 'bg.png', { type: 'image/png' }))

    game.clearBackgroundImage()

    expect(game.backgroundImage).toBe('')
  })

  it('drops a persisted background value that is not an image data URL', () => {
    localStorage.setItem('screen-counter:bg-image', 'https://example.com/evil.png')

    const game = useGameStore()

    expect(game.backgroundImage).toBe('')
  })

  it('restores a persisted background across sessions', async () => {
    const firstSession = useGameStore()
    await firstSession.setBackgroundImage(
      new File([new Uint8Array([9, 9, 9])], 'bg.png', { type: 'image/png' }),
    )
    await nextTick()

    setActivePinia(createPinia())
    const secondSession = useGameStore()

    expect(secondSession.backgroundImage.startsWith('data:image/png;base64,')).toBe(true)
  })

  it('restores persisted game state from local storage', async () => {
    const firstSessionStore = useGameStore()

    firstSessionStore.addPlayer('Alia')
    firstSessionStore.incrementScore(firstPlayer(firstSessionStore).id)
    firstSessionStore.nextRound()
    await nextTick()

    setActivePinia(createPinia())
    const secondSessionStore = useGameStore()

    expect(secondSessionStore.players.map((player) => player.name)).toEqual(['Alia'])
    expect(secondSessionStore.currentRound).toBe(1)
    expect(secondSessionStore.players[0]?.scores).toEqual([1, 0])
  })
})
