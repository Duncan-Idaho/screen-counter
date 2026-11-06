import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { i18n } from '@/i18n'
import { useGameStore } from '@/stores/game'
import ProjectionScreen from '../ProjectionScreen.vue'

// Replays, one `storage` event at a time, what a projection window sees while the
// control window runs an action. Within one window Vue batches the writes, so the
// intermediate combinations only exist across windows; this harness recreates
// them: record the events, then feed them to an independent app instance with a
// render between each.

type Game = ReturnType<typeof useGameStore>

interface Tile {
  name: string
  number: string
  glow: boolean
  chip: boolean
  confetti: boolean
}

interface Frame {
  view: 'scoreboard' | 'total'
  tiles: Tile[]
  cards: number
}

function snapshot(wrapper: ReturnType<typeof mount>): Frame {
  const total = wrapper.find('.total-panel').exists()
  const nodes = wrapper.findAll(total ? '.total-panel article' : '.scoreboard-grid article')

  // Scoreboard tiles stay in roster order in the DOM; the rank is their CSS order.
  if (!total) nodes.sort((a, b) => Number((a.element as HTMLElement).style.order) - Number((b.element as HTMLElement).style.order))
  const tiles = nodes.map((node) => ({
    name: node.get('h3').text(),
    number: node.get('.score-roll').attributes('aria-label') ?? '',
    glow: node.classes().includes('score-card--glow'),
    chip: node.find('.gain-chip').exists(),
    confetti: node.find('.confetti-burst').exists(),
  }))

  return { view: total ? 'total' : 'scoreboard', tiles, cards: tiles.length }
}

function id(game: Game, name: string) {
  return game.players.find((player) => player.name === name)!.id
}

function points(game: Game, name: string, n: number) {
  for (let i = 0; i < n; i += 1) game.incrementScore(id(game, name))
}

// Round 1: Alia 3, Bene 1, Chani 0 - settled and fully revealed. Round 2 open.
function sceneRoundTwo(game: Game) {
  for (const name of ['Alia', 'Bene', 'Chani']) game.addPlayer(name)
  game.startGame()
  points(game, 'Alia', 3)
  points(game, 'Bene', 1)
  game.endRound()
  for (const player of game.players) game.revealPlayer(player.id)
  game.nextRound()
}

async function replay(scene: (game: Game) => void, action: (game: Game) => void) {
  localStorage.clear()
  setActivePinia(createPinia())
  const game = useGameStore()

  scene(game)
  await nextTick()

  const photo = Object.fromEntries(
    Array.from({ length: localStorage.length }, (_, index) => {
      const key = localStorage.key(index)!

      return [key, localStorage.getItem(key)!]
    }),
  )

  const events: { key: string; newValue: string | null }[] = []
  const listener = (event: Event) => {
    const { key, newValue } = event as StorageEvent

    events.push({ key: key!, newValue })
  }

  window.addEventListener('storage', listener)
  action(game)
  await nextTick()
  window.removeEventListener('storage', listener)

  // Cut the control store off, and put localStorage back as the projection
  // window would have found it.
  game.$dispose()
  localStorage.clear()
  for (const [key, value] of Object.entries(photo)) localStorage.setItem(key, value)

  setActivePinia(createPinia())
  const wrapper = mount(ProjectionScreen, { global: { plugins: [i18n] } })

  await nextTick()

  const frames = [snapshot(wrapper)]

  for (const { key, newValue } of events) {
    if (newValue === null) localStorage.removeItem(key)
    else localStorage.setItem(key, newValue)

    window.dispatchEvent(
      new StorageEvent('storage', { key, newValue, storageArea: localStorage }),
    )
    await nextTick()
    // The scoreboard roll's destination lags one animation frame (ScoreboardCard).
    await new Promise((resolve) => setTimeout(resolve, 40))
    frames.push(snapshot(wrapper))
  }

  wrapper.unmount()

  return { frames, keys: events.map((event) => event.key) }
}

function last<T>(items: T[]) {
  return items[items.length - 1]
}

function numbers(frame: Frame) {
  return frame.tiles.map((tile) => `${tile.name}:${tile.number}`)
}

