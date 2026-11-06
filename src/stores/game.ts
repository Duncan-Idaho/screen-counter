import { computed, watch } from 'vue'
import { defineStore } from 'pinia'
import { useLocalStorage } from '@vueuse/core'
import { splitGrid } from '@/lib/grid'
import { storageKey } from '@/lib/storageKey'

export type ScreenName = 'setup' | 'round' | 'reveal' | 'total' | 'settings'

// Screens the settings screen can return to; `settings` itself is excluded so a
// round-trip can never land back on it.
export type ReturnScreenName = Exclude<ScreenName, 'settings'>

export interface Player {
  id: number
  name: string
  scores: number[]
  // Per-game, per-player, NOT per-round: penalties are collected across the
  // whole game and applied once, at the end (see getFinalScore). `adjustPenalty`
  // deliberately never calls `ensureRound` and never touches `scores`,
  // `currentRound` or `settledRounds`.
  penalties: number
}

const MIN_SCORE = 0
const MAX_SCORE = 99
// The same bounds as a score, stated separately: the coincidence is not a coupling.
const MIN_PENALTY = 0
const MAX_PENALTY = 99

export const useGameStore = defineStore('game', () => {
  const players = useLocalStorage<Player[]>(storageKey('players'), [])
  // The round the operator is scoring right now. Its points are edited straight
  // into `scores[currentRound]` and stay private until `endRound` settles them.
  const currentRound = useLocalStorage(storageKey('current-round'), 0)
  // How many rounds have been made public. Equals `currentRound` while a round
  // is being scored - the tally in progress must never leak to the audience -
  // and `currentRound + 1` once `endRound`/`endGame` has settled it. Kept
  // orthogonal to `currentRound` on purpose: settling a round must not invent a
  // new, unplayed one.
  const settledRounds = useLocalStorage(storageKey('settled-rounds'), 0)
  // Ids already revealed on the end-of-game total screen, in click order. The
  // projection's total view renders exactly these. Round reveals use
  // `roundRevealedIds` instead.
  const revealedIds = useLocalStorage<number[]>(storageKey('revealed'), [])
  // Ids already revealed on the round reveal screen, in click order. A separate
  // key from `revealedIds` because `endGame` must empty `revealedIds` before the
  // screen turns over (or the total view mounts full), and from a reveal that
  // write would drop the revealed tiles back to their pre-round total for one
  // storage event on the frozen scoreboard. Two lists, no ambiguity.
  const roundRevealedIds = useLocalStorage<number[]>(storageKey('round-revealed'), [])
  // One entry per round, index-aligned with every player's `scores` array (see
  // `ensureRound`). The store's only per-round state that isn't per-player.
  const roundThemes = useLocalStorage<string[]>(storageKey('round-themes'), [])
  const screen = useLocalStorage<ScreenName>(storageKey('screen'), 'setup')
  const nextPlayerId = useLocalStorage(storageKey('next-player-id'), 1)
  const settingsReturnScreen = useLocalStorage<ReturnScreenName>(
    storageKey('settings-return'),
    'setup',
  )
  // Which view a projection window (a second, fully independent app instance
  // opened via window.open - see MainScreen.vue's openProjectionWindow and
  // CLAUDE.md) should show. Kept as its own localStorage-backed field, rather
  // than read directly off `screen`, so it can be frozen while the operator is
  // on 'setup'/'settings': the audience display must never flicker to an
  // admin-only screen. 'round' and 'reveal' are the same grid with different
  // populations (see ScoreboardGrid.vue), not two separate views.
  const projectionScreen = useLocalStorage<'round' | 'reveal' | 'total'>(
    storageKey('projection-screen'),
    'round',
  )

  const hasPlayers = computed(() => players.value.length > 0)
  const roundNumber = computed(() => currentRound.value + 1)
  const currentRoundTheme = computed(() => roundThemes.value[currentRound.value] ?? '')
  // Public rounds only, same slicing as `getSettledScore`: what the total
  // screen's per-round breakdown is allowed to show.
  const settledRoundThemes = computed(() => roundThemes.value.slice(0, settledRounds.value))

  const gridMajor = computed(() => splitGrid(players.value.length).major)
  const gridMinor = computed(() => splitGrid(players.value.length).minor)

  // Rebuilds each player from an object literal rather than patching in place,
  // so unknown keys from an older persisted shape are dropped. The flip side is
  // a standing rule: EVERY field of `Player` must be named here, or it is
  // silently lost on every store construction - which means on every reload and
  // the moment a projection window opens, not just on upgrade.
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
        // `Number(undefined) || 0` covers rows persisted before penalties
        // existed; the trunc and clamp cover fractions and out-of-range values.
        penalties: Math.max(
          MIN_PENALTY,
          Math.min(MAX_PENALTY, Math.trunc(Number((player as Player).penalties) || 0)),
        ),
      }))
      .filter((player) => player.name.length > 0)
  }

  function normalizeRoundThemes(rawRoundThemes: unknown) {
    return Array.isArray(rawRoundThemes) ? rawRoundThemes.map((value) => String(value ?? '')) : []
  }

  function normalizeRevealedIds(rawRevealedIds: unknown, playerIds: Set<number>) {
    const source = Array.isArray(rawRevealedIds) ? rawRevealedIds : []
    const result: number[] = []

    for (const value of source) {
      const id = Math.trunc(Number(value))

      if (playerIds.has(id) && !result.includes(id)) {
        result.push(id)
      }
    }

    return result
  }

  function sanitizeState() {
    players.value = normalizePlayers(players.value)
    roundThemes.value = normalizeRoundThemes(roundThemes.value)
    currentRound.value = Math.max(0, Math.floor(Number(currentRound.value) || 0))
    // A settled count is only ever `currentRound` (round in progress, nothing
    // public yet) or one past it (round closed, being revealed).
    settledRounds.value = Math.min(
      Math.max(0, Math.floor(Number(settledRounds.value) || 0)),
      currentRound.value + 1,
    )
    const playerIds = new Set(players.value.map((player) => player.id))
    revealedIds.value = normalizeRevealedIds(revealedIds.value, playerIds)
    roundRevealedIds.value = normalizeRevealedIds(roundRevealedIds.value, playerIds)

    if (!['setup', 'round', 'reveal', 'total', 'settings'].includes(screen.value)) {
      screen.value = 'setup'
    }

    if (!['setup', 'round', 'reveal', 'total'].includes(settingsReturnScreen.value)) {
      settingsReturnScreen.value = 'setup'
    }

    if (!['round', 'reveal', 'total'].includes(projectionScreen.value)) {
      projectionScreen.value = 'round'
    }

    // Nothing settled means nothing to reveal, so an empty reveal screen would
    // strand both windows. Reachable from state persisted by an older version,
    // which had no `settledRounds` at all.
    if (settledRounds.value <= currentRound.value) {
      if (screen.value === 'reveal') {
        screen.value = 'round'
      }

      if (settingsReturnScreen.value === 'reveal') {
        settingsReturnScreen.value = 'round'
      }

      if (projectionScreen.value === 'reveal') {
        projectionScreen.value = 'round'
      }
    }

    const maxPlayerId = players.value.reduce((max, player) => Math.max(max, player.id), 0)
    nextPlayerId.value = Math.max(Math.floor(Number(nextPlayerId.value) || 1), maxPlayerId + 1, 1)

    if (players.value.length === 0) {
      currentRound.value = 0
      settledRounds.value = 0
      revealedIds.value = []
      roundRevealedIds.value = []
      roundThemes.value = []
      // Settings needs no players, so it survives an empty roster; the game
      // screens do not and fall back to setup.
      if (screen.value !== 'settings') {
        screen.value = 'setup'
      }
      settingsReturnScreen.value = 'setup'
      return
    }

    ensureRound(currentRound.value)
  }

  sanitizeState()

  // Mirrors `screen` into `projectionScreen` whenever it becomes a screen the
  // audience may see, and leaves it untouched otherwise (i.e. during 'setup'/
  // 'settings'). A reactive watcher rather than threading this into every
  // action that sets `screen` (startGame, resumeGame, backToGame, endRound,
  // nextRound, endGame, goToSetup, openSettings, closeSettings) so it cannot be
  // forgotten at a future call site.
  // `flush: 'sync'` so this is never one tick behind `screen` - actions like
  // `endGame()` must leave `projectionScreen` already updated by the time they
  // return, matching every other direct `screen.value = ...` assignment here.
  watch(
    screen,
    (next) => {
      if (next === 'round' || next === 'reveal' || next === 'total') {
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
      penalties: 0,
    })
  }

  function removePlayer(id: number) {
    players.value = players.value.filter((player) => player.id !== id)
    revealedIds.value = revealedIds.value.filter((revealedId) => revealedId !== id)
    roundRevealedIds.value = roundRevealedIds.value.filter((revealedId) => revealedId !== id)
  }

  function resetScores() {
    players.value = players.value.map((player) => ({
      ...player,
      scores: [0],
      // Explicit, because the spread above would otherwise carry penalties into
      // the new game. `resumeGame` relies on that same spread to keep them.
      penalties: 0,
    }))
    currentRound.value = 0
    settledRounds.value = 0
    revealedIds.value = []
    roundRevealedIds.value = []
    roundThemes.value = ['']
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

    revealedIds.value = []
    openRound()
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

    const themes = [...roundThemes.value]

    while (themes.length <= roundIndex) {
      themes.push('')
    }

    roundThemes.value = themes
  }

  // Opens a round nobody has seen yet: moves on to the next one when the
  // current one has already been made public (end of round, end of game), and
  // resumes it otherwise. The only place `currentRound` ever advances.
  function openRound() {
    if (settledRounds.value > currentRound.value) {
      currentRound.value += 1
    }

    ensureRound(currentRound.value)
    screen.value = 'round'
  }

  function adjustScore(playerId: number, delta: number) {
    ensureRound(currentRound.value)

    players.value = players.value.map((player) => {
      if (player.id !== playerId) {
        return player
      }

      const scores = [...player.scores]
      const score = scores[currentRound.value] ?? 0
      scores[currentRound.value] = Math.max(MIN_SCORE, Math.min(MAX_SCORE, score + delta))

      return { ...player, scores }
    })
  }

  function setRoundTheme(roundIndex: number, theme: string) {
    ensureRound(roundIndex)

    const themes = [...roundThemes.value]
    themes[roundIndex] = theme
    roundThemes.value = themes
  }

  function incrementScore(playerId: number) {
    adjustScore(playerId, 1)
  }

  function decrementScore(playerId: number) {
    adjustScore(playerId, -1)
  }

  // A whole-game counter, not a round score: deliberately no `ensureRound` call
  // and no read or write of `scores`, `currentRound`, `settledRounds`, `screen`
  // or `revealedIds`, so the central invariant
  // `settledRounds ∈ {currentRound, currentRound + 1}` survives every penalty
  // path by construction. It writes one ref, so a projection window sees a
  // single `storage` event and no intermediate state.
  function adjustPenalty(playerId: number, delta: number) {
    players.value = players.value.map((player) => {
      if (player.id !== playerId) {
        return player
      }

      return {
        ...player,
        penalties: Math.max(MIN_PENALTY, Math.min(MAX_PENALTY, player.penalties + delta)),
      }
    })
  }

  function incrementPenalty(playerId: number) {
    adjustPenalty(playerId, 1)
  }

  function decrementPenalty(playerId: number) {
    adjustPenalty(playerId, -1)
  }

  // Closes the round: its points become public, and the reveal starts over with
  // every tile still showing its pre-round total.
  //
  // The scoreboard's number does not read `settledRounds` (see
  // `getScoreboardScore`), so no order of these writes can leak or lower a
  // total. The order still matters for one reason: the list is emptied FIRST so
  // that, once the projection turns to 'reveal', no tile makes a "not revealed ->
  // revealed" transition (which would fire every +N chip and confetti at once
  // from a list left over from the previous round).
  function endRound() {
    roundRevealedIds.value = []
    screen.value = 'reveal'
    settledRounds.value = currentRound.value + 1
  }

  // Both reveal surfaces go through here: the round reveal over that round's
  // points (`roundRevealedIds`), and the total screen's end-of-game reveal over
  // the final scores (`revealedIds`). Never the other list.
  function revealPlayer(playerId: number) {
    if (screen.value !== 'reveal' && screen.value !== 'total') {
      return
    }

    const list = screen.value === 'reveal' ? roundRevealedIds : revealedIds

    if (list.value.includes(playerId)) {
      return
    }

    if (!players.value.some((player) => player.id === playerId)) {
      return
    }

    list.value = [...list.value, playerId]
  }

  // `roundRevealedIds` is deliberately left alone here: `endRound` clears it on
  // the next entry, and outside a reveal the scoreboard ignores it. Every number
  // on the scoreboard reads `currentRound`, so the writes of `openRound` never
  // move a total that was already right.
  function nextRound() {
    openRound()
  }

  // Ends the game and starts the final reveal: the total screen is the
  // end-of-game ceremony, and "every card revealed" is simply its finished
  // state, so it opens on a blank projection the way `endRound` does.
  function endGame() {
    // Ending mid-round must still count the points tallied so far - but not
    // when the round is untouched (the usual case: the operator ends the game
    // right after a reveal, on the round `nextRound` just opened), which would
    // only add a column of zeros to the recap. `endRound` has no such guard:
    // closing an all-zero round there is the operator saying so explicitly.
    // max(), not `currentRound + 1`, so ending from the reveal screen never
    // settles a second round on top of the one just revealed.
    const scored = players.value.some((player) => (player.scores[currentRound.value] ?? 0) > 0)

    // The order of these writes is load-bearing, exactly as in `endRound`, and
    // for two separate reasons.
    //
    // `revealedIds` first: switching screens ahead of it would mount the total
    // view with whatever it still holds already revealed.
    // `roundRevealedIds` is NOT touched: the scoreboard stays exactly as it is
    // until the screen turns over.
    //
    // `settledRounds` last: the total view reads it, so it must land once that
    // view is up and empty (the scoreboard no longer reads it at all).
    revealedIds.value = []
    screen.value = 'total'

    if (scored) {
      settledRounds.value = Math.max(settledRounds.value, currentRound.value + 1)
    }
  }

  function backToGame() {
    openRound()
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

  // What the reveal shows: the last settled round, which during the reveal is
  // `currentRound` anyway. Derived from `settledRounds` rather than
  // `currentRound` on purpose - `nextRound` moves `currentRound` on, and a
  // projection window receives each changed key as its own `storage` event, so
  // reading `currentRound` here would flash a zero across every card in the gap
  // before `projectionScreen` catches up.
  function getRevealScore(player: Player) {
    return player.scores[settledRounds.value - 1] ?? 0
  }

  // Everything, round in progress included: the control screen, and it alone.
  function getTotalScore(player: Player) {
    return player.scores.reduce((sum, score) => sum + score, 0)
  }

  // Public rounds only: everything the audience sees, during a round as well as
  // during the reveal.
  function getSettledScore(player: Player) {
    return player.scores.slice(0, settledRounds.value).reduce((sum, score) => sum + score, 0)
  }

  function getPenalty(player: Player) {
    return player.penalties
  }

  // End of game only, and the ONLY penalty-aware reading of the totals: the
  // total screen alone (TotalGrid.vue), for both the number it shows and the
  // order it ranks by. `getTotalScore`, `getSettledScore`, `getRevealScore`,
  // `getScoreBeforeRound` and `getScoreboardScore` must stay penalty-free, or the deduction leaks onto the round and reveal
  // screens and onto the projection scoreboard before the game is over.
  // Allowed to go negative on purpose: clamping the net at zero would hide the
  // difference between "penalised to nothing" and "penalised past nothing".
  function getFinalScore(player: Player) {
    return getSettledScore(player) - player.penalties
  }

  function isRevealed(player: Player) {
    return revealedIds.value.includes(player.id)
  }

  // The list alone, for the control window's dimmed reveal cards.
  function isRoundRevealed(player: Player) {
    return roundRevealedIds.value.includes(player.id)
  }

  // Everything that precedes the round being scored. `currentRound` does not
  // move during `endRound`, so this is stable whatever order the keys arrive in
  // on a projection window. Penalty-free.
  function getScoreBeforeRound(player: Player) {
    return player.scores.slice(0, currentRound.value).reduce((sum, score) => sum + score, 0)
  }

  // Revealed in the projection scoreboard's sense: only during a reveal. Outside
  // one, a stale list left by the previous round is ignored.
  function isRevealedOnScoreboard(player: Player) {
    return projectionScreen.value === 'reveal' && roundRevealedIds.value.includes(player.id)
  }

  // THE number on a scoreboard tile, and its sort key. The pre-round total until
  // the team is revealed, plus the round's points after. Penalty-free, and it
  // never reads `settledRounds`, so `endRound` changes nothing on screen in any
  // intermediate state. The private tally (`scores[currentRound]`) is only read
  // for a revealed team, and no tile is revealed during a round.
  function getScoreboardScore(player: Player) {
    return (
      getScoreBeforeRound(player) +
      (isRevealedOnScoreboard(player) ? getCurrentRoundScore(player) : 0)
    )
  }

  return {
    players,
    currentRound,
    roundNumber,
    settledRounds,
    revealedIds,
    roundRevealedIds,
    roundThemes,
    currentRoundTheme,
    settledRoundThemes,
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
    incrementScore,
    decrementScore,
    setRoundTheme,
    incrementPenalty,
    decrementPenalty,
    endRound,
    revealPlayer,
    nextRound,
    endGame,
    backToGame,
    goToSetup,
    openSettings,
    closeSettings,
    getCurrentRoundScore,
    getRevealScore,
    getTotalScore,
    getSettledScore,
    getPenalty,
    getFinalScore,
    isRevealed,
    isRoundRevealed,
    isRevealedOnScoreboard,
    getScoreBeforeRound,
    getScoreboardScore,
  }
})
