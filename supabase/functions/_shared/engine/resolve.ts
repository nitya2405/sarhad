import type { Region, RegionId } from './types.ts';
import { isLatin, normalize } from './normalize.ts';

/** Prebuilt lookup over all 36 regions (playable or not). Build once with buildAliasIndex. */
export interface AliasIndex {
  /** normalised alias/name → region id (aliases are unique across regions) */
  exact: Map<string, RegionId>;
  regions: Map<RegionId, Region>;
  /** normalised Latin names/aliases longer than 3 chars, for fuzzy and prefix matching */
  fuzzyKeys: { key: string; id: RegionId }[];
}

export interface ResolveCtx {
  start: RegionId;
  end: RegionId;
  /** accepted guesses so far */
  guesses: RegionId[];
  index: AliasIndex;
}

export type RejectReason = 'empty' | 'unknown' | 'duplicate' | 'endpoint' | 'unplayable';

export type ResolveResult =
  | { type: 'accept'; id: RegionId }
  /** ids: up to 4 chips; highlight: the single fuzzy best match that Enter accepts */
  | { type: 'suggest'; ids: RegionId[]; highlight?: RegionId }
  | { type: 'reject'; reason: RejectReason };

/** Max number of suggestion chips. */
const MAX_CHIPS = 4;

/**
 * Builds the alias index from regions. Names (en, hi) and aliases are normalised here as well,
 * so un-normalised input data cannot break matching. Throws if one alias maps to two regions.
 */
export function buildAliasIndex(regions: Region[]): AliasIndex {
  const exact = new Map<string, RegionId>();
  const byId = new Map<RegionId, Region>();
  const fuzzyKeys: { key: string; id: RegionId }[] = [];
  for (const r of regions) {
    byId.set(r.id, r);
    for (const raw of [r.name.en, r.name.hi, ...r.aliases]) {
      const key = normalize(raw);
      if (!key) continue;
      const prev = exact.get(key);
      if (prev && prev !== r.id) throw new Error(`Alias "${raw}" (${key}) maps to both ${prev} and ${r.id}`);
      if (prev) continue;
      exact.set(key, r.id);
      if (isLatin(key) && key.length > 3) fuzzyKeys.push({ key, id: r.id });
    }
  }
  return { exact, regions: byId, fuzzyKeys };
}

/**
 * Resolves raw typed input to a region, a suggestion, or a rejection. Never spends a guess itself.
 * - empty after normalising → reject 'empty'
 * - exact alias match → endpoint? 'endpoint'; already guessed? 'duplicate'; not playable? 'unplayable'; else accept
 * - fuzzy only on Latin input ≥ 4 chars: Damerau–Levenshtein ≤ 1 (len 4–6) or ≤ 2 (len ≥ 7);
 *   a single unique best → suggest with highlight. Abbreviations (≤ 3 chars) are exact-only.
 * - otherwise up to 4 prefix suggestions (input ≥ 2 chars) → suggest without highlight
 * - nothing → reject 'unknown'. A fuzzy match is never auto-accepted.
 */
export function resolveInput(raw: string, ctx: ResolveCtx): ResolveResult {
  const q = normalize(raw);
  if (!q) return { type: 'reject', reason: 'empty' };
  const { index } = ctx;

  const blocker = (id: RegionId): RejectReason | null => {
    if (id === ctx.start || id === ctx.end) return 'endpoint';
    if (ctx.guesses.includes(id)) return 'duplicate';
    if (!index.regions.get(id)?.playable) return 'unplayable';
    return null;
  };

  const hit = index.exact.get(q);
  if (hit) {
    const reason = blocker(hit);
    return reason ? { type: 'reject', reason } : { type: 'accept', id: hit };
  }

  const byName = (a: RegionId, b: RegionId) =>
    (index.regions.get(a)?.name.en ?? a).localeCompare(index.regions.get(b)?.name.en ?? b);

  // Fuzzy: Latin input of 4+ chars against Latin keys of 4+ chars.
  let fuzzyBest: RegionId[] = [];
  if (isLatin(q) && q.length >= 4) {
    const maxD = q.length <= 6 ? 1 : 2;
    const best = new Map<RegionId, number>();
    for (const { key, id } of index.fuzzyKeys) {
      if (Math.abs(key.length - q.length) > maxD) continue;
      const d = damerauLevenshtein(q, key);
      if (d <= maxD && d < (best.get(id) ?? Infinity)) best.set(id, d);
    }
    if (best.size) {
      const min = Math.min(...best.values());
      fuzzyBest = [...best].filter(([, d]) => d === min).map(([id]) => id).sort(byName);
    }
  }

  if (fuzzyBest.length === 1) {
    const id = fuzzyBest[0];
    const reason = blocker(id);
    if (reason) return { type: 'reject', reason };
    const ids = [id, ...prefixIds(q, ctx, blocker, byName).filter((x) => x !== id)].slice(0, MAX_CHIPS);
    return { type: 'suggest', ids, highlight: id };
  }

  const chips = [...fuzzyBest.filter((id) => !blocker(id))];
  if (q.length >= 2) for (const id of prefixIds(q, ctx, blocker, byName)) if (!chips.includes(id)) chips.push(id);
  if (chips.length) return { type: 'suggest', ids: chips.slice(0, MAX_CHIPS) };
  return { type: 'reject', reason: 'unknown' };
}

function prefixIds(
  q: string,
  ctx: ResolveCtx,
  blocker: (id: RegionId) => RejectReason | null,
  byName: (a: RegionId, b: RegionId) => number,
): RegionId[] {
  if (q.length < 2) return [];
  const ids = new Set<RegionId>();
  for (const [key, id] of ctx.index.exact) {
    if (key.length <= 3 && key !== q) continue; // abbreviations are exact-only
    if ((key.startsWith(q) || key.includes(' ' + q)) && !blocker(id)) ids.add(id);
  }
  return [...ids].sort(byName);
}

/** Damerau–Levenshtein (optimal string alignment) distance. */
export function damerauLevenshtein(a: string, b: string): number {
  const A = Array.from(a);
  const B = Array.from(b);
  const m = A.length;
  const n = B.length;
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => {
    const row = new Array<number>(n + 1).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = A[i - 1] === B[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && A[i - 1] === B[j - 2] && A[i - 2] === B[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n];
}