describe('projection window, storage events replayed in order', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('does not change at all while the round closes', async () => {
    const { frames, keys } = await replay(
      (game) => {
        sceneRoundTwo(game)
        points(game, 'Alia', 2)
        points(game, 'Bene', 5)
      },
      (game) => game.endRound(),
    )

    expect(keys).toEqual(
      expect.arrayContaining([
        'screen-counter:round-revealed',
        'screen-counter:screen',
        'screen-counter:projection-screen',
        'screen-counter:settled-rounds',
      ]),
    )
    expect(numbers(frames[0]!)).toEqual(['Alia:3', 'Bene:1', 'Chani:0'])
    for (const frame of frames) expect(frame).toEqual(frames[0])
  })

  it('stays silent when the previous round left a stale list behind', async () => {
    const { frames, keys } = await replay(
      (game) => {
        sceneRoundTwo(game)
        points(game, 'Alia', 2)
        points(game, 'Bene', 5)
        game.endRound()
        game.revealPlayer(id(game, 'Bene'))
        game.nextRound()
        points(game, 'Alia', 1)
      },
      (game) => game.endRound(),
    )

    expect(keys[0]).toBe('screen-counter:round-revealed')
    for (const frame of frames) {
      for (const tile of frame.tiles) {
        expect(tile.chip).toBe(false)
        expect(tile.confetti).toBe(false)
        expect(tile.glow).toBe(false)
      }
    }
  })

  it('moves on to the next round without moving a number, dropping the glow last', async () => {
    const { frames, keys } = await replay(
      (game) => {
        sceneRoundTwo(game)
        points(game, 'Alia', 2)
        points(game, 'Bene', 5)
        game.endRound()
        for (const player of game.players) game.revealPlayer(player.id)
      },
      (game) => game.nextRound(),
    )

    expect(keys).toEqual(
      expect.arrayContaining(['screen-counter:current-round', 'screen-counter:projection-screen']),
    )
    expect(numbers(frames[0]!)).toEqual(['Bene:6', 'Alia:5', 'Chani:0'])
    for (const frame of frames) {
      expect(numbers(frame)).toEqual(numbers(frames[0]!))
      expect(frame.tiles.every((tile) => !tile.chip && !tile.confetti)).toBe(true)
    }
    // The projection window's own store mirrors `screen` into `projectionScreen`,
    // so the glow goes out with the `screen` event (frame index + 1: frame 0 is
    // the initial mount), never earlier.
    const turn = keys.indexOf('screen-counter:screen') + 1

    for (const frame of frames.slice(0, turn)) {
      expect(frame.tiles.every((tile) => tile.glow)).toBe(true)
    }
    for (const frame of frames.slice(turn)) {
      expect(frame.tiles.every((tile) => !tile.glow)).toBe(true)
    }
  })

  it('only ever shows a skipped team its old or its new total', async () => {
    const { frames } = await replay(
      (game) => {
        sceneRoundTwo(game)
        points(game, 'Alia', 2)
        points(game, 'Bene', 5)
        game.endRound()
        game.revealPlayer(id(game, 'Alia'))
      },
      (game) => game.nextRound(),
    )

    const seen = (name: string) => frames.map((f) => f.tiles.find((t) => t.name === name)!.number)

    expect(new Set(seen('Bene'))).toEqual(new Set(['1', '6']))
    expect(new Set(seen('Alia'))).toEqual(new Set(['5']))
    expect(seen('Bene')[0]).toBe('1')
    expect(last(seen('Bene'))).toBe('6')
  })

  it('never shows the private tally when the game ends from the round', async () => {
    const { frames, keys } = await replay(
      (game) => {
        sceneRoundTwo(game)
        points(game, 'Bene', 7)
      },
      (game) => game.endGame(),
    )

    expect(keys).toContain('screen-counter:projection-screen')
    const scoreboards = frames.filter((frame) => frame.view === 'scoreboard')

    expect(scoreboards.length).toBeGreaterThan(0)
    for (const frame of scoreboards) expect(numbers(frame)).toEqual(['Alia:3', 'Bene:1', 'Chani:0'])
    expect(last(frames)).toMatchObject({ view: 'total', cards: 3 })
  })

  it('keeps a partial reveal frozen until the total screen takes over', async () => {
    const { frames } = await replay(
      (game) => {
        sceneRoundTwo(game)
        points(game, 'Alia', 2)
        points(game, 'Bene', 5)
        game.endRound()
        game.revealPlayer(id(game, 'Bene'))
      },
      (game) => game.endGame(),
    )

    const scoreboards = frames.filter((frame) => frame.view === 'scoreboard')

    expect(numbers(scoreboards[0]!)).toEqual(['Bene:6', 'Alia:3', 'Chani:0'])
    for (const frame of scoreboards) expect(frame).toEqual(scoreboards[0])
    expect(last(frames)).toMatchObject({ view: 'total', cards: 3 })
  })

  it('leaves the scoreboard untouched while the operator tallies', async () => {
    const { frames, keys } = await replay(
      (game) => sceneRoundTwo(game),
      (game) => {
        points(game, 'Bene', 4)
        points(game, 'Alia', 1)
      },
    )

    expect(keys.every((key) => key === 'screen-counter:players')).toBe(true)
    expect(keys.length).toBeGreaterThan(0)
    for (const frame of frames) expect(frame).toEqual(frames[0])
  })

  it('animates exactly the tile whose id arrives, and only then', async () => {
    const { frames, keys } = await replay(
      (game) => {
        sceneRoundTwo(game)
        points(game, 'Bene', 5)
        game.endRound()
      },
      (game) => game.revealPlayer(id(game, 'Bene')),
    )

    expect(keys).toEqual(['screen-counter:round-revealed'])
    expect(frames[0]!.tiles.some((tile) => tile.chip || tile.glow)).toBe(false)
    const final = last(frames)!

    expect(final.tiles[0]).toMatchObject({ name: 'Bene', number: '6', glow: true, chip: true })
  })

  // The final view: the same numbers, in the same order, in every frame from the
  // scoreboard to the full total view.
  function expectNoMovement(frames: Frame[], expected: string[]) {
    for (const frame of frames) {
      expect(numbers(frame)).toEqual(expected)
      expect(frame.tiles.every((tile) => !tile.chip && !tile.confetti)).toBe(true)
    }
    expect(last(frames)!.view).toBe('total')
  }

  it('A: ends the game from the round without any number moving', async () => {
    const { frames, keys } = await replay(
      (game) => {
        sceneRoundTwo(game)
        points(game, 'Alia', 2)
        points(game, 'Bene', 7)
      },
      (game) => game.endGame(),
    )

    expect(keys.indexOf('screen-counter:settled-rounds')).toBeGreaterThan(
      keys.indexOf('screen-counter:screen'),
    )
    // Bene's 7 is private until the click: it never appears.
    expectNoMovement(frames, ['Alia:3', 'Bene:1', 'Chani:0'])
    expect(frames.some((frame) => frame.tiles.some((tile) => tile.glow))).toBe(false)
  })

  it('A: a stale list from an earlier reveal leaks no gain of the last round', async () => {
    const { frames } = await replay(
      (game) => {
        sceneRoundTwo(game)
        points(game, 'Alia', 2)
        game.endRound()
        game.revealPlayer(id(game, 'Alia'))
        game.nextRound()
        points(game, 'Alia', 1)
        points(game, 'Bene', 4)
      },
      (game) => game.endGame(),
    )

    expectNoMovement(frames, ['Alia:5', 'Bene:1', 'Chani:0'])
    expect(last(frames)!.tiles.some((tile) => tile.glow)).toBe(false)
  })

  it('C: ends the game from a partial reveal with the same numbers and order', async () => {
    const { frames, keys } = await replay(
      (game) => {
        sceneRoundTwo(game)
        points(game, 'Alia', 2)
        points(game, 'Bene', 5)
        game.endRound()
        game.revealPlayer(id(game, 'Bene'))
      },
      (game) => game.endGame(),
    )

    expect(keys).not.toContain('screen-counter:settled-rounds')
    expectNoMovement(frames, ['Bene:6', 'Alia:3', 'Chani:0'])
  })

  it('B: ends the game right after nextRound without any number moving', async () => {
    const { frames, keys } = await replay(
      (game) => {
        sceneRoundTwo(game)
      },
      (game) => game.endGame(),
    )

    expect(keys).not.toContain('screen-counter:settled-rounds')
    expectNoMovement(frames, ['Alia:3', 'Bene:1', 'Chani:0'])
  })

  it('sends one event for a click and one for a detail toggle', async () => {
    const reveal = await replay(
      (game) => {
        sceneRoundTwo(game)
        points(game, 'Bene', 5)
        game.endGame()
      },
      (game) => game.revealPlayer(id(game, 'Bene')),
    )

    expect(reveal.keys).toEqual(['screen-counter:revealed'])
    // The tile keeps its rank until its clock settles; only its number moves.
    expect(last(reveal.frames)!.tiles.find((tile) => tile.name === 'Bene')).toMatchObject({
      number: '6',
      chip: true,
      glow: true,
    })

    const detail = await replay(
      (game) => {
        sceneRoundTwo(game)
        points(game, 'Bene', 5)
        game.endGame()
        game.revealPlayer(id(game, 'Bene'))
      },
      (game) => game.toggleDetail(id(game, 'Bene')),
    )

    expect(detail.keys).toEqual(['screen-counter:detail'])
  })

  it('leaving the final view shows each tile only its old or its new number', async () => {
    const { frames } = await replay(
      (game) => {
        sceneRoundTwo(game)
        points(game, 'Alia', 2)
        points(game, 'Bene', 5)
        game.endGame()
        game.revealPlayer(id(game, 'Bene'))
      },
      (game) => game.backToGame(),
    )

    const seen = (name: string) =>
      new Set(frames.map((frame) => frame.tiles.find((tile) => tile.name === name)!.number))

    // Bene was revealed: 6 throughout. Alia was not: 3 before, 5 once the
    // scoreboard (a skipped team, the round is over) takes over.
    expect(seen('Bene')).toEqual(new Set(['6']))
    expect(seen('Alia')).toEqual(new Set(['3', '5']))
  })
})
