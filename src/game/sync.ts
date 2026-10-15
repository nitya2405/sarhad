// Phase 2 sync. Every server call is optional: failures leave the local game untouched.
import { istDate } from '@engine/index.ts';
import { ServerRejectedError, ensureSession, finishDaily, serverEnabled, startDaily } from '../lib/server.ts';
import { upsertAttempt } from './model.ts';
import { loadPlayer, savePlayer, type LocalAttempt } from './storage.ts';

/** In-flight start_daily calls, so a fast finish waits for its server attempt id. */
const starting = new Map<string, Promise<void>>();

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

export function openSession(): void {
  if (serverEnabled) void safe(ensureSession);
}

/** Called on Start of a daily; never blocks play. */
export function registerDailyStart(attempt: LocalAttempt): void {
  if (!serverEnabled || attempt.mode !== 'daily' || attempt.serverAttemptId) return;
  const job = (async () => {
    await safe(ensureSession);
    const s = await safe(startDaily);
    // Only link when the server agrees on the date and puzzle; otherwise play locally.
    if (s && s.istDate === attempt.date && s.puzzleId === attempt.puzzleId) update(attempt.attemptId, { serverAttemptId: s.attemptId });
  })();
  starting.set(attempt.attemptId, job);
  void job.finally(() => starting.delete(attempt.attemptId));
}

/** Sends one finished daily. Returns true when nothing is left to send for it. */
async function syncOne(a: LocalAttempt): Promise<boolean> {
  await starting.get(a.attemptId);
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
