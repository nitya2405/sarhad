/** Fixed guess cap on every puzzle ('Guess 3 of 20'). */
export const GUESS_CAP = 20;

/** Par in seconds: 20 s + 10 s × k. */
export function par(k: number): number {
  return 20 + 10 * k;
}

/**
 * Points for a win: round(100 · (k + 1) · par / (par + t)), t = tMs / 1000 seconds.
 * Loss or give-up is 0 (callers do not call score). Negative t is clamped to 0.
 * @example score(4, 50_000) === 273; score(4, 600_000) === 45
 */
export function score(k: number, tMs: number): number {
  const p = par(k);
  const t = Math.max(0, tMs) / 1000;
  return Math.round((100 * (k + 1) * p) / (p + t));
}

/** Leaderboard order: faster time, then fewer guesses, then earlier finish (epoch ms). */
export function compareBoard(
  a: { timeMs: number; nGuesses: number; finishedAt: number },
  b: { timeMs: number; nGuesses: number; finishedAt: number },
): number {
  return a.timeMs - b.timeMs || a.nGuesses - b.nGuesses || a.finishedAt - b.finishedAt;
}
