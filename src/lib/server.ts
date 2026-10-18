// Phase 2 server boundary. Owned by Track D (implementation); the signatures are a shared interface.
// Every function must be safe to call when the server is disabled (VITE_SUPABASE_URL unset):
// `serverEnabled` is false and calls resolve to null / no-op without network access.
// supabase-js is loaded with a dynamic import, so it is not in the main bundle.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { RegionId } from '@engine/index.ts';

export const serverEnabled: boolean = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);

export interface ServerDailyStart {
  attemptId: string;
  istDate: string;
  puzzleId: string;
  start: RegionId;
  end: RegionId;
  k: number;
  /** server started_at, epoch ms */
  startedAt: number;
  status: 'playing' | 'won' | 'lost';
}

export interface ServerDailyResult {
  status: 'won' | 'lost' | 'playing';
  timeMs: number | null;
  points: number;
  guesses: RegionId[];
  /** very fast win: stored and scored, but under review and off the public board */
  flagged: boolean;
}

export interface BoardRow {
  rank: number;
  displayName: string;
  timeMs: number;
  nGuesses: number;
  isMe: boolean;
}

export interface DailyBoard {
  rows: BoardRow[];
  /** caller's rank among today's winners, null if not a winner */
  myRank: number | null;
  /** the caller's own win when it is flagged (under review, not on the board) */
  myReview: { timeMs: number; nGuesses: number } | null;
}

/**
 * Thrown by finishDaily when the server definitively refuses the request (HTTP 4xx, e.g. a guess
 * list the server considers invalid). Do not retry these; null results (network / 5xx) are retryable.
 */
export class ServerRejectedError extends Error {
  constructor(public code: string, public httpStatus: number) {
    super(`finish-daily rejected: ${code} (${httpStatus})`);
    this.name = 'ServerRejectedError';
  }
}

let clientPromise: Promise<SupabaseClient> | null = null;
let sessionPromise: Promise<boolean> | null = null;

function getClient(): Promise<SupabaseClient> | null {
  if (!serverEnabled) return null;
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'sarhad:auth' },
    }),
  );
  return clientPromise;
}

/** Client with a session, or null when disabled / sign-in failed. */
async function authed(): Promise<SupabaseClient | null> {
  const c = getClient();
  if (!c) return null;
  return (await ensureSession()) ? c : null;
}

/** Silent anonymous sign-in on first open; idempotent. Never throws (logs and returns false). */
export async function ensureSession(): Promise<boolean> {
  const c = getClient();
  if (!c) return false;
  sessionPromise ??= (async () => {
    try {
      const client = await c;
      const { data } = await client.auth.getSession();
      if (data.session) return true;
      const { error } = await client.auth.signInAnonymously();
      if (error) throw error;
      return true;
    } catch (e) {
      console.warn('[sarhad] anonymous sign-in failed', e);
      sessionPromise = null; // allow a later retry
      return false;
    }
  })();
  return sessionPromise;
}

/**
 * Calls the start_daily() RPC. Same row/startedAt on repeat calls. null when disabled or offline;
 * 'no_daily' when the server has no puzzle scheduled for today.
 */
export async function startDaily(): Promise<ServerDailyStart | 'no_daily' | null> {
  try {
    const c = await authed();
    if (!c) return null;
    const { data, error } = await c.rpc('start_daily');
    if (error?.message === 'no_daily') return 'no_daily';
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      attemptId: String(row.attempt_id),
      istDate: String(row.ist_date),
      puzzleId: String(row.puzzle_id),
      start: String(row.start_id),
      end: String(row.end_id),
      k: Number(row.k),
      startedAt: Date.parse(String(row.started_at)),
      status: row.status as ServerDailyStart['status'],
    };
  } catch (e) {
    console.warn('[sarhad] start_daily failed', e);
    return null;
  }
}

/**
 * Calls the finish-daily Edge Function. `finished` = player gave up or hit the cap (not won → lost).
 * Retrying is safe: a finished attempt returns its stored result unchanged. null on network failure
 * (retry later); throws ServerRejectedError on a definitive 4xx refusal (do not retry).
 */
