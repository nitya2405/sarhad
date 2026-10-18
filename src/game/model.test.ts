import { describe, expect, it } from 'vitest';
import adjJson from '../../data/adjacency.v1.json';
import { istDate, type Adjacency, type Puzzle } from '@engine/index.ts';
import { loadPlayer, savePlayer, STORAGE_KEY, SCHEMA_VERSION, type SavedPlayer } from './storage.ts';
import { activeAttempt, addGuess, findDaily, giveUp, startDailyAttempt, stats, upsertAttempt, createAttempt, youStats, resumeAfterPause } from './model.ts';

const adj = adjJson as Adjacency;
const GJ_KL: Puzzle = { id: 'GJ-KL', start: 'GJ', end: 'KL', k: 2, shortest: ['GJ', 'MH', 'KA', 'KL'] };

class MemStorage implements Storage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
}

/** Plays guesses on a stored daily and saves after each, like the UI does. */
function play(store: Storage, date: string, ids: string[], t0: number) {
  let p = loadPlayer(store);
  let { player, attempt } = startDailyAttempt(p, date, GJ_KL.id, t0, 'a1');
  savePlayer(player, store);
  ids.forEach((id, i) => {
    p = loadPlayer(store);
    attempt = addGuess(findDaily(p, date)!, id, GJ_KL, adj, t0 + (i + 1) * 10_000);
    savePlayer(upsertAttempt(p, attempt, date), store);
  });
  return loadPlayer(store);
}

describe('storage', () => {
  it('F4: corrupt JSON, wrong schema, v0 and junk attempts are discarded without crashing', () => {
    const s = new MemStorage();
    for (const raw of ['{not json', 'null', '42', JSON.stringify({ schemaVersion: 0, player: {} }), JSON.stringify({ streak: 3 })]) {
      s.setItem(STORAGE_KEY, raw);
      const p = loadPlayer(s);
      expect(p.attempts).toEqual([]);
      expect(typeof p.playerId).toBe('string');
    }
    s.setItem(
      STORAGE_KEY,
      JSON.stringify({ schemaVersion: SCHEMA_VERSION, player: { playerId: 'x', attempts: [{ attemptId: 1 }, null, 'junk'] } }),
    );
    expect(loadPlayer(s)).toMatchObject({ playerId: 'x', attempts: [] });
  });

  it('works when storage throws', () => {
    const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } } as unknown as Storage;
    expect(loadPlayer(broken).attempts).toEqual([]);
  });
});

describe('game model', () => {
  const t0 = Date.UTC(2026, 9, 16, 6, 0, 0);
  const date = istDate(t0);

  it('F1: refresh mid-game restores the same puzzle, guesses and start time', () => {
    const s = new MemStorage();
    const p = play(s, date, ['RJ'], t0);
    const a = activeAttempt(p)!;
    expect(a).toMatchObject({ puzzleId: 'GJ-KL', startedAt: t0, status: 'playing' });
    expect(a.guesses.map((g) => g.id)).toEqual(['RJ']);
  });

  it('F2: after finishing, the daily is done today with one stored score; Start rejoins it', () => {
    const s = new MemStorage();
    const p = play(s, date, ['MH', 'KA'], t0);
    const done = findDaily(p, date)!;
    expect(done.status).toBe('won');
    expect(done.points).toBeGreaterThan(0);
    expect(p.totalPoints).toBe(done.points);
    const again = startDailyAttempt(p, date, 'OTHER', t0 + 999_999, 'a2');
    expect(again.attempt.attemptId).toBe(done.attemptId);
    expect(again.player.attempts).toHaveLength(1);
  });

  it('F3: a finished attempt never moves backwards when a stale tab writes it', () => {
    const s = new MemStorage();
    const stale = findDaily(play(s, date, ['MH'], t0), date)!; // tab B's copy, still playing
    const p = play(s, date, ['MH', 'KA'], t0); // tab A wins
    const fromB = addGuess(stale, 'RJ', GJ_KL, adj, t0 + 60_000);
    const merged = upsertAttempt(p, fromB, date);
    expect(findDaily(merged, date)).toMatchObject({ status: 'won', guesses: [{ id: 'MH' }, { id: 'KA' }] });
    expect(merged.totalPoints).toBe(p.totalPoints);
  });

  it('T1: a daily started before IST midnight keeps its date and puzzle after it', () => {
    const start = Date.UTC(2026, 9, 16, 18, 29, 30); // 23:59:30 IST on 16 Oct
    const s = new MemStorage();
    const d = istDate(start);
    expect(d).toBe('2026-10-16');
    let p = loadPlayer(s);
    const { player, attempt } = startDailyAttempt(p, d, GJ_KL.id, start, 'm1');
    const after = start + 50_000; // 00:00:20 IST on 17 Oct
    const won = addGuess(addGuess(attempt, 'MH', GJ_KL, adj, after - 1), 'KA', GJ_KL, adj, after);
    p = upsertAttempt(player, won, istDate(after));
    expect(findDaily(p, '2026-10-16')).toMatchObject({ status: 'won', puzzleId: 'GJ-KL' });
    expect(findDaily(p, '2026-10-17')).toBeUndefined();
    expect(stats(p, '2026-10-17').streak).toBe(1);
  });

  it('R7: 20 guesses without a link → lost with 0 points; give up → lost', () => {
    const far = ['AR', 'AS', 'NL', 'MN', 'MZ', 'TR', 'ML', 'SK', 'WB', 'BR', 'JH', 'OD', 'UP', 'UK', 'HP', 'JK', 'LA', 'PB', 'HR', 'DL'];
    let a = createAttempt('daily', 'GJ-KL', date, t0, 'c');
    for (const id of far) a = addGuess(a, id, GJ_KL, adj, t0 + 1000);
    expect(a).toMatchObject({ status: 'lost', points: 0 });
    expect(a.guesses).toHaveLength(20);
    expect(giveUp(createAttempt('daily', 'GJ-KL', date, t0, 'g'), t0 + 5)).toMatchObject({ status: 'lost', points: 0 });
  });

  it('practice is unscored and never counts for the streak (K5)', () => {
    let p: SavedPlayer = loadPlayer(new MemStorage());
    let a = createAttempt('practice', 'GJ-KL', undefined, t0, 'p');
    a = addGuess(addGuess(a, 'MH', GJ_KL, adj, t0 + 1), 'KA', GJ_KL, adj, t0 + 2);
    p = upsertAttempt(p, a, date);
    expect(a.status).toBe('won');
    expect(a.points).toBeUndefined();
    expect(stats(p, date)).toMatchObject({ streak: 0, wins: 0, totalPoints: 0 });
  });
});

