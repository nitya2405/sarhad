// Generates every puzzle (state pairs with 2 ≤ k ≤ 6 regions strictly between) and the daily
// schedule, and writes the app data (src/data/*) and the server copy (supabase/functions/_shared/
// gamedata.json) from the same in-memory values. Deterministic: same inputs → identical bytes.
import type { DailySchedule, Puzzle, Region } from '../supabase/functions/_shared/engine/types.ts';
import { normalize } from '../supabase/functions/_shared/engine/normalize.ts';
import { shortestDistance, shortestRoute } from '../supabase/functions/_shared/engine/graph.ts';
import { addDays } from '../supabase/functions/_shared/engine/time.ts';
import { ADJACENCY_VERSION, fail, loadAdjacency, loadSourceRegions, p, writeJson } from './lib/common.ts';

const SEED = 20261016;
const FIRST_DATE = '2026-10-16';
const DAYS = 365;
const NO_REPEAT_DAYS = 60;
const K_MIN = 2;
const K_MAX = 6;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const source = loadSourceRegions();
const adjacency = loadAdjacency();

// Regions as shipped: aliases normalised (with the engine's normalize), deduped, names included.
const regions: Region[] = source.map((r) => ({
  id: r.id,
  kind: r.kind,
  playable: r.playable,
  name: r.name,
  aliases: [...new Set([r.name.en, r.name.hi, ...r.aliases].map(normalize).filter(Boolean))],
}));

const kind = new Map(regions.map((r) => [r.id, r.kind]));
const states = regions.filter((r) => r.kind === 'state').map((r) => r.id).sort();
const statesOnly = Object.fromEntries(
  Object.entries(adjacency)
    .filter(([id]) => kind.get(id) === 'state')
    .map(([id, nbs]) => [id, nbs.filter((nb) => kind.get(nb) === 'state')]),
);

const puzzles: Puzzle[] = [];
const needsUt: string[] = [];
for (let i = 0; i < states.length; i++)
  for (let j = i + 1; j < states.length; j++) {
    const [a, b] = [states[i], states[j]];
    const k = shortestDistance(a, b, adjacency) - 1;
    if (!(k >= K_MIN && k <= K_MAX)) continue;
    const shortest = shortestRoute(a, b, adjacency);
    if (!shortest || shortest.length !== k + 2) fail(`route mismatch for ${a}-${b}`);
    puzzles.push({ id: `${a}-${b}`, start: a, end: b, k, shortest });
    // "Needs a UT": every shortest route passes through a UT, i.e. without UTs it is longer or impossible.
    if (shortestDistance(a, b, statesOnly) - 1 > k) needsUt.push(`${a}-${b} via ${shortest.slice(1, -1).join(',')}`);
  }

// Daily schedule: each date picks uniformly (seeded) among puzzles not used in the last 60 days.
const rand = mulberry32(SEED);
const entries: DailySchedule['entries'] = [];
const lastUsed = new Map<string, number>();
for (let d = 0; d < DAYS; d++) {
  const pool = puzzles.filter((pz) => !lastUsed.has(pz.id) || d - lastUsed.get(pz.id)! >= NO_REPEAT_DAYS);
  if (!pool.length) fail(`no puzzle available on day ${d}`);
  const pick = pool[Math.floor(rand() * pool.length)];
  lastUsed.set(pick.id, d);
  entries.push({ date: addDays(FIRST_DATE, d), puzzleId: pick.id });
}
const daily: DailySchedule = { version: 1, entries };

writeJson(p('src/data/regions.json'), regions);
writeJson(p('src/data/adjacency.json'), adjacency);
writeJson(p('src/data/puzzles.json'), puzzles);
writeJson(p('src/data/daily.json'), daily);
writeJson(p('supabase/functions/_shared/gamedata.json'), { adjacencyVersion: ADJACENCY_VERSION, regions, adjacency, puzzles, daily });

const perK = new Map<number, number>();
for (const pz of puzzles) perK.set(pz.k, (perK.get(pz.k) ?? 0) + 1);
const dailyK = new Map<number, number>();
const byId = new Map(puzzles.map((pz) => [pz.id, pz]));
for (const e of entries) dailyK.set(byId.get(e.puzzleId)!.k, (dailyK.get(byId.get(e.puzzleId)!.k) ?? 0) + 1);
const fmt = (m: Map<number, number>) => [...m].sort((x, y) => x[0] - y[0]).map(([k, n]) => `k${k}:${n}`).join(' ');
console.log(`✓ ${puzzles.length} puzzles (${fmt(perK)})`);
console.log(`✓ daily.json: ${entries.length} dates ${entries[0].date}..${entries.at(-1)!.date}, ${new Set(entries.map((e) => e.puzzleId)).size} distinct puzzles (${fmt(dailyK)})`);
console.log(`  pairs whose every shortest route needs a UT (${needsUt.length}): ${needsUt.join('; ') || 'none'}`);
