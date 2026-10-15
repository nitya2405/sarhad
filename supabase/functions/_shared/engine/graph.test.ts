import { describe, expect, it } from 'vitest';
import { isWon, linkedSet, shortestDistance, shortestRoute, shortestRouteWithin, validateGraph } from './graph.ts';
import { replay } from './replay.ts';
import type { Adjacency, Puzzle, DailySchedule, RegionId } from './types.ts';
import { adj, knownIds, playableIds, stateIds } from './fixtures/data.ts';

const ctx = (finished = false) => ({ adj, knownIds: new Set(knownIds), playableIds: new Set(playableIds), finished });
const foundShortest = (s: RegionId, e: RegionId, g: RegionId[]) =>
  shortestRouteWithin(s, e, g, adj)!.length - 1 === shortestDistance(s, e, adj);
const edgesValid = (route: RegionId[]) => route.every((id, i) => i === 0 || adj[route[i - 1]].includes(id));

describe('routes (R1–R10)', () => {
  it('R1: GJ→KL with MH, KA wins on 2 guesses and is a shortest route', () => {
    expect(replay('GJ', 'KL', ['MH', 'KA'], ctx())).toEqual({ ok: true, status: 'won', winningIndex: 1 });
    expect(foundShortest('GJ', 'KL', ['MH', 'KA'])).toBe(true);
  });

  it('R2: GJ→KL with RJ, MP, MH, KA wins on 4 guesses; one shortest route is shown', () => {
    expect(replay('GJ', 'KL', ['RJ', 'MP', 'MH', 'KA'], ctx())).toEqual({ ok: true, status: 'won', winningIndex: 3 });
    const shown = shortestRoute('GJ', 'KL', adj)!;
    expect(shown).toEqual(['GJ', 'MH', 'KA', 'KL']);
    expect(edgesValid(shown)).toBe(true);
  });

  it('R3: order does not matter — KA then MH wins on MH', () => {
    expect(isWon('GJ', 'KL', ['KA'], adj)).toBe(false);
    expect(replay('GJ', 'KL', ['KA', 'MH'], ctx())).toEqual({ ok: true, status: 'won', winningIndex: 1 });
  });

  it('R4: RJ, DL, UK — still playing; RJ coloured; DL, UK grey', () => {
    const g = ['RJ', 'DL', 'UK'];
    expect(isWon('GJ', 'KL', g, adj)).toBe(false);
    expect(linkedSet('GJ', 'KL', g, adj)).toEqual(new Set(['RJ']));
    expect(replay('GJ', 'KL', g, ctx())).toEqual({ ok: true, status: 'playing' });
  });

  it('R5: then UP — DL and UK turn coloured; still playing', () => {
    const g = ['RJ', 'DL', 'UK', 'UP'];
    expect(linkedSet('GJ', 'KL', g, adj)).toEqual(new Set(g));
    expect(isWon('GJ', 'KL', g, adj)).toBe(false);
    expect(replay('GJ', 'KL', g, ctx())).toEqual({ ok: true, status: 'playing' });
  });

  it('R6: UT step DD is coloured but not required', () => {
    expect(linkedSet('GJ', 'KL', ['DD'], adj)).toEqual(new Set(['DD']));
    expect(replay('GJ', 'KL', ['DD', 'MH', 'KA'], ctx())).toEqual({ ok: true, status: 'won', winningIndex: 2 });
    expect(shortestRouteWithin('GJ', 'KL', ['DD', 'MH', 'KA'], adj)).toEqual(['GJ', 'MH', 'KA', 'KL']);
  });

  it('R7: 20 guesses that never link → lost on the 20th', () => {
    const never = playableIds.filter((id) => !['GJ', 'KL', 'KA', 'TN'].includes(id)).slice(0, 20);
    expect(never).toHaveLength(20);
    expect(replay('GJ', 'KL', never.slice(0, 19), ctx())).toEqual({ ok: true, status: 'playing' });
    expect(replay('GJ', 'KL', never, ctx())).toEqual({ ok: true, status: 'lost' });
    expect(replay('GJ', 'KL', [...never, 'KA'], ctx())).toEqual({ ok: false, reason: 'too_many' });
  });

  it('R8: every state pair has a revealed route that re-validates edge by edge', () => {
    for (const a of stateIds) {
      for (const b of stateIds) {
        if (a >= b) continue;
        const r = shortestRoute(a, b, adj)!;
        expect(r[0]).toBe(a);
        expect(r[r.length - 1]).toBe(b);
        expect(r.length - 1).toBe(shortestDistance(a, b, adj));
        expect(edgesValid(r)).toBe(true);
      }
    }
  });

  it('R9: equal-length routes RJ→OD each win with the shortest-route message', () => {
    expect(shortestDistance('RJ', 'OD', adj)).toBe(3);
    for (const g of [['MP', 'CG'], ['UP', 'CG'], ['UP', 'JH']]) {
      expect(isWon('RJ', 'OD', g, adj)).toBe(true);
      expect(foundShortest('RJ', 'OD', g)).toBe(true);
    }
    expect(shortestRoute('RJ', 'OD', adj)).toEqual(['RJ', 'MP', 'CG', 'OD']); // lexicographic tie-break
  });

  it('R10: extras and cycles still win; colours correct', () => {
    const g = ['RJ', 'MP', 'MH', 'GA', 'TN', 'AS', 'KA'];
    expect(replay('GJ', 'KL', g, ctx())).toEqual({ ok: true, status: 'won', winningIndex: 6 });
    expect(linkedSet('GJ', 'KL', g, adj)).toEqual(new Set(['RJ', 'MP', 'MH', 'GA', 'TN', 'KA']));
  });
});