describe('youStats (the You panel)', () => {
  const GJ_TN: Puzzle = { id: 'GJ-TN', start: 'GJ', end: 'TN', k: 2, shortest: ['GJ', 'MH', 'KA', 'TN'] };
  const puzzleOf = (id: string) => ({ 'GJ-KL': GJ_KL, 'GJ-TN': GJ_TN })[id];
  const playable = new Set(['GJ', 'MH', 'KA', 'KL', 'TN', 'MP', 'RJ', 'GA']);
  const won = (id: string, puzzleId: string, guesses: string[], ms: number, extra = {}) => ({
    attemptId: id, mode: 'practice' as const, puzzleId, startedAt: 0, finishedAt: ms, status: 'won' as const,
    guesses: guesses.map((g, i) => ({ id: g, at: i + 1 })), ...extra,
  });
  it('counts states met, shortest wins and the fastest win', () => {
    const p: SavedPlayer = {
      playerId: 'p', streak: 0, best: 0, totalPoints: 0, prunedWins: 0,
      attempts: [
        won('a', 'GJ-KL', ['MH', 'KA'], 40_000), // shortest
        won('b', 'GJ-KL', ['MP', 'MH', 'GA', 'KA'], 90_000), // MP, GA spare: still a 2-state route inside → shortest
        won('c', 'GJ-TN', ['RJ', 'MP', 'MH', 'KA'], 30_000, { mode: 'daily', date: '2026-10-15', serverTimeMs: 31_000 }),
        { attemptId: 'd', mode: 'practice', puzzleId: 'GJ-TN', startedAt: 0, status: 'lost', finishedAt: 5, guesses: [{ id: 'AN', at: 1 }] },
        { attemptId: 'e', mode: 'practice', puzzleId: 'GJ-KL', startedAt: 0, status: 'playing', guesses: [{ id: 'PB', at: 1 }] },
      ],
    };
    const y = youStats(p, puzzleOf, adj, playable);
    expect([...y.discovered].sort()).toEqual(['GA', 'GJ', 'KA', 'KL', 'MH', 'MP', 'RJ', 'TN']); // AN not playable, PB unfinished
    expect(y.shortestRoutes).toBe(3);
    expect(y.fastestMs).toBe(31_000); // official server time wins over the local one
  });
  it('empty player', () => {
    const y = youStats({ playerId: 'p', streak: 0, best: 0, totalPoints: 0, prunedWins: 0, attempts: [] }, puzzleOf, adj, playable);
    expect(y).toEqual({ discovered: new Set(), shortestRoutes: 0, fastestMs: null });
  });
});

describe('resumeAfterPause (give-up pop-up)', () => {
  const base = { attemptId: 'x', puzzleId: 'GJ-KL', startedAt: 1_000, status: 'playing' as const, guesses: [{ id: 'MH', at: 3_000 }] };
  it('practice: start and guess times move forward by the pause', () => {
    expect(resumeAfterPause({ ...base, mode: 'practice' }, 5_000)).toMatchObject({ startedAt: 6_000, guesses: [{ id: 'MH', at: 8_000 }] });
  });
  it('daily, finished, or no pause: unchanged', () => {
    const daily = { ...base, mode: 'daily' as const, date: '2026-10-15' };
    expect(resumeAfterPause(daily, 5_000)).toBe(daily);
    const done = { ...base, mode: 'practice' as const, status: 'lost' as const, finishedAt: 9_000 };
    expect(resumeAfterPause(done, 5_000)).toBe(done);
    const p = { ...base, mode: 'practice' as const };
    expect(resumeAfterPause(p, 0)).toBe(p);
    expect(resumeAfterPause(p, -3)).toBe(p);
  });
});
