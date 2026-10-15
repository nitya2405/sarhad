// Map label placement: few labels, never overlapping. Pure; units are the map's user units.
import type { RegionId } from '@engine/index.ts';

/** Regions too small to label in place: dot marker + leader line to a label outside the cluster. */
export const SMALL = new Set<RegionId>(['DL', 'CH', 'GA', 'TR', 'DD', 'SK']);

/** Leader direction for small regions, in screen px (scaled to map units at render time). */
export const LEADER: Record<RegionId, [number, number]> = {
  DL: [30, 14], // east, towards the open plain of UP
  CH: [-30, -16], // north-west, over Punjab's top
  GA: [-30, 0], // west, into the sea
  DD: [-32, 4], // west, into the sea
  TR: [-28, 18], // south-west, over Bangladesh (blank)
  SK: [0, -22], // north, over Tibet (blank)
};

/** Higher wins a collision: tapped tooltip > endpoint > latest guess. */
export const PRIORITY = { tooltip: 3, endpoint: 2, latest: 1 } as const;

export interface LabelBox {
  id: RegionId;
  priority: number;
  /** text anchor point */
  x: number;
  y: number;
  /** box size */
  w: number;
  h: number;
  anchor: 'start' | 'middle' | 'end';
}

/** Bounding box of a label: y is the text's vertical centre. */
export function boxOf(l: LabelBox): { x0: number; y0: number; x1: number; y1: number } {
  const x0 = l.anchor === 'start' ? l.x : l.anchor === 'end' ? l.x - l.w : l.x - l.w / 2;
  return { x0, y0: l.y - l.h / 2, x1: x0 + l.w, y1: l.y + l.h / 2 };
}

export function overlaps(a: LabelBox, b: LabelBox, pad = 0): boolean {
  const A = boxOf(a);
  const B = boxOf(b);
  return A.x0 - pad < B.x1 && B.x0 - pad < A.x1 && A.y0 - pad < B.y1 && B.y0 - pad < A.y1;
}

/**
 * Keeps labels greedily by priority (ties: earlier in the list wins); a label that overlaps
 * one already kept is hidden. Returns the ids to show.
 */
export function placeLabels(labels: LabelBox[], pad = 0): Set<RegionId> {
  const kept: LabelBox[] = [];
  const order = labels.map((l, i) => [l, i] as const).sort((a, b) => b[0].priority - a[0].priority || a[1] - b[1]);
  for (const [l] of order) if (!kept.some((k) => overlaps(k, l, pad))) kept.push(l);
  return new Set(kept.map((l) => l.id));
}

/** Rough text width for a system sans font: good enough for collision boxes. */
export function textWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.56;
}
