import { describe, expect, it } from 'vitest';
import { shortestDistance } from '@engine/index.ts';
import { adjacency, dailyPuzzle, getPuzzle, puzzles, regionById, schedule } from './data.ts';

describe('shipped data as the UI reads it', () => {
  it('R8: every revealed route re-validates edge by edge and is a shortest one', () => {
    for (const p of puzzles) {
      expect(p.shortest[0]).toBe(p.start);
      expect(p.shortest.at(-1)).toBe(p.end);
      expect(p.shortest).toHaveLength(p.k + 2);
      for (let i = 1; i < p.shortest.length; i++) expect(adjacency[p.shortest[i - 1]]).toContain(p.shortest[i]);
      expect(shortestDistance(p.start, p.end, adjacency)).toBe(p.k + 1);
    }
  });

  it('every daily date resolves to a known puzzle between two states', () => {
    for (const e of schedule!.entries) {
      const p = dailyPuzzle(e.date)!;
      expect(p).toBeDefined();
      expect(regionById.get(p.start)?.kind).toBe('state');
      expect(regionById.get(p.end)?.kind).toBe('state');
    }
    expect(getPuzzle('nope')).toBeUndefined();
  });
});
