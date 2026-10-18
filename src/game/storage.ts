// localStorage persistence. Anything corrupt, foreign or from an older schema is discarded (F4).
import type { Attempt, LocalPlayer } from '@engine/index.ts';
import { uuid } from '../lib/uuid.ts';

export const STORAGE_KEY = 'sarhad:v1';
export const SCHEMA_VERSION = 1;

/** Attempt plus client-only sync bookkeeping. */
export interface LocalAttempt extends Attempt {
  /** daily finished locally, not yet confirmed by the server */
  pendingSync?: boolean;
  serverAttemptId?: string;
  /** official result from the server, once confirmed */
  serverTimeMs?: number | null;
  serverPoints?: number;
  /** the server flagged this win as very fast: under review, not on the public board */
  serverFlagged?: boolean;
}

export interface SavedPlayer extends LocalPlayer {
  attempts: LocalAttempt[];
  /** won dailies that were pruned from `attempts` (keeps the wins total exact) */
  prunedWins: number;
}

interface Envelope {
  schemaVersion: number;
  player: SavedPlayer;
}

export function newPlayer(): SavedPlayer {
  return { playerId: uuid(), streak: 0, best: 0, totalPoints: 0, attempts: [], prunedWins: 0 };
}

const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function validAttempt(a: unknown): a is LocalAttempt {
  if (!a || typeof a !== 'object') return false;
  const x = a as Record<string, unknown>;
  return (
    isStr(x.attemptId) &&
    (x.mode === 'daily' || x.mode === 'practice') &&
    (x.mode === 'practice' || isStr(x.date)) &&
    isStr(x.puzzleId) &&
    isNum(x.startedAt) &&
    Array.isArray(x.guesses) &&
    x.guesses.every((g) => g && typeof g === 'object' && isStr((g as { id: unknown }).id) && isNum((g as { at: unknown }).at)) &&
    (x.status === 'playing' || x.status === 'won' || x.status === 'lost') &&
    (x.finishedAt === undefined || isNum(x.finishedAt)) &&
    (x.points === undefined || isNum(x.points))
  );
}

/** Parses stored JSON; returns null for anything that is not a valid current-schema save. */
export function parseSave(raw: string | null): SavedPlayer | null {
  if (!raw) return null;
  let env: Envelope;
  try {
    env = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!env || typeof env !== 'object' || env.schemaVersion !== SCHEMA_VERSION) return null;
  const p = env.player as unknown as Record<string, unknown>;
  if (!p || typeof p !== 'object' || !isStr(p.playerId) || !Array.isArray(p.attempts)) return null;
  return {
    playerId: p.playerId,
    streak: isNum(p.streak) ? p.streak : 0,
    best: isNum(p.best) ? p.best : 0,
    lastWinDate: isStr(p.lastWinDate) ? p.lastWinDate : undefined,
    totalPoints: isNum(p.totalPoints) ? p.totalPoints : 0,
    prunedWins: isNum(p.prunedWins) ? p.prunedWins : 0,
    // one bad attempt is dropped, not the whole save
    attempts: p.attempts.filter(validAttempt),
  };
}

function safeStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Loads the player, replacing a corrupt or old save with a fresh one. Never throws. */
export function loadPlayer(storage: Storage | null = safeStorage()): SavedPlayer {
  let raw: string | null = null;
  try {
    raw = storage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    /* blocked storage: play without saving */
  }
  const parsed = parseSave(raw);
  if (parsed) return parsed;
  const fresh = newPlayer();
  savePlayer(fresh, storage);
  return fresh;
}

export function savePlayer(player: SavedPlayer, storage: Storage | null = safeStorage()): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, player } satisfies Envelope));
  } catch {
    /* quota or private mode: the game keeps working in memory */
  }
}
