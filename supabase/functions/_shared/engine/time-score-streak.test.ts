import { describe, expect, it } from 'vitest';
import { compareBoard, GUESS_CAP, par, score } from './score.ts';
import { addDays, istDate, nextIstMidnight } from './time.ts';
import { streak } from './streak.ts';
import type { Attempt } from './types.ts';

describe('time (T1–T3)', () => {
  it('T1: start 23:59:30 IST, win 00:00:20 → attempt counts for the start date', () => {
    const start = Date.parse('2026-10-16T23:59:30+05:30');
    const win = Date.parse('2026-10-17T00:00:20+05:30');
    expect(istDate(start)).toBe('2026-10-16');
    expect(istDate(win)).toBe('2026-10-17');
    expect(win - start).toBe(50_000);
  });
  it('T2: an instant expressed in New York time maps to the IST date', () => {
    // 20:00 on 16 Oct in New York (EDT, UTC−4) = 05:30 on 17 Oct in IST
    expect(istDate(Date.parse('2026-10-16T20:00:00-04:00'))).toBe('2026-10-17');
    expect(istDate(Date.parse('2026-10-16T18:29:59.999Z'))).toBe('2026-10-16');
    expect(istDate(Date.parse('2026-10-16T18:30:00Z'))).toBe('2026-10-17');
  });
  it('T3: score depends only on elapsed duration, not on wall-clock date', () => {
    expect(score(4, 50_000)).toBe(score(4, Date.parse('2030-01-01T00:00:50Z') - Date.parse('2030-01-01T00:00:00Z')));
  });
  it('nextIstMidnight and addDays', () => {
    expect(nextIstMidnight(Date.parse('2026-10-16T23:59:30+05:30'))).toBe(Date.parse('2026-10-17T00:00:00+05:30'));
    expect(nextIstMidnight(Date.parse('2026-10-17T00:00:00+05:30'))).toBe(Date.parse('2026-10-18T00:00:00+05:30'));
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });
});

describe('score (S1–S5)', () => {
  it('S1: k = 4, t = 50 s → 273', () => expect(score(4, 50_000)).toBe(273));
  it('S2: k = 4, t = 600 s → 45', () => expect(score(4, 600_000)).toBe(45));
  it('S3: k = 4 at 20 / 40 / 60 s → 375 > 300 > 250', () => {
    expect([20, 40, 60].map((s) => score(4, s * 1000))).toEqual([375, 300, 250]);
  });
  it('S4: loss or give up → 0 (replay never scores a loss); par and cap', () => {
    expect(par(4)).toBe(60);
    expect(GUESS_CAP).toBe(20);
    expect(score(4, -5)).toBe(500); // negative time clamps to 0
  });
  it('S5: ties broken by fewer guesses, then earlier finish', () => {
    const rows = [
      { name: 'c', timeMs: 30_000, nGuesses: 4, finishedAt: 3 },
      { name: 'b', timeMs: 30_000, nGuesses: 3, finishedAt: 9 },
      { name: 'a', timeMs: 30_000, nGuesses: 3, finishedAt: 5 },
      { name: 'z', timeMs: 29_999, nGuesses: 9, finishedAt: 99 },
    ];
    expect([...rows].sort(compareBoard).map((r) => r.name)).toEqual(['z', 'a', 'b', 'c']);
  });
});

const daily = (date: string, status: Attempt['status']): Attempt => ({
  attemptId: date,
  mode: 'daily',
  date,
  puzzleId: 'GJ-KL',
  startedAt: 0,
  guesses: [],
  status,
});

describe('streak (K1–K5)', () => {
  it('K1: finished 14, 15, 16 Oct → 3', () => {
    const s = streak([daily('2026-10-14', 'won'), daily('2026-10-15', 'lost'), daily('2026-10-16', 'won')], '2026-10-16');
    expect(s.streak).toBe(3);
  });
  it('K2: finished 14, missed 15, finished 16 → 1; best stays ≥ 1', () => {
    const s = streak([daily('2026-10-14', 'won'), daily('2026-10-16', 'won')], '2026-10-16');
    expect(s).toEqual({ streak: 1, best: 1, wins: 2 });
  });
  it('K3: won 14, lost 15, won 16 → 3; wins 2', () => {
    const s = streak([daily('2026-10-14', 'won'), daily('2026-10-15', 'lost'), daily('2026-10-16', 'won')], '2026-10-16');
    expect(s).toEqual({ streak: 3, best: 3, wins: 2 });
  });
  it('K4: gave up on 15 → streak continues', () => {
    const s = streak([daily('2026-10-14', 'won'), daily('2026-10-15', 'lost')], '2026-10-15');
    expect(s.streak).toBe(2);
  });
  it('K5: practice only on a day → that day counts as missed', () => {
    const practice: Attempt = { ...daily('2026-10-15', 'won'), mode: 'practice' };
    const s = streak([daily('2026-10-14', 'won'), practice, daily('2026-10-16', 'won')], '2026-10-16');
    expect(s.streak).toBe(1);
  });
  it('streak stays alive until the day after the last finished daily; unfinished never counts', () => {
    const a = [daily('2026-10-14', 'won'), daily('2026-10-15', 'won')];
    expect(streak(a, '2026-10-16').streak).toBe(2);
    expect(streak(a, '2026-10-17').streak).toBe(0);
    expect(streak([...a, daily('2026-10-16', 'playing')], '2026-10-16').streak).toBe(2);
    expect(streak(a, '2026-10-17').best).toBe(2);
    expect(addDays('2026-10-15', 1)).toBe('2026-10-16');
  });
});
