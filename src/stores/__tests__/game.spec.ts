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
    game.endRound()
    game.startGame()

    expect(game.screen).toBe('round')
    expect(game.currentRound).toBe(0)
    expect(game.settledRounds).toBe(0)
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
    game.endRound()
    game.nextRound()

    expect(game.currentRound).toBe(1)
    expect(firstPlayer(game).scores).toEqual([2, 0])
    expect(game.getTotalScore(firstPlayer(game))).toBe(2)
    expect(game.getSettledScore(firstPlayer(game))).toBe(2)
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

  it('hides the round in progress from the settled total', () => {
    const game = useGameStore()

    game.addPlayer('Stilgar')
    game.startGame()
    const id = firstPlayer(game).id

    game.incrementScore(id)
    game.incrementScore(id)
    game.incrementScore(id)

    // The operator sees the running tally; the audience must not.
    expect(game.getTotalScore(firstPlayer(game))).toBe(3)
    expect(game.getSettledScore(firstPlayer(game))).toBe(0)
    expect(game.settledRounds).toBe(0)

    game.endRound()

    expect(game.screen).toBe('reveal')
    expect(game.projectionScreen).toBe('reveal')
    // Settling publishes the round without inventing a new one.
    expect(game.settledRounds).toBe(1)
    expect(game.currentRound).toBe(0)
    expect(game.getSettledScore(firstPlayer(game))).toBe(3)
    expect(game.getRevealScore(firstPlayer(game))).toBe(3)
  })

  it('reads the reveal score off the last settled round, not the current one', () => {
    const game = useGameStore()

    game.addPlayer('Irulan')
    game.startGame()
    const id = firstPlayer(game).id

    game.incrementScore(id)
    game.incrementScore(id)
    game.endRound()
    game.nextRound()

    // A projection window gets `currentRound` and `projectionScreen` as two
    // separate storage events, so the reveal must not read the fresh round.
    expect(game.currentRound).toBe(1)
    expect(game.getCurrentRoundScore(firstPlayer(game))).toBe(0)
    expect(game.getRevealScore(firstPlayer(game))).toBe(2)
  })

  it('reveals a player once and ignores unknown or duplicate ids', () => {
    const game = useGameStore()

    game.addPlayer('Paul')
    game.addPlayer('Chani')
    game.startGame()
    game.endRound()

    const [paul, chani] = game.players

    game.revealPlayer(paul!.id)
    game.revealPlayer(paul!.id)
    game.revealPlayer(9999)

    expect(game.revealedIds).toEqual([paul!.id])
    expect(game.isRevealed(paul!)).toBe(true)
    expect(game.isRevealed(chani!)).toBe(false)
  })

  it('ignores reveals outside the reveal screen', () => {
    const game = useGameStore()

    game.addPlayer('Duncan')
    game.startGame()
    game.revealPlayer(firstPlayer(game).id)

    expect(game.revealedIds).toEqual([])
  })

  it('forgets a removed player on the reveal', () => {
    const game = useGameStore()

    game.addPlayer('Feyd')
    game.startGame()
    game.endRound()

    const id = firstPlayer(game).id
    game.revealPlayer(id)
    game.removePlayer(id)

    expect(game.revealedIds).toEqual([])
  })

  it('mirrors the projection onto round, reveal and total', () => {
    const game = useGameStore()

    expect(game.projectionScreen).toBe('round')

    game.addPlayer('Chani')
    game.startGame()
    expect(game.projectionScreen).toBe('round')

    // Scoring must not move the audience off the frozen scoreboard.
    game.incrementScore(firstPlayer(game).id)
    expect(game.projectionScreen).toBe('round')

    game.endRound()
    expect(game.projectionScreen).toBe('reveal')

    game.nextRound()
    expect(game.projectionScreen).toBe('round')

    game.endGame()
    expect(game.projectionScreen).toBe('total')
  })

  it('advances to a fresh round after the reveal', () => {
    const game = useGameStore()

    game.addPlayer('Duncan')
    game.startGame()
    const id = firstPlayer(game).id

    game.incrementScore(id)
    game.incrementScore(id)
    game.endRound()
    game.revealPlayer(id)

    game.nextRound()

    expect(game.screen).toBe('round')
    expect(game.currentRound).toBe(1)
    // Back to "nothing in progress is public".
    expect(game.settledRounds).toBe(1)
    expect(firstPlayer(game).scores).toEqual([2, 0])
  })

  it('leaves the revealed ids alone between the reveal and the next round', () => {
    const game = useGameStore()

    game.addPlayer('Irulan')
    game.addPlayer('Mohiam')
    game.startGame()
    const [irulan, mohiam] = game.players

    game.incrementScore(irulan!.id)
    game.endRound()
    game.revealPlayer(irulan!.id)
    game.revealPlayer(mohiam!.id)

    // A projection window gets each changed key as its own storage event, so
    // clearing this on the way out of the reveal would empty its scoreboard for
    // one event before `projectionScreen` catches up - every card blinking out
    // and back in. Only `endRound` clears it, right before the board is meant
    // to empty.
    game.nextRound()
    expect(game.revealedIds).toEqual([irulan!.id, mohiam!.id])

    game.endRound()
    expect(game.revealedIds).toEqual([])
  })

  it('ends the game without creating an unplayed round', () => {
    const game = useGameStore()

    game.addPlayer('Feyd')
    game.startGame()
    const id = firstPlayer(game).id

    for (let index = 0; index < 4; index += 1) {
      game.incrementScore(id)
    }

    game.endGame()

    expect(game.screen).toBe('total')
    expect(game.currentRound).toBe(0)
    expect(game.settledRounds).toBe(1)
    expect(game.getSettledScore(firstPlayer(game))).toBe(4)

    // Settling is idempotent, so ending twice - or ending straight from the
    // reveal screen - never settles a second round on top of the first.
    game.endGame()
    expect(game.settledRounds).toBe(1)

    game.backToGame()
    game.endRound()
    game.endGame()
    expect(game.currentRound).toBe(1)
    expect(game.settledRounds).toBe(2)
  })

  it('does not publish an untouched round when the game ends', () => {
    const game = useGameStore()

    game.addPlayer('Shaddam')
    game.startGame()
    const id = firstPlayer(game).id

    game.incrementScore(id)
    game.incrementScore(id)
    game.endRound()
    // The usual way out: reveal, move on, then end the game on the round that
    // nextRound just opened and nobody has scored in.
    game.nextRound()
    game.endGame()

    expect(game.currentRound).toBe(1)
    expect(game.settledRounds).toBe(1)
    expect(firstPlayer(game).scores.slice(0, game.settledRounds)).toEqual([2])
  })

  it('starts a fresh round when going back to the game after ending it', () => {
    const game = useGameStore()

    game.addPlayer('Alia')
    game.startGame()
    game.incrementScore(firstPlayer(game).id)
    game.endGame()

    game.backToGame()

    expect(game.screen).toBe('round')
    expect(game.currentRound).toBe(1)
    expect(firstPlayer(game).scores).toEqual([1, 0])

    // The fresh round is not settled, so returning again stays put.
    game.backToGame()
    expect(game.currentRound).toBe(1)
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

  it('tracks the settled round count and its breakdown grid', () => {
    const game = useGameStore()

    expect(game.roundCount).toBe(1)
    expect([game.roundMajor, game.roundMinor]).toEqual([1, 1])

    game.addPlayer('Feyd')
    game.startGame()
    for (let round = 0; round < 12; round += 1) {
      game.endRound()
      game.nextRound()
    }

    expect(game.settledRounds).toBe(12)
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

  it('returns to the reveal screen after settings', () => {
    const game = useGameStore()
    game.addPlayer('Alia')
    game.startGame()
    game.endRound()

    game.openSettings()
    expect(game.screen).toBe('settings')
    // The audience keeps the reveal it was already watching.
    expect(game.projectionScreen).toBe('reveal')

    game.closeSettings()
    expect(game.screen).toBe('reveal')
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
    firstSessionStore.endRound()
    await nextTick()

    setActivePinia(createPinia())
    const secondSessionStore = useGameStore()

    expect(secondSessionStore.projectionScreen).toBe('reveal')
  })

  it('falls back to the round scoreboard when the persisted projection screen is invalid', () => {
    // useLocalStorage keeps string refs raw, so no JSON.stringify here.
    localStorage.setItem('screen-counter:projection-screen', 'bogus')

    const game = useGameStore()

    expect(game.projectionScreen).toBe('round')
  })

  it('drops revealed ids that no longer match a player', () => {
    localStorage.setItem(
      'screen-counter:players',
      JSON.stringify([{ id: 1, name: 'Alia', scores: [3, 0] }]),
    )
    localStorage.setItem('screen-counter:current-round', '1')
    localStorage.setItem('screen-counter:settled-rounds', '2')
    localStorage.setItem('screen-counter:screen', 'reveal')
    localStorage.setItem('screen-counter:revealed', JSON.stringify([1, 7, 1]))

    const game = useGameStore()

    expect(game.revealedIds).toEqual([1])
    expect(game.screen).toBe('reveal')
  })

  it('clamps a persisted settled round count', () => {
    localStorage.setItem(
      'screen-counter:players',
      JSON.stringify([{ id: 1, name: 'Alia', scores: [3] }]),
    )
    localStorage.setItem('screen-counter:current-round', '0')
    localStorage.setItem('screen-counter:settled-rounds', '9')

    const game = useGameStore()

    expect(game.settledRounds).toBe(1)
  })

  it('leaves the reveal screen when nothing is settled', () => {
    localStorage.setItem(
      'screen-counter:players',
      JSON.stringify([{ id: 1, name: 'Alia', scores: [3] }]),
    )
    localStorage.setItem('screen-counter:screen', 'reveal')
    localStorage.setItem('screen-counter:projection-screen', 'reveal')

    const game = useGameStore()

    expect(game.screen).toBe('round')
    expect(game.projectionScreen).toBe('round')
  })

  it('restores persisted game state from local storage', async () => {
    const firstSessionStore = useGameStore()

    firstSessionStore.addPlayer('Alia')
    firstSessionStore.incrementScore(firstPlayer(firstSessionStore).id)
    firstSessionStore.endRound()
    firstSessionStore.nextRound()
    await nextTick()

    setActivePinia(createPinia())
    const secondSessionStore = useGameStore()

    expect(secondSessionStore.players.map((player) => player.name)).toEqual(['Alia'])
    expect(secondSessionStore.currentRound).toBe(1)
    expect(secondSessionStore.settledRounds).toBe(1)
    expect(secondSessionStore.players[0]?.scores).toEqual([1, 0])
  })
})
