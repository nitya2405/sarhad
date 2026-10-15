// Pure game logic over saved attempts (DESIGN "Game state machine"). No React, no storage access.
import { GUESS_CAP, addDays, isWon, score, streak, type Adjacency, type Puzzle, type RegionId } from '@engine/index.ts';
import type { LocalAttempt, SavedPlayer } from './storage.ts';

/** Practice attempts kept; dailies are kept for a year so the streak stays exact. */
export const PRACTICE_KEEP = 30;
export const DAILY_KEEP_DAYS = 400;

export const isFinished = (a: LocalAttempt) => a.status !== 'playing';

export function findDaily(player: SavedPlayer, date: string): LocalAttempt | undefined {
  return player.attempts.find((a) => a.mode === 'daily' && a.date === date);
}

/** The attempt to resume on open: an unfinished daily first (any date — it keeps its puzzle past midnight), else practice. */
export function activeAttempt(player: SavedPlayer): LocalAttempt | undefined {
  const playing = player.attempts.filter((a) => a.status === 'playing').sort((a, b) => b.startedAt - a.startedAt);
  return playing.find((a) => a.mode === 'daily') ?? playing[0];
}

export function createAttempt(
  mode: 'daily' | 'practice',
  puzzleId: string,
  date: string | undefined,
  now: number,
  attemptId: string,
): LocalAttempt {
  return { attemptId, mode, ...(mode === 'daily' ? { date } : {}), puzzleId, startedAt: now, guesses: [], status: 'playing' };
}

/**
 * Adds an accepted guess (already resolved and validated). Frozen once won or lost.
 * Links A to B → won with points (daily only); 20th guess without a link → lost.
 */
export function addGuess(a: LocalAttempt, id: RegionId, puzzle: Puzzle, adj: Adjacency, now: number): LocalAttempt {
  if (isFinished(a) || a.guesses.some((g) => g.id === id) || a.guesses.length >= GUESS_CAP) return a;
  const guesses = [...a.guesses, { id, at: now }];
  const ids = guesses.map((g) => g.id);
  if (isWon(puzzle.start, puzzle.end, ids, adj)) {
    return {
      ...a,
      guesses,
      status: 'won',
      finishedAt: now,
      ...(a.mode === 'daily' ? { points: score(puzzle.k, now - a.startedAt), pendingSync: true } : {}),
    };
  }
  if (guesses.length >= GUESS_CAP) return finishLost({ ...a, guesses }, now);
  return { ...a, guesses };
}

export function giveUp(a: LocalAttempt, now: number): LocalAttempt {
  return isFinished(a) ? a : finishLost(a, now);
}

function finishLost(a: LocalAttempt, now: number): LocalAttempt {
  return { ...a, status: 'lost', finishedAt: now, ...(a.mode === 'daily' ? { points: 0, pendingSync: true } : {}) };
}

/**
 * Stores an attempt. A finished attempt never moves backwards: later writes may only change
 * its sync fields. Adds points once, prunes old attempts, refreshes stored streak/best.
 */
export function upsertAttempt(player: SavedPlayer, next: LocalAttempt, today: string): SavedPlayer {
  const prev = player.attempts.find((a) => a.attemptId === next.attemptId);
  let stored = next;
  let totalPoints = player.totalPoints;
  if (prev && isFinished(prev)) {
    const { pendingSync, serverAttemptId, serverTimeMs, serverPoints } = next;
    stored = { ...prev, pendingSync, serverAttemptId, serverTimeMs, serverPoints };
  } else if (isFinished(next)) {
    totalPoints += next.points ?? 0;
  }
  const others = player.attempts.filter((a) => a.attemptId !== next.attemptId);
  return withStats(prune({ ...player, totalPoints, attempts: [...others, stored] }, today), today);
}

function prune(player: SavedPlayer, today: string): SavedPlayer {
  const cutoff = addDays(today, -DAILY_KEEP_DAYS);
  let prunedWins = player.prunedWins;
  const dailies = player.attempts.filter((a) => {
    if (a.mode !== 'daily') return false;
    if ((a.date ?? '') >= cutoff || a.status === 'playing') return true;
    if (a.status === 'won') prunedWins++;
    return false;
  });
  const practice = player.attempts
    .filter((a) => a.mode === 'practice')
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, PRACTICE_KEEP);
  const attempts = [...dailies, ...practice].sort((a, b) => a.startedAt - b.startedAt);
  return { ...player, prunedWins, attempts };
}

export interface Stats {
  streak: number;
  best: number;
  wins: number;
  totalPoints: number;
}

export function stats(player: SavedPlayer, today: string): Stats {
  const s = streak(player.attempts, today);
  return { streak: s.streak, best: Math.max(player.best, s.best), wins: s.wins + player.prunedWins, totalPoints: player.totalPoints };
}

function withStats(player: SavedPlayer, today: string): SavedPlayer {
  const s = stats(player, today);
  const lastWin = player.attempts
    .filter((a) => a.mode === 'daily' && a.status === 'won')
    .map((a) => a.date!)
    .sort()
    .pop();
  return { ...player, streak: s.streak, best: s.best, lastWinDate: lastWin ?? player.lastWinDate };
}

/** Elapsed ms of a finished attempt (start → winning guess or give-up). */
export const elapsedMs = (a: LocalAttempt) => (a.finishedAt ?? a.startedAt) - a.startedAt;

/** 'Your best times': this phone's won dailies, fastest first. */
export function bestTimes(player: SavedPlayer, n = 5): LocalAttempt[] {
  return player.attempts
    .filter((a) => a.mode === 'daily' && a.status === 'won')
    .sort((a, b) => elapsedMs(a) - elapsedMs(b) || a.guesses.length - b.guesses.length)
    .slice(0, n);
}

/**
 * Start (or rejoin) a daily. One daily per IST date: if this date already has an attempt,
 * that one is returned unchanged (two tabs pressing Start get the same attempt).
 */
export function startDailyAttempt(
  player: SavedPlayer,
  date: string,
  puzzleId: string,
  now: number,
  attemptId: string,
): { player: SavedPlayer; attempt: LocalAttempt } {
  const existing = findDaily(player, date);
  if (existing) return { player, attempt: existing };
  const attempt = createAttempt('daily', puzzleId, date, now, attemptId);
  return { player: upsertAttempt(player, attempt, date), attempt };
}
