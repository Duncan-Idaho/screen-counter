import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { storageKey } from '@/lib/storageKey'
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

  afterEach(() => {
    vi.restoreAllMocks()
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

    expect(game.roundRevealedIds).toEqual([paul!.id])
    expect(game.revealedIds).toEqual([])
    expect(game.isRoundRevealed(paul!)).toBe(true)
    expect(game.isRoundRevealed(chani!)).toBe(false)
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

    expect(game.roundRevealedIds).toEqual([])
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
    expect(game.roundRevealedIds).toEqual([irulan!.id, mohiam!.id])

    game.endRound()
    expect(game.roundRevealedIds).toEqual([])
  })

  it('empties the board so the end-of-game reveal starts blank', () => {
    const game = useGameStore()

    game.addPlayer('Irulan')
    game.addPlayer('Mohiam')
    game.startGame()
    const [irulan, mohiam] = game.players

    game.incrementScore(irulan!.id)
    game.endRound()
    game.revealPlayer(irulan!.id)
    game.revealPlayer(mohiam!.id)

    // The total screen is the end-of-game reveal, so it opens on nothing at all
    // and the operator fills it back up - exactly as `endRound` does.
    game.endGame()

    expect(game.screen).toBe('total')
    expect(game.revealedIds).toEqual([])
    // The frozen scoreboard keeps its reveal until the screen turns over.
    expect(game.roundRevealedIds).toEqual([irulan!.id, mohiam!.id])
  })

  it('reveals a team on the total screen as well as on the reveal screen', () => {
    const game = useGameStore()

    game.addPlayer('Gurney')
    game.startGame()
    const id = firstPlayer(game).id

    game.incrementScore(id)
    game.endGame()
    game.revealPlayer(id)

    expect(game.revealedIds).toEqual([id])

    // Still nowhere else: back on a round, a click is the operator tallying, not
    // revealing.
    game.backToGame()
    game.revealPlayer(id)
    expect(game.revealedIds).toEqual([id])
  })

  it('publishes the round only once the total screen is up', async () => {
    const game = useGameStore()

    game.addPlayer('Stilgar')
    game.startGame()
    const id = firstPlayer(game).id

    // A game ended from the round after a reveal: all three keys actually
    // change, which is the only way their order is observable.
    game.incrementScore(id)
    game.endRound()
    game.revealPlayer(id)
    game.nextRound()
    game.incrementScore(id)
    // A leftover from an earlier end-of-game reveal, so that the emptying write
    // is a real change.
    game.revealedIds = [id]
    await nextTick()

    const writes = vi.spyOn(Storage.prototype, 'setItem')
    game.endGame()
    // useLocalStorage flushes on the pre-tick, so the writes land together.
    await nextTick()

    // The order is load-bearing across windows, where each key arrives as its
    // own storage event: empty the list before switching screens (or the total
    // view mounts with a team already revealed), and publish the round last
    // (the total view reads it, so it must land once that view is up and empty).
    expect(
      writes.mock.calls
        .map(([key]) => key)
        .filter((key) =>
          ['screen-counter:revealed', 'screen-counter:screen', 'screen-counter:settled-rounds'].includes(
            key,
          ),
        ),
    ).toEqual([
      'screen-counter:revealed',
      'screen-counter:screen',
      'screen-counter:settled-rounds',
    ])
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

  // The breakdown grid is TotalGrid's to size now: it has to count the optional
  // penalty chip, which the store deliberately knows nothing about. See
  // lib/__tests__/grid.spec.ts and components/__tests__/TotalGrid.spec.ts.
  it('tracks the settled round count', () => {
    const game = useGameStore()

    expect(game.settledRounds).toBe(0)

    game.addPlayer('Feyd')
    game.startGame()
    for (let round = 0; round < 12; round += 1) {
      game.endRound()
      game.nextRound()
    }

    expect(game.settledRounds).toBe(12)
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
    localStorage.setItem('screen-counter:round-revealed', JSON.stringify([1, 7, 1]))

    const game = useGameStore()

    expect(game.revealedIds).toEqual([1])
    expect(game.roundRevealedIds).toEqual([1])
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

  // --- Round themes: the store's one per-round, non-player state -------------

  it('pads round themes alongside scores as rounds are created', () => {
    const game = useGameStore()

    game.addPlayer('Duncan')
    game.startGame()
    game.setRoundTheme(0, 'Ballads')
    game.endRound()
    game.nextRound()

    expect(game.roundThemes).toEqual(['Ballads', ''])
  })

  it('sets a theme for the current round without disturbing other rounds', () => {
    const game = useGameStore()

    game.addPlayer('Duncan')
    game.startGame()
    game.setRoundTheme(0, 'Ballads')
    game.endRound()
    game.nextRound()
    game.setRoundTheme(1, 'Rock')

    expect(game.roundThemes).toEqual(['Ballads', 'Rock'])
    expect(game.currentRoundTheme).toBe('Rock')
  })

  it('only exposes settled round themes to the total screen', () => {
    const game = useGameStore()

    game.addPlayer('Duncan')
    game.startGame()
    game.setRoundTheme(0, 'Ballads')
    game.endRound()
    game.nextRound()
    // The round now in progress has a theme too, but it must not leak to the
    // audience-facing total screen before it is settled.
    game.setRoundTheme(1, 'Rock')

    expect(game.settledRoundThemes).toEqual(['Ballads'])
  })

  it('resets round themes when starting a new game', () => {
    const game = useGameStore()

    game.addPlayer('Duncan')
    game.startGame()
    game.setRoundTheme(0, 'Ballads')
    game.endRound()
    game.startGame()

    expect(game.roundThemes).toEqual([''])
    expect(game.currentRoundTheme).toBe('')
  })

  it('clears round themes when there are no players', () => {
    localStorage.setItem('screen-counter:round-themes', JSON.stringify(['Ballads']))

    const game = useGameStore()

    expect(game.roundThemes).toEqual([])
  })

  it('repairs a corrupt persisted round themes value', () => {
    localStorage.setItem(
      'screen-counter:players',
      JSON.stringify([{ id: 1, name: 'Alia', scores: [3, 0] }]),
    )
    localStorage.setItem('screen-counter:current-round', '1')
    localStorage.setItem('screen-counter:round-themes', JSON.stringify('bogus'))

    const game = useGameStore()

    expect(game.roundThemes).toEqual(['', ''])
  })

  it('coerces non-string entries in a persisted round themes array', () => {
    localStorage.setItem(
      'screen-counter:players',
      JSON.stringify([{ id: 1, name: 'Alia', scores: [3] }]),
    )
    localStorage.setItem('screen-counter:round-themes', JSON.stringify([42, null, 'Rock']))

    const game = useGameStore()

    expect(game.roundThemes).toEqual(['42', '', 'Rock'])
  })

  // --- Penalties: a whole-game counter, applied only at the end ---------------

  it('adds and removes penalties within the same bounds as scores', () => {
    const game = useGameStore()
    game.addPlayer('Gurney')
    const id = firstPlayer(game).id

    for (let index = 0; index < 120; index += 1) game.incrementPenalty(id)
    expect(firstPlayer(game).penalties).toBe(99)

    for (let index = 0; index < 130; index += 1) game.decrementPenalty(id)
    expect(firstPlayer(game).penalties).toBe(0)
  })

  it('keeps penalties out of the round score and the round indices', () => {
    const game = useGameStore()
    game.addPlayer('Chani')
    game.startGame()
    const id = firstPlayer(game).id

    game.incrementPenalty(id)
    game.incrementPenalty(id)

    expect(firstPlayer(game).scores).toEqual([0])
    expect(game.currentRound).toBe(0)
    expect(game.settledRounds).toBe(0)
  })

  it('holds the settled-rounds invariant across penalty changes', () => {
    const game = useGameStore()
    game.addPlayer('Duncan')
    game.startGame()
    const id = firstPlayer(game).id

    const withinInvariant = () =>
      game.settledRounds === game.currentRound || game.settledRounds === game.currentRound + 1

    game.incrementPenalty(id)
    expect(withinInvariant()).toBe(true)

    game.incrementScore(id)
    game.endRound()
    game.incrementPenalty(id)
    expect(withinInvariant()).toBe(true)

    game.nextRound()
    game.decrementPenalty(id)
    expect(withinInvariant()).toBe(true)
  })

  it('hides penalties from the operator total and the settled total', () => {
    const game = useGameStore()
    game.addPlayer('Jessica')
    game.startGame()
    const id = firstPlayer(game).id

    for (let index = 0; index < 5; index += 1) game.incrementScore(id)
    game.incrementPenalty(id)
    game.incrementPenalty(id)

    // Mid-round: the operator sees their running tally, the audience sees nothing.
    expect(game.getTotalScore(firstPlayer(game))).toBe(5)
    expect(game.getSettledScore(firstPlayer(game))).toBe(0)

    game.endRound()

    // Settled, but still gross - the deduction waits for the total screen.
    expect(game.getTotalScore(firstPlayer(game))).toBe(5)
    expect(game.getSettledScore(firstPlayer(game))).toBe(5)
    expect(game.getRevealScore(firstPlayer(game))).toBe(5)
  })

  it('subtracts penalties in the final score only', () => {
    const game = useGameStore()
    game.addPlayer('Leto')
    game.startGame()
    const id = firstPlayer(game).id

    for (let index = 0; index < 5; index += 1) game.incrementScore(id)
    game.incrementPenalty(id)
    game.incrementPenalty(id)
    game.endRound()

    expect(game.getFinalScore(firstPlayer(game))).toBe(3)
    expect(game.getPenalty(firstPlayer(game))).toBe(2)
    expect(game.getSettledScore(firstPlayer(game))).toBe(5)
  })

  it('lets the final score go negative when penalties outrun the points', () => {
    const game = useGameStore()
    game.addPlayer('Harkonnen')
    game.startGame()
    const id = firstPlayer(game).id

    game.incrementScore(id)
    game.incrementScore(id)
    for (let index = 0; index < 5; index += 1) game.incrementPenalty(id)
    game.endRound()

    expect(game.getFinalScore(firstPlayer(game))).toBe(-3)
  })

  it('clears penalties when a new game starts', () => {
    const game = useGameStore()
    game.addPlayer('Irulan')
    const id = firstPlayer(game).id

    game.incrementPenalty(id)
    game.incrementPenalty(id)
    game.startGame()

    expect(firstPlayer(game).penalties).toBe(0)
  })

  it('keeps penalties when the game is resumed', () => {
    const game = useGameStore()
    game.addPlayer('Thufir')
    game.startGame()
    const id = firstPlayer(game).id

    game.incrementScore(id)
    game.incrementPenalty(id)
    game.incrementPenalty(id)
    game.endRound()
    game.goToSetup()
    game.resumeGame()

    expect(firstPlayer(game).penalties).toBe(2)
    expect(firstPlayer(game).scores[0]).toBe(1)
  })

  it('ignores a penalty change for an unknown player id', () => {
    const game = useGameStore()
    game.addPlayer('Shaddam')

    game.incrementPenalty(999)

    expect(firstPlayer(game).penalties).toBe(0)
  })

  it('drops a removed player penalties along with the player', () => {
    const game = useGameStore()
    game.addPlayer('Rabban')
    const id = firstPlayer(game).id
    game.incrementPenalty(id)

    game.removePlayer(id)

    expect(game.players).toEqual([])
  })

  it('defaults a persisted player with no penalties field to zero', () => {
    // The shape persisted by every version before penalties existed.
    localStorage.setItem(
      'screen-counter:players',
      JSON.stringify([{ id: 1, name: 'Alia', scores: [3, 2] }]),
    )

    const game = useGameStore()

    expect(firstPlayer(game).penalties).toBe(0)
    expect(firstPlayer(game).scores).toEqual([3, 2])
  })

  it('clamps a non-numeric or out-of-range persisted penalty', () => {
    localStorage.setItem(
      'screen-counter:players',
      JSON.stringify([
        { id: 1, name: 'Bad', scores: [0], penalties: 'x' },
        { id: 2, name: 'Low', scores: [0], penalties: -4 },
        { id: 3, name: 'High', scores: [0], penalties: 500 },
        { id: 4, name: 'Fractional', scores: [0], penalties: 2.7 },
      ]),
    )

    const game = useGameStore()

    expect(game.players.map((player) => player.penalties)).toEqual([0, 0, 99, 2])
  })

  it('restores persisted penalties across sessions', async () => {
    const firstSessionStore = useGameStore()
    firstSessionStore.addPlayer('Alia')
    firstSessionStore.incrementPenalty(firstPlayer(firstSessionStore).id)
    firstSessionStore.incrementPenalty(firstPlayer(firstSessionStore).id)
    await nextTick()

    setActivePinia(createPinia())
    const secondSessionStore = useGameStore()

    expect(firstPlayer(secondSessionStore).penalties).toBe(2)
  })
})

describe('persistent round reveal', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Three teams, round 1 played (3, 1, 0) and settled, round 2 tallied (2, 5, 0).
  function playedGame() {
    const game = useGameStore()

    for (const name of ['Alia', 'Bene', 'Chani']) game.addPlayer(name)
    game.startGame()
    const [a, b] = game.players

    for (let i = 0; i < 3; i++) game.incrementScore(a!.id)
    game.incrementScore(b!.id)
    game.endRound()
    game.nextRound()
    for (let i = 0; i < 2; i++) game.incrementScore(a!.id)
    for (let i = 0; i < 5; i++) game.incrementScore(b!.id)

    return game
  }

  it('writes the round list on reveal and the final list on total, never the other', () => {
    const game = playedGame()
    const [a, b] = game.players

    game.endRound()
    game.revealPlayer(a!.id)
    expect(game.roundRevealedIds).toEqual([a!.id])
    expect(game.revealedIds).toEqual([])

    game.endGame()
    game.revealPlayer(b!.id)
    expect(game.revealedIds).toEqual([b!.id])
    expect(game.roundRevealedIds).toEqual([a!.id])
  })

  it('writes round-revealed, then screen, then settled-rounds on endRound', async () => {
    const game = playedGame()
    const [a] = game.players

    game.endRound()
    game.revealPlayer(a!.id)
    game.nextRound()
    game.incrementScore(a!.id)
    await nextTick()

    const writes = vi.spyOn(Storage.prototype, 'setItem')

    game.endRound()
    await nextTick()

    const keys = writes.mock.calls.map(([key]) => key)

    expect(keys).toContain(storageKey('round-revealed'))
    expect(keys.indexOf(storageKey('round-revealed'))).toBeLessThan(
      keys.indexOf(storageKey('screen')),
    )
    expect(keys.indexOf(storageKey('screen'))).toBeLessThan(
      keys.indexOf(storageKey('settled-rounds')),
    )
  })

  it('reads the score before the round, whatever the tally or the penalties', () => {
    const game = playedGame()
    const [a, b, c] = game.players

    expect(game.getScoreBeforeRound(a!)).toBe(3)
    expect(game.getScoreBeforeRound(b!)).toBe(1)

    game.incrementPenalty(a!.id)
    expect(game.getScoreBeforeRound(a!)).toBe(3)
    expect(game.getScoreboardScore(a!)).toBe(3)
    expect(game.getScoreboardScore(c!)).toBe(0)
  })

  it('ignores a stale list outside the reveal', () => {
    const game = playedGame()
    const [a] = game.players

    game.endRound()
    game.revealPlayer(a!.id)
    expect(game.getScoreboardScore(a!)).toBe(5)

    game.nextRound()
    expect(game.isRevealedOnScoreboard(a!)).toBe(false)
    // Still the settled total, because currentRound moved on with it.
    expect(game.getScoreboardScore(a!)).toBe(5)
  })

  it('shows the score before the round for unrevealed teams during the reveal', () => {
    const game = playedGame()
    const [a, b] = game.players

    game.endRound()
    expect(game.getScoreboardScore(a!)).toBe(3)
    expect(game.getScoreboardScore(b!)).toBe(1)

    game.revealPlayer(b!.id)
    expect(game.getScoreboardScore(b!)).toBe(6)
    expect(game.getScoreboardScore(a!)).toBe(3)
  })

  it('persists the round list and sanitizes it', async () => {
    const game = playedGame()
    const [a] = game.players

    game.endRound()
    game.revealPlayer(a!.id)
    await nextTick()
    setActivePinia(createPinia())
    expect(useGameStore().roundRevealedIds).toEqual([a!.id])

    localStorage.setItem(storageKey('round-revealed'), JSON.stringify([a!.id, 99, a!.id]))
    setActivePinia(createPinia())
    expect(useGameStore().roundRevealedIds).toEqual([a!.id])

    localStorage.setItem(storageKey('round-revealed'), '"junk"')
    setActivePinia(createPinia())
    expect(useGameStore().roundRevealedIds).toEqual([])
  })

  it('clears the round list on a new game and on an empty roster', () => {
    const game = playedGame()
    const [a] = game.players

    game.endRound()
    game.revealPlayer(a!.id)
    game.startGame()
    expect(game.roundRevealedIds).toEqual([])

    localStorage.setItem(storageKey('players'), '[]')
    localStorage.setItem(storageKey('round-revealed'), '[1]')
    setActivePinia(createPinia())
    expect(useGameStore().roundRevealedIds).toEqual([])
  })

  describe('the final view', () => {
    type Game = ReturnType<typeof useGameStore>

    // Three rounds of Alia 2/3/4 and Bene 1/1/1. `closeLast` ends the last round
    // (reveal screen), otherwise it is left open with its points tallied.
    function playThree(game: Game, closeLast: boolean) {
      game.addPlayer('Alia')
      game.addPlayer('Bene')
      game.startGame()
      const [a, b] = game.players.map((player) => player.id)

      for (const [x, y] of [
        [2, 1],
        [3, 1],
      ] as const) {
        for (let n = 0; n < x; n += 1) game.incrementScore(a!)
        for (let n = 0; n < y; n += 1) game.incrementScore(b!)
        game.endRound()
        game.revealPlayer(a!)
        game.revealPlayer(b!)
        game.nextRound()
      }

      for (let n = 0; n < 4; n += 1) game.incrementScore(a!)
      game.incrementScore(b!)
      if (closeLast) game.endRound()

      return { a: a!, b: b! }
    }

    const alia = (game: Game) => game.players[0]!
    const bene = (game: Game) => game.players[1]!

    it('A: ending from the round leaves every tile on its pre-round score, gain at the click', () => {
      const game = useGameStore()
      playThree(game, false)
      game.endGame()

      expect([game.getFinalStartScore(alia(game)), game.getFinalGain(alia(game))]).toEqual([5, 4])
      expect([game.getFinalStartScore(bene(game)), game.getFinalGain(bene(game))]).toEqual([2, 1])
    })

    it('A: start + gain is the same before and after settledRounds is written', () => {
      const game = useGameStore()
      playThree(game, false)
      const sum = () => game.players.map((p) => game.getFinalStartScore(p) + game.getFinalGain(p))
      const during = sum()

      game.endGame()

      expect(game.settledRounds).toBe(3)
      expect(sum()).toEqual(during)
      expect(sum()).toEqual(game.players.map((p) => game.getSettledScore(p)))
    })

    it('A: a stale round list does not make the last round look already received', () => {
      const game = useGameStore()
      const { a } = playThree(game, false)

      // Left behind by the round-2 reveal.
      expect(game.roundRevealedIds).toContain(a)
      game.endGame()

      expect(game.roundRevealedIds).toEqual([])
      expect(game.getFinalGain(alia(game))).toBe(4)
    })

    it('B: ending right after nextRound replays no round', () => {
      const game = useGameStore()
      game.addPlayer('Alia')
      game.startGame()
      game.incrementScore(alia(game).id)
      game.endRound()
      game.revealPlayer(alia(game).id)
      game.nextRound()
      game.endGame()

      expect(game.settledRounds).toBe(1)
      expect(game.getFinalStartScore(alia(game))).toBe(1)
      expect(game.getFinalGain(alia(game))).toBe(0)
    })

    it('C: ending from the reveal keeps the list and does not give the gain twice', () => {
      const game = useGameStore()
      const { a } = playThree(game, true)
      game.revealPlayer(a)
      game.endGame()

      expect(game.roundRevealedIds).toEqual([a])
      // Revealed at the round reveal: keeps +4, nothing more to give.
      expect([game.getFinalStartScore(alia(game)), game.getFinalGain(alia(game))]).toEqual([9, 0])
      // Not revealed yet: still to come.
      expect([game.getFinalStartScore(bene(game)), game.getFinalGain(bene(game))]).toEqual([2, 1])
    })

    it('writes the lists before the screen, and the round last', async () => {
      const game = useGameStore()
      const { a } = playThree(game, false)
      game.revealedIds = [a]
      game.detailIds = [a]
      await nextTick()

      const writes = vi.spyOn(Storage.prototype, 'setItem')
      game.endGame()
      await nextTick()

      const keys = ['round-revealed', 'detail', 'revealed', 'screen', 'settled-rounds'].map(
        storageKey,
      )

      expect(writes.mock.calls.map(([key]) => key).filter((key) => keys.includes(key))).toEqual(
        keys,
      )
    })

    it('toggles one detail at a time, only for a revealed team on the total screen', () => {
      const game = useGameStore()
      const { a, b } = playThree(game, false)

      game.toggleDetail(a)
      expect(game.detailIds).toEqual([])

      game.endGame()
      game.toggleDetail(a)
      expect(game.detailIds).toEqual([])

      game.revealPlayer(a)
      game.revealPlayer(b)
      game.toggleDetail(a)
      game.toggleDetail(b)
      expect(game.detailIds).toEqual([a, b])
      expect(game.isDetailOpen(alia(game))).toBe(true)

      game.toggleDetail(a)
      expect(game.detailIds).toEqual([b])

      game.toggleDetail(999)
      expect(game.detailIds).toEqual([b])
    })

    it('empties the details on endGame, startGame and resumeGame', () => {
      const game = useGameStore()
      const { a } = playThree(game, false)

      for (const leave of [() => game.endGame(), () => game.startGame(), () => game.resumeGame()]) {
        game.endGame()
        game.revealPlayer(a)
        game.toggleDetail(a)
        expect(game.detailIds).toEqual([a])
        leave()
        expect(game.detailIds).toEqual([])
      }
    })

    it('drops a removed team from the details', () => {
      const game = useGameStore()
      const { a } = playThree(game, false)
      game.endGame()
      game.revealPlayer(a)
      game.toggleDetail(a)
      game.removePlayer(a)

      expect(game.detailIds).toEqual([])
    })

    it('repairs the persisted details on load', async () => {
      const game = useGameStore()
      const { a, b } = playThree(game, false)
      game.endGame()
      game.revealPlayer(a)
      game.toggleDetail(a)
      await nextTick()

      setActivePinia(createPinia())
      expect(useGameStore().detailIds).toEqual([a])

      // Unknown id, duplicate, and an id that is not revealed.
      localStorage.setItem(storageKey('detail'), JSON.stringify([a, 99, a, b]))
      setActivePinia(createPinia())
      expect(useGameStore().detailIds).toEqual([a])

      localStorage.setItem(storageKey('detail'), '"junk"')
      setActivePinia(createPinia())
      expect(useGameStore().detailIds).toEqual([])
    })

    it('empties the details when there are no players', () => {
      localStorage.setItem(storageKey('detail'), '[1]')
      setActivePinia(createPinia())

      expect(useGameStore().detailIds).toEqual([])
    })
  })
})
