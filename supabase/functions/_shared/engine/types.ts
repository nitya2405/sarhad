// Shared types (DESIGN "Schema"). Pure TS: imported by the web app (via @engine) and by Deno Edge Functions.

/** 2 uppercase letters, e.g. 'MH', 'DL'. */
export type RegionId = string;

export interface Region {
  id: RegionId;
  kind: 'state' | 'ut';
  /** false: PY, AN, LD */
  playable: boolean;
  name: { en: string; hi: string };
  /** stored pre-normalised (see normalize) */
  aliases: string[];
}

/** Symmetric, playable regions only. */
export type Adjacency = Record<RegionId, RegionId[]>;

export interface Puzzle {
  /** 'GJ-KL' */
  id: string;
  /** kind === 'state' */
  start: RegionId;
  end: RegionId;
  /** regions between on a shortest route, 2..6 */
  k: number;
  /** one shortest route, start..end, for the reveal */
  shortest: RegionId[];
}

export interface DailySchedule {
  /** bump only by appending dates */
  version: number;
  /** 'YYYY-MM-DD' in IST */
  entries: { date: string; puzzleId: string }[];
}

export interface Attempt {
  /** uuid */
  attemptId: string;
  mode: 'daily' | 'practice';
  /** IST date, daily only */
  date?: string;
  puzzleId: string;
  /** epoch ms */
  startedAt: number;
  guesses: { id: RegionId; at: number }[];
  status: 'playing' | 'won' | 'lost';
  finishedAt?: number;
  points?: number;
}

export interface LocalPlayer {
  /** uuid, made on first open */
  playerId: string;
  streak: number;
  best: number;
  lastWinDate?: string;
  totalPoints: number;
  /** keep last 30 */
  attempts: Attempt[];
}