export async function finishDaily(attemptId: string, guesses: RegionId[], finished: boolean): Promise<ServerDailyResult | null> {
  const c = await authed();
  if (!c) return null;
  const { data, error } = await c.functions.invoke('finish-daily', { body: { attemptId, guesses, finished } });
  if (error) {
    const res = (error as { context?: unknown }).context;
    if (res instanceof Response && res.status >= 400 && res.status < 500) {
      let code = 'rejected';
      try {
        code = ((await res.json()) as { error?: string }).error ?? code;
      } catch {
        /* body not JSON */
      }
      throw new ServerRejectedError(code, res.status);
    }
    console.warn('[sarhad] finish-daily failed', error);
    return null;
  }
  const d = data as ServerDailyResult;
  return { status: d.status, timeMs: d.timeMs ?? null, points: d.points ?? 0, guesses: d.guesses ?? [], flagged: d.flagged ?? false };
}

/** get_daily_board(date) RPC: top 50 winners + caller's rank. null when disabled or offline. */
export async function getDailyBoard(istDate: string): Promise<DailyBoard | null> {
  try {
    const c = await authed();
    if (!c) return null;
    const { data, error } = await c.rpc('get_daily_board', { p_date: istDate });
    if (error) throw error;
    const d = data as {
      rows: { rank: number; display_name: string; time_ms: number; n_guesses: number; is_me: boolean }[];
      my_rank: number | null;
      my_review?: { time_ms: number; n_guesses: number } | null;
    };
    return {
      rows: d.rows.map((r) => ({ rank: r.rank, displayName: r.display_name, timeMs: r.time_ms, nGuesses: r.n_guesses, isMe: r.is_me })),
      myRank: d.my_rank,
      myReview: d.my_review ? { timeMs: d.my_review.time_ms, nGuesses: d.my_review.n_guesses } : null,
    };
  } catch (e) {
    console.warn('[sarhad] get_daily_board failed', e);
    return null;
  }
}

export interface DailyStats {
  /** finished attempts that date */
  players: number;
  /** median official time of the unflagged wins */
  medianMs: number | null;
  /** share of the other finished players the caller beat; null unless the caller won */
  fasterThanPct: number | null;
  /** most-guessed state; null until the caller has finished that day's daily */
  topState: RegionId | null;
}

/** get_daily_stats(date) RPC: aggregates only. null when disabled, offline or not deployed yet. */
export async function getDailyStats(istDate: string): Promise<DailyStats | null> {
  try {
    const c = await authed();
    if (!c) return null;
    const { data, error } = await c.rpc('get_daily_stats', { p_date: istDate });
    if (error) throw error;
    const d = data as { players?: number; median_ms?: number | null; faster_than_pct?: number | null; top_state?: string | null };
    return { players: d.players ?? 0, medianMs: d.median_ms ?? null, fasterThanPct: d.faster_than_pct ?? null, topState: d.top_state ?? null };
  } catch (e) {
    console.warn('[sarhad] get_daily_stats failed', e);
    return null;
  }
}

/** Whether the caller still has the default display name. */
export async function needsDisplayName(): Promise<boolean> {
  try {
    const c = await authed();
    if (!c) return false;
    const { data, error } = await c.from('players').select('is_default_name').maybeSingle();
    if (error) throw error;
    return data?.is_default_name ?? false;
  } catch (e) {
    console.warn('[sarhad] players read failed', e);
    return false;
  }
}

/** set_display_name(name) RPC; 3–20 chars after trim. Returns an error message or null on success. */
export async function setDisplayName(name: string): Promise<string | null> {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  if (trimmed.length < 3 || trimmed.length > 20) return 'Name must be 3–20 characters.';
  const c = await authed();
  if (!c) return 'Leaderboard is offline right now.';
  const { error } = await c.rpc('set_display_name', { p_name: trimmed });
  return error ? 'Could not save that name. Try another.' : null;
}
