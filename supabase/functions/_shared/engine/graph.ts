import type { Adjacency, RegionId } from './types.ts';

/** BFS from seeds, visiting only ids allowed (all ids when allowed is undefined). Returns id → distance. */
function bfs(seeds: RegionId[], adj: Adjacency, allowed?: Set<RegionId>): Map<RegionId, number> {
  const dist = new Map<RegionId, number>();
  const queue: RegionId[] = [];
  for (const s of seeds) {
    if (!dist.has(s)) {
      dist.set(s, 0);
      queue.push(s);
    }
  }
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i];
    for (const nb of adj[cur] ?? []) {
      if (dist.has(nb) || (allowed && !allowed.has(nb))) continue;
      dist.set(nb, dist.get(cur)! + 1);
      queue.push(nb);
    }
  }
  return dist;
}

/** Lexicographically smallest shortest route a..b, optionally restricted to allowed ids. */
function route(a: RegionId, b: RegionId, adj: Adjacency, allowed?: Set<RegionId>): RegionId[] | null {
  const toB = bfs([b], adj, allowed);
  if (!toB.has(a)) return null;
  const path = [a];
  let cur = a;
  while (cur !== b) {
    const want = toB.get(cur)! - 1;
    const next = [...(adj[cur] ?? [])].filter((nb) => toB.get(nb) === want).sort()[0];
    path.push(next);
    cur = next;
  }
  return path;
}

/**
 * Guesses that lie in the component of start or of end, within the graph restricted to
 * {start, end} ∪ guesses. These are coloured; the rest are grey. Order of guesses is irrelevant.
 */
export function linkedSet(start: RegionId, end: RegionId, guesses: RegionId[], adj: Adjacency): Set<RegionId> {
  const allowed = new Set([start, end, ...guesses]);
  const reached = bfs([start, end], adj, allowed);
  return new Set(guesses.filter((g) => reached.has(g)));
}

/** True when start and end are in the same component of the graph restricted to {start, end} ∪ guesses. */
export function isWon(start: RegionId, end: RegionId, guesses: RegionId[], adj: Adjacency): boolean {
  return bfs([start], adj, new Set([start, end, ...guesses])).has(end);
}

/** BFS edge count from a to b over the whole graph; Infinity if unreachable. */
export function shortestDistance(a: RegionId, b: RegionId, adj: Adjacency): number {
  return bfs([a], adj).get(b) ?? Infinity;
}

/**
 * One deterministic shortest route a..b (inclusive) over the whole graph, tie-broken
 * lexicographically on the id sequence. null if unreachable.
 */
export function shortestRoute(a: RegionId, b: RegionId, adj: Adjacency): RegionId[] | null {
  return route(a, b, adj);
}

/**
 * Shortest route start..end using only {start, end} ∪ guesses, or null if not linked.
 * The result screen compares its length with shortestDistance to say "You found a shortest route!".
 */
export function shortestRouteWithin(start: RegionId, end: RegionId, guesses: RegionId[], adj: Adjacency): RegionId[] | null {
  return route(start, end, adj, new Set([start, end, ...guesses]));
}

/**
 * Graph invariants: symmetric, no self-edges, no duplicate neighbours, every id in knownIds,
 * every id in drawnIds (if given), every playable id present, all playable ids connected.
 * Returns human-readable errors; empty array = valid.
 */
export function validateGraph(
  adj: Adjacency,
  opts: { knownIds: RegionId[]; playableIds: RegionId[]; drawnIds?: RegionId[] },
): string[] {
  const errors: string[] = [];
  const known = new Set(opts.knownIds);
  const playable = new Set(opts.playableIds);
  const drawn = opts.drawnIds ? new Set(opts.drawnIds) : null;
  const ids = new Set<RegionId>(Object.keys(adj));
  for (const nbs of Object.values(adj)) for (const nb of nbs) ids.add(nb);

  for (const id of ids) {
    if (!known.has(id)) errors.push(`Unknown region id "${id}"`);
    else if (!playable.has(id)) errors.push(`Region "${id}" is not playable but appears in the graph`);
    if (drawn && !drawn.has(id)) errors.push(`Region "${id}" is not drawn on the map`);
  }
  for (const [a, nbs] of Object.entries(adj)) {
    const seen = new Set<RegionId>();
    for (const b of nbs) {
      if (a === b) errors.push(`Self-edge on "${a}"`);
      if (seen.has(b)) errors.push(`Duplicate neighbour "${b}" listed under "${a}"`);
      seen.add(b);
      if (!(adj[b] ?? []).includes(a)) errors.push(`Asymmetric edge: "${a}" lists "${b}" but "${b}" does not list "${a}"`);
    }
  }
  for (const id of playable) if (!(id in adj)) errors.push(`Playable region "${id}" has no entry in the graph`);
  const first = opts.playableIds.find((id) => id in adj);
  if (first) {
    const reached = bfs([first], adj);
    const missing = opts.playableIds.filter((id) => !reached.has(id));
    if (missing.length) errors.push(`Graph is not connected: unreachable from ${first}: ${missing.join(', ')}`);
  }
  return errors;
}