describe('replay rejections (server check)', () => {
  it('rejects unknown, endpoint, unplayable, duplicate, after-win', () => {
    expect(replay('GJ', 'KL', ['XX'], ctx())).toEqual({ ok: false, reason: 'unknown' });
    expect(replay('GJ', 'KL', ['GJ'], ctx())).toEqual({ ok: false, reason: 'endpoint' });
    expect(replay('GJ', 'KL', ['PY'], ctx())).toEqual({ ok: false, reason: 'unplayable' });
    expect(replay('GJ', 'KL', ['MH', 'MH'], ctx())).toEqual({ ok: false, reason: 'duplicate' });
    expect(replay('GJ', 'KL', ['MH', 'KA', 'TN'], ctx())).toEqual({ ok: false, reason: 'after_win' });
  });
  it('give up (finished) without a link is lost', () => {
    expect(replay('GJ', 'KL', ['MH'], ctx(true))).toEqual({ ok: true, status: 'lost' });
    expect(replay('GJ', 'KL', [], ctx(true))).toEqual({ ok: true, status: 'lost' });
  });
});

describe('graph invariants (V2, V3)', () => {
  const opts = { knownIds, playableIds };

  it('V2: committed adjacency is valid', () => {
    expect(validateGraph(adj, opts)).toEqual([]);
  });

  it('V3: asymmetric edge fails with a clear message', () => {
    const bad: Adjacency = { ...adj, GA: [...adj.GA, 'KL'] };
    expect(validateGraph(bad, opts).join('\n')).toMatch(/Asymmetric edge: "GA" lists "KL"/);
  });
  it('V3: unknown id fails', () => {
    const bad: Adjacency = { ...adj, GA: [...adj.GA, 'ZZ'], ZZ: ['GA'] };
    expect(validateGraph(bad, opts).join('\n')).toMatch(/Unknown region id "ZZ"/);
  });
  it('V3: self-edge, unplayable id, undrawn id, disconnected graph fail', () => {
    expect(validateGraph({ ...adj, GA: [...adj.GA, 'GA'] }, opts).join('\n')).toMatch(/Self-edge on "GA"/);
    expect(validateGraph({ ...adj, KL: [...adj.KL, 'PY'], PY: ['KL'] }, opts).join('\n')).toMatch(/"PY" is not playable/);
    expect(validateGraph(adj, { ...opts, drawnIds: knownIds.filter((id) => id !== 'DL') }).join('\n')).toMatch(/"DL" is not drawn/);
    const cut: Adjacency = { ...adj, SK: [], WB: adj.WB.filter((x) => x !== 'SK') };
    expect(validateGraph(cut, opts).join('\n')).toMatch(/not connected.*SK/);
  });
});

// V1 / V4 run against the generated data once Track A has written it.
const generated = import.meta.glob('../../../../src/data/{puzzles,daily}.json', { eager: true, import: 'default' });
const puzzlesRaw = generated['../../../../src/data/puzzles.json'] as Puzzle[] | { puzzles: Puzzle[] } | undefined;
const daily = generated['../../../../src/data/daily.json'] as DailySchedule | undefined;
const puzzles: Puzzle[] | undefined = puzzlesRaw && (Array.isArray(puzzlesRaw) ? puzzlesRaw : puzzlesRaw.puzzles);

describe.skipIf(!puzzles)('V1: generated puzzles', () => {
  it('ends are distinct states; 2 ≤ k ≤ 6; BFS distance = stored', () => {
    expect(puzzles!.length).toBeGreaterThan(0);
    for (const p of puzzles!) {
      expect(p.start).not.toBe(p.end);
      expect(stateIds).toContain(p.start);
      expect(stateIds).toContain(p.end);
      expect(p.k).toBeGreaterThanOrEqual(2);
      expect(p.k).toBeLessThanOrEqual(6);
      expect(shortestDistance(p.start, p.end, adj)).toBe(p.k + 1);
      expect(p.shortest).toHaveLength(p.k + 2);
      expect(p.shortest[0]).toBe(p.start);
      expect(p.shortest[p.shortest.length - 1]).toBe(p.end);
      expect(edgesValid(p.shortest)).toBe(true);
    }
  });
});

describe.skipIf(!puzzles || !daily)('V4: daily schedule', () => {
  it('every date has one valid puzzle; no unordered pair within 60 days', () => {
    const byId = new Map(puzzles!.map((p) => [p.id, p]));
    const entries = daily!.entries;
    expect(entries.length).toBeGreaterThanOrEqual(365);
    expect(entries[0].date).toBe('2026-10-15');
    const dates = new Set<string>();
    const lastSeen = new Map<string, number>();
    entries.forEach((e, i) => {
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(dates.has(e.date)).toBe(false);
      dates.add(e.date);
      const p = byId.get(e.puzzleId);
      expect(p, `unknown puzzle ${e.puzzleId}`).toBeDefined();
      const pair = [p!.start, p!.end].sort().join('-');
      const prev = lastSeen.get(pair);
      if (prev !== undefined) expect(i - prev).toBeGreaterThanOrEqual(60);
      lastSeen.set(pair, i);
    });
  });
});
