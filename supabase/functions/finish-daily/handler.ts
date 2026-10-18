// Pure decision logic for finish-daily: no Deno, no network. Tested with Vitest (handler.test.ts).
import { GUESS_CAP, replay, score } from '../_shared/engine/index.ts';
import type { Adjacency, RegionId } from '../_shared/engine/index.ts';

export interface FinishBody {
  attemptId: string;
  guesses: RegionId[];
  finished: boolean;
}

export interface AttemptRow {
  id: string;
  player_id: string;
  ist_date: string;
  puzzle_id: string;
  started_at: string;
  status: 'playing' | 'won' | 'lost';
  guesses: RegionId[];
  time_ms: number | null;
  points: number | null;
  /** set by finish_daily_commit for an impossibly fast win (kept off the public board) */
  flagged?: boolean;
}

export interface ScheduleRow {
  puzzle_id: string;
  start_id: RegionId;
  end_id: RegionId;
  k: number;
}

export interface GameData {
  adj: Adjacency;
  knownIds: Set<RegionId>;
  playableIds: Set<RegionId>;
}

export interface FinishResponse {
  status: 'won' | 'lost' | 'playing';
  timeMs: number | null;
  points: number;
  guesses: RegionId[];
  /** very fast win: stored and scored, but under review and off the board */
  flagged: boolean;
}

export type Decision =
  | { kind: 'error'; http: number; error: string }
  /** attempt already finished: return the stored result unchanged */
  | { kind: 'stored'; response: FinishResponse }
  /** write via finish_daily_commit */
  | { kind: 'commit'; status: 'won' | 'lost'; guesses: RegionId[]; timeMs: number | null; points: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validates the request body shape. Returns the body or an error string. */
export function parseBody(raw: unknown): FinishBody | string {
  if (!raw || typeof raw !== 'object') return 'bad_body';
  const b = raw as Record<string, unknown>;
  if (typeof b.attemptId !== 'string' || !UUID.test(b.attemptId)) return 'bad_attempt_id';
  if (!Array.isArray(b.guesses) || !b.guesses.every((g) => typeof g === 'string' && g.length <= 4)) return 'bad_guesses';
  if (b.guesses.length > GUESS_CAP) return 'too_many';
  if (typeof b.finished !== 'boolean') return 'bad_finished';
  return { attemptId: b.attemptId, guesses: b.guesses as RegionId[], finished: b.finished };
}

export function storedResponse(a: AttemptRow): FinishResponse {
  return { status: a.status, timeMs: a.time_ms, points: a.points ?? 0, guesses: a.guesses, flagged: a.flagged ?? false };
}

/**
 * Decides what to do with a finish request. Ownership, already-finished, replay with the shared
 * engine, and timing (server finish − server start) all happen here.
 */
export function decideFinish(input: {
  userId: string;
  body: FinishBody;
  attempt: AttemptRow | null;
  schedule: ScheduleRow | null;
  nowMs: number;
  data: GameData;
}): Decision {
  const { userId, body, attempt, schedule, nowMs, data } = input;
  if (!attempt) return { kind: 'error', http: 404, error: 'attempt_not_found' };
  if (attempt.player_id !== userId) return { kind: 'error', http: 403, error: 'not_owner' };
  if (attempt.status !== 'playing') return { kind: 'stored', response: storedResponse(attempt) };
  if (!schedule || schedule.puzzle_id !== attempt.puzzle_id) return { kind: 'error', http: 500, error: 'schedule_mismatch' };

  const r = replay(schedule.start_id, schedule.end_id, body.guesses, {
    adj: data.adj,
    knownIds: data.knownIds,
    playableIds: data.playableIds,
    finished: body.finished,
  });
  if (!r.ok) return { kind: 'error', http: 400, error: r.reason };
  if (r.status === 'playing') return { kind: 'error', http: 400, error: 'not_finished' };

  if (r.status === 'won') {
    const timeMs = Math.max(0, Math.round(nowMs - Date.parse(attempt.started_at)));
    return { kind: 'commit', status: 'won', guesses: body.guesses, timeMs, points: score(schedule.k, timeMs) };
  }
  return { kind: 'commit', status: 'lost', guesses: body.guesses, timeMs: null, points: 0 };
}
