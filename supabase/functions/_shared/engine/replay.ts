import type { Adjacency, RegionId } from './types.ts';
import { isWon } from './graph.ts';
import { GUESS_CAP } from './score.ts';

export type ReplayResult =
  | { ok: true; status: 'won' | 'lost' | 'playing'; /** index of the guess that linked, if won */ winningIndex?: number }
  | { ok: false; reason: 'too_many' | 'unknown' | 'duplicate' | 'endpoint' | 'unplayable' | 'after_win' };

/**
 * Replays a submitted guess list (used by finish-daily, and usable on the client).
 * Rejects lists longer than GUESS_CAP, unknown or unplayable ids, duplicates, endpoints,
 * and any guess after the winning one. finished=true means the player ended the game
 * (give up or cap reached): not won → 'lost'; finished=false and not won → 'playing'.
 */
export function replay(
  start: RegionId,
  end: RegionId,
  guesses: RegionId[],
  ctx: { adj: Adjacency; knownIds: Set<RegionId>; playableIds: Set<RegionId>; finished: boolean },
): ReplayResult {
  if (guesses.length > GUESS_CAP) return { ok: false, reason: 'too_many' };
  const seen: RegionId[] = [];
  let winningIndex: number | undefined;
  for (let i = 0; i < guesses.length; i++) {
    const g = guesses[i];
    if (!ctx.knownIds.has(g)) return { ok: false, reason: 'unknown' };
    if (g === start || g === end) return { ok: false, reason: 'endpoint' };
    if (!ctx.playableIds.has(g)) return { ok: false, reason: 'unplayable' };
    if (seen.includes(g)) return { ok: false, reason: 'duplicate' };
    if (winningIndex !== undefined) return { ok: false, reason: 'after_win' };
    seen.push(g);
    if (isWon(start, end, seen, ctx.adj)) winningIndex = i;
  }
  if (winningIndex !== undefined) return { ok: true, status: 'won', winningIndex };
  if (ctx.finished || guesses.length === GUESS_CAP) return { ok: true, status: 'lost' };
  return { ok: true, status: 'playing' };
}
