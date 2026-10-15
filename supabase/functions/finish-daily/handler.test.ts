import { describe, expect, it } from 'vitest';
import adjacency from '../../../data/adjacency.v1.json';
import regionsFile from '../../../data/regions.json';
import { decideFinish, parseBody } from './handler.ts';
import type { AttemptRow, FinishBody, GameData, ScheduleRow } from './handler.ts';

const regions = regionsFile.regions;
const DATA: GameData = {
  adj: adjacency as Record<string, string[]>,
  knownIds: new Set(regions.map((r) => r.id)),
  playableIds: new Set(regions.filter((r) => r.playable).map((r) => r.id)),
};

const ME = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';
const ATTEMPT_ID = '33333333-3333-3333-3333-333333333333';
const START = Date.parse('2026-10-16T04:30:00Z');

const schedule: ScheduleRow = { puzzle_id: 'GJ-KL', start_id: 'GJ', end_id: 'KL', k: 2 };
const playing: AttemptRow = {
  id: ATTEMPT_ID, player_id: ME, ist_date: '2026-10-16', puzzle_id: 'GJ-KL',
  started_at: new Date(START).toISOString(), status: 'playing', guesses: [], time_ms: null, points: null,
};

const decide = (guesses: string[], finished: boolean, over: Partial<{ attempt: AttemptRow; userId: string; nowMs: number }> = {}) =>
  decideFinish({
    userId: over.userId ?? ME,
    body: { attemptId: ATTEMPT_ID, guesses, finished } satisfies FinishBody,
    attempt: over.attempt ?? playing,
    schedule,
    nowMs: over.nowMs ?? START + 30_000,
    data: DATA,
  });

describe('finish-daily handler', () => {
  it('wins with a linked set; time = server finish − server start; points from score()', () => {
    // k = 2, par = 40 s, t = 30 s → round(300 · 40 / 70) = 171
    expect(decide(['MH', 'KA'], false)).toEqual({ kind: 'commit', status: 'won', guesses: ['MH', 'KA'], timeMs: 30_000, points: 171 });
  });

  it('P3: rejects another player\'s attempt', () => {
    expect(decide(['MH', 'KA'], false, { userId: OTHER })).toMatchObject({ kind: 'error', http: 403, error: 'not_owner' });
  });

  it('P2: an already finished attempt returns the stored result unchanged', () => {
    const done: AttemptRow = { ...playing, status: 'won', guesses: ['MH', 'KA'], time_ms: 12_345, points: 222 };
    expect(decide(['RJ'], true, { attempt: done })).toEqual({
      kind: 'stored', response: { status: 'won', timeMs: 12_345, points: 222, guesses: ['MH', 'KA'] },
    });
  });

  it('P4: rejects unknown ids, duplicates, endpoints, unplayable, guesses after the win', () => {
    expect(decide(['XX'], true)).toMatchObject({ kind: 'error', error: 'unknown' });
    expect(decide(['MH', 'MH'], true)).toMatchObject({ kind: 'error', error: 'duplicate' });
    expect(decide(['GJ'], true)).toMatchObject({ kind: 'error', error: 'endpoint' });
    expect(decide(['PY'], true)).toMatchObject({ kind: 'error', error: 'unplayable' });
    expect(decide(['MH', 'KA', 'RJ'], true)).toMatchObject({ kind: 'error', error: 'after_win' });
  });

  it('P4: rejects 21+ guesses and malformed bodies at parse time', () => {
    const ids = [...DATA.playableIds].filter((id) => id !== 'GJ' && id !== 'KL').slice(0, 21);
    expect(parseBody({ attemptId: ATTEMPT_ID, guesses: ids, finished: true })).toBe('too_many');
    expect(parseBody({ attemptId: 'nope', guesses: [], finished: true })).toBe('bad_attempt_id');
    expect(parseBody({ attemptId: ATTEMPT_ID, guesses: [1], finished: true })).toBe('bad_guesses');
    expect(parseBody({ attemptId: ATTEMPT_ID, guesses: [] })).toBe('bad_finished');
    expect(parseBody(null)).toBe('bad_body');
  });

  it('P5: an unlinked set is recorded as lost with 0 points, never won', () => {
    expect(decide(['RJ', 'DL', 'UP'], true)).toEqual({ kind: 'commit', status: 'lost', guesses: ['RJ', 'DL', 'UP'], timeMs: null, points: 0 });
  });

  it('unlinked and not finished is refused (no early finish)', () => {
    expect(decide(['RJ'], false)).toMatchObject({ kind: 'error', http: 400, error: 'not_finished' });
  });

  it('20 unlinked guesses end the game as lost even without finished=true', () => {
    const far = ['AR', 'AS', 'NL', 'MN', 'MZ', 'TR', 'ML', 'SK', 'WB', 'BR', 'JH', 'OD', 'UK', 'HP', 'JK', 'LA', 'PB', 'HR', 'DL', 'CH'];
    expect(decide(far, false)).toMatchObject({ kind: 'commit', status: 'lost', points: 0 });
  });

  it('missing attempt → 404', () => {
    expect(decideFinish({ userId: ME, body: { attemptId: ATTEMPT_ID, guesses: [], finished: true }, attempt: null, schedule, nowMs: 0, data: DATA }))
      .toMatchObject({ kind: 'error', http: 404 });
  });
});
