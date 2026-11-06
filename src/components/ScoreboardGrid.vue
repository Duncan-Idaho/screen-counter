<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, watch } from 'vue'
import { useGameStore, type Player } from '@/stores/game'
import { REVEAL_ROLL_MS, sortByTotalScore } from '@/lib/projectionOrder'
import ScoreboardCard from './ScoreboardCard.vue'

// The projection window's scoreboard: always every team, ranked by the
// scoreboard score. During a round it is frozen on the last settled result; at
// the reveal the tiles stay, and each operator click moves one tile to its new
// total and rank. One component instance for round and reveal (see
// ProjectionScreen.vue), so nothing remounts between them.
const game = useGameStore()

// The DOM stays in roster order and the ranking is a CSS `order`. Re-ordering the
// nodes themselves (what a keyed v-for does) detaches and re-attaches them, and a
// re-attached element loses its running CSS transition: a tile that overtakes
// another would jump to its new total instead of rolling. TransitionGroup still
// FLIP-animates the slide, since it compares positions, not node identity.
// A tile is ranked by its pre-round total until its roll has finished, and by its
// new total after: the number turns first, the tile slides once it is steady.
// `rolled` is local, never persisted (like TotalGrid's clock). It is seeded
// synchronously with the teams already revealed, so a reload or a projection
// opened mid-reveal shows the right ranks with no slide. Outside a reveal
// getScoreboardScore === getScoreBeforeRound, so moving on never waits.
const rolled = reactive(new Set<Player['id']>())
const timers = new Map<Player['id'], ReturnType<typeof setTimeout>>()

const revealedIds = () =>
  game.players.filter((player) => game.isRevealedOnScoreboard(player)).map((player) => player.id)

for (const id of revealedIds()) rolled.add(id)

function forget(id: Player['id']) {
  clearTimeout(timers.get(id))
  timers.delete(id)
  rolled.delete(id)
}

watch(revealedIds, (ids) => {
  const now = new Set(ids)

  for (const id of [...timers.keys(), ...rolled]) if (!now.has(id)) forget(id)

  for (const id of ids) {
    if (rolled.has(id) || timers.has(id)) continue

    timers.set(
      id,
      setTimeout(() => {
        timers.delete(id)
        rolled.add(id)
      }, REVEAL_ROLL_MS),
    )
  }
})

onBeforeUnmount(() => {
  for (const timer of timers.values()) clearTimeout(timer)
  timers.clear()
})

const rankById = computed(
  () =>
    new Map(
      sortByTotalScore(game.players, (player) =>
        rolled.has(player.id) ? game.getScoreboardScore(player) : game.getScoreBeforeRound(player),
      ).map((player, rank) => [player.id, rank]),
    ),
)
</script>

<template>
  <!-- --grid-major/--grid-minor come from the *roster* size, so a tile keeps the
       same box whatever happens. -->
  <TransitionGroup
    tag="div"
    class="scoreboard-grid"
    name="scoreboard"
    :style="{ '--grid-major': game.gridMajor, '--grid-minor': game.gridMinor }"
  >
    <ScoreboardCard
      v-for="player in game.players"
      :key="player.id"
      :player="player"
      :style="{ order: rankById.get(player.id) }"
    />
  </TransitionGroup>
</template>
