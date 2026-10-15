import { describe, expect, it } from 'vitest';
import { PRIORITY, overlaps, placeLabels, type LabelBox } from './labels.ts';

const L = (id: string, priority: number, x: number, y: number, w = 40, h = 12): LabelBox => ({ id, priority, x, y, w, h, anchor: 'middle' });

describe('label collision priority', () => {
  it('overlapping labels: endpoint beats latest guess', () => {
    const shown = placeLabels([L('HR', PRIORITY.latest, 289, 315), L('PB', PRIORITY.endpoint, 296, 318)]);
    expect([...shown]).toEqual(['PB']);
  });
  it('tooltip beats endpoint', () => {
    const shown = placeLabels([L('PB', PRIORITY.endpoint, 266, 254), L('CH', PRIORITY.tooltip, 270, 256)]);
    expect([...shown]).toEqual(['CH']);
  });
  it('both endpoints overlapping: the first listed is kept', () => {
    expect([...placeLabels([L('AS', PRIORITY.endpoint, 100, 100), L('ML', PRIORITY.endpoint, 105, 102)])]).toEqual(['AS']);
  });
  it('non-overlapping labels all stay', () => {
    const shown = placeLabels([L('GJ', 2, 130, 525), L('KL', 2, 291, 1036), L('MH', 1, 248, 678)]);
    expect(shown).toEqual(new Set(['GJ', 'KL', 'MH']));
  });
  it('anchors shift the box', () => {
    const a: LabelBox = { id: 'A', priority: 1, x: 100, y: 50, w: 40, h: 10, anchor: 'start' };
    const b: LabelBox = { id: 'B', priority: 1, x: 95, y: 50, w: 40, h: 10, anchor: 'end' };
    expect(overlaps(a, b)).toBe(false); // A spans 100..140, B spans 55..95
  });
});
