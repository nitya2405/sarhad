// Phase 2 sync. Every server call is optional: failures leave the local game untouched.
import { istDate } from '@engine/index.ts';
import { ServerRejectedError, ensureSession, finishDaily, serverEnabled, startDaily, type ServerDailyStart } from '../lib/server.ts';
import { upsertAttempt } from './model.ts';
import { loadPlayer, savePlayer, type LocalAttempt } from './storage.ts';

async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (e) {
    console.warn('[sarhad] server call failed', e);
    return null;
  }
}

function update(attemptId: string, patch: Partial<LocalAttempt>) {
  const p = loadPlayer();
  const a = p.attempts.find((x) => x.attemptId === attemptId);
  if (!a) return;
  savePlayer(upsertAttempt(p, { ...a, ...patch }, istDate(Date.now())));
}

/**
 * Silent anonymous sign-in, loaded after first paint so supabase-js stays off the critical path:
 * requestIdleCallback, with a timeout fallback. If Start comes first, startDaily signs in itself
 * (ensureSession is shared), so the daily never starts without a session.
 */
export function openSessionWhenIdle(then?: () => void): () => void {
  if (!serverEnabled) return () => {};
  const run = () => {
    void safe(ensureSession).then(() => then?.());
  };
  if (typeof requestIdleCallback === 'function') {
    const id = requestIdleCallback(run, { timeout: 2000 });
    return () => cancelIdleCallback(id);
  }
  const t = setTimeout(run, 1200);
  return () => clearTimeout(t);
}

/**
 * Server builds: the daily pair comes only from start_daily, pressed at Start.
 * null = no connection (or the server is unreachable); the caller shows "Needs a connection to start".
 */
export async function fetchDailyStart(): Promise<ServerDailyStart | null> {
  if (!serverEnabled || (typeof navigator !== 'undefined' && navigator.onLine === false)) return null;
  return safe(startDaily);
}

/** Sends one finished daily. Returns true when nothing is left to send for it. */
async function syncOne(a: LocalAttempt): Promise<boolean> {
  const fresh = loadPlayer().attempts.find((x) => x.attemptId === a.attemptId) ?? a;
  if (!fresh.pendingSync) return true;
  if (!fresh.serverAttemptId) {
    // never started on the server: this result stays local-only
    update(a.attemptId, { pendingSync: false });
    return true;
  }
  let r;
  try {
    r = await finishDaily(fresh.serverAttemptId, fresh.guesses.map((g) => g.id), fresh.status === 'lost');
  } catch (e) {
    if (e instanceof ServerRejectedError) {
      // definitive refusal: keep the local result, stop retrying
      console.warn('[sarhad]', e.message);
      update(a.attemptId, { pendingSync: false });
      return true;
    }
    console.warn('[sarhad] finish-daily failed', e);
    return false;
  }
  if (!r || r.status === 'playing') return false;
  update(a.attemptId, { pendingSync: false, serverTimeMs: r.timeMs, serverPoints: r.points });
  return true;
}

let timer: ReturnType<typeof setTimeout> | undefined;
let delay = 2000;

/** Sends every pending daily result; retries with backoff (max 60 s) until confirmed. */
export async function syncPending(onChange?: () => void): Promise<void> {
  if (!serverEnabled) return;
  clearTimeout(timer);
  const pending = loadPlayer().attempts.filter((a) => a.mode === 'daily' && a.status !== 'playing' && a.pendingSync);
  if (!pending.length) return;
  let allDone = true;
  for (const a of pending) allDone = (await syncOne(a)) && allDone;
  onChange?.();
  if (allDone) {
    delay = 2000;
  } else {
    timer = setTimeout(() => void syncPending(onChange), delay);
    delay = Math.min(delay * 2, 60_000);
  }
}
