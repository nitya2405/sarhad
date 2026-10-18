// The Home hero's pins sit on Gujarat and Assam, and the route between them stays over Indian land.
import { describe, expect, it } from 'vitest';
import map from '../data/map.json';
import { HERO_PINS, heroRoute } from './Hero.tsx';

type Pt = readonly [number, number];
const regions = (map as { regions: Record<string, { d: string }> }).regions;

/** Rings of an absolute M/L/Z path. */
function rings(d: string): Pt[][] {
  return d
    .split(/Z/i)
    .map((s) => (s.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number))
    .filter((n) => n.length >= 6)
    .map((n) => Array.from({ length: n.length / 2 }, (_, i) => [n[2 * i], n[2 * i + 1]] as const));
}

const ringsById = Object.fromEntries(Object.entries(regions).map(([id, r]) => [id, rings(r.d)]));

/** Even-odd point-in-polygon over all rings of a region (holes and islands included). */
function inRegion(id: string, p: Pt): boolean {
  let inside = false;
  for (const r of ringsById[id]) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i];
      const [xj, yj] = r[j];
      if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

describe('Home hero', () => {
  it('puts each pin inside its state', () => {
    expect(inRegion('GJ', HERO_PINS.GJ)).toBe(true);
    expect(inRegion('AS', HERO_PINS.AS)).toBe(true);
  });

  it('keeps the whole route over Indian land (1000 samples per segment)', () => {
    const ids = Object.keys(regions);
    const offLand: string[] = [];
    for (const [a, b, c, d] of heroRoute()) {
      for (let i = 0; i <= 1000; i++) {
        const t = i / 1000;
        const p = [0, 1].map((n) => (1 - t) ** 3 * a[n] + 3 * (1 - t) ** 2 * t * b[n] + 3 * (1 - t) * t * t * c[n] + t ** 3 * d[n]) as unknown as Pt;
        if (!ids.some((id) => inRegion(id, p))) offLand.push(p.map(Math.round).join(','));
      }
    }
    expect(offLand).toEqual([]);
  });

  it('starts and ends the route on the pins', () => {
    const segs = heroRoute();
    expect(segs[0][0]).toEqual([...HERO_PINS.GJ]);
    expect(segs.at(-1)![3]).toEqual([...HERO_PINS.AS]);
  });
});
