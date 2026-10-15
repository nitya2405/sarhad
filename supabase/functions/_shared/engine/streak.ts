import type { Attempt } from './types.ts';
import { addDays } from './time.ts';

export interface StreakStats {
  /** consecutive IST dates with a finished daily, ending today or yesterday (today not yet played keeps it alive) */
  streak: number;
  /** longest run seen in `attempts` */
  best: number;
  /** total won dailies */
  wins: number;
}

/**
 * Streak from attempts: +1 per IST date with a finished daily (won, or lost/gave up);
 * a missed date resets; practice and unfinished attempts never count. One daily per date.
 */
export function streak(attempts: Attempt[], todayIst: string): StreakStats {
  const finished = new Set<string>();
  const won = new Set<string>();
  for (const a of attempts) {
    if (a.mode !== 'daily' || !a.date || a.status === 'playing') continue;
    finished.add(a.date);
    if (a.status === 'won') won.add(a.date);
  }

  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of [...finished].sort()) {
    run = prev !== null && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }

  let current = 0;
  let day = finished.has(todayIst) ? todayIst : addDays(todayIst, -1);
  while (finished.has(day)) {
    current++;
    day = addDays(day, -1);
  }
  return { streak: current, best, wins: won.size };
}
