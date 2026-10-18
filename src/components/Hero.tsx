import { useLayoutEffect, useRef, useState } from 'react';
import minimap from '../data/minimap.json';
import { useReducedMotion } from '../lib/hooks.ts';
import { PIN, SpriteRects } from './pixel.tsx';

const map = minimap as { viewBox: string; regions: Record<string, string> };

/**
 * Pins on real label points from map.json (map units): Gujarat and Assam. The route is a smooth curve
 * (Catmull-Rom through these waypoints) that stays over Indian land, threading the Siliguri corridor
 * north of Bangladesh; Hero.test.ts checks the pins and samples the whole route.
 */
export const HERO_PINS = { GJ: [130.2, 524.7], AS: [851.2, 407.6] } as const;
const WAYPOINTS: [number, number][] = [
  [...HERO_PINS.GJ],
  [390, 470], // Madhya Pradesh
  [600, 436], // Bihar
  [682, 418],
  [692, 401], // over Sikkim's southern tip, then the West Bengal corridor
  [706, 398],
  [724, 402],
  [746, 405],
  [...HERO_PINS.AS],
];

type P = [number, number];
/** The route as cubic Bézier segments [p1, c1, c2, p2] (Catmull-Rom → Bézier), in map units. */
export function heroRoute(): [P, P, P, P][] {
  const W = WAYPOINTS;
  return W.slice(0, -1).map((p1, i) => {
    const p0 = W[i - 1] ?? p1;
    const p2 = W[i + 1];
    const p3 = W[i + 2] ?? p2;
    const c1: P = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: P = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    return [p1, c1, c2, p2];
  });
}

const K = 0.2; // hero units per map unit (the 1000×1139 map at 1/5)
const k = ([x, y]: P) => `${(x * K).toFixed(2)} ${(y * K).toFixed(2)}`;
const segs = heroRoute();
const ROUTE = `M${k(segs[0][0])} ` + segs.map(([, c1, c2, p2]) => `C${k(c1)} ${k(c2)} ${k(p2)}`).join(' ');
const A = [HERO_PINS.GJ[0] * K, HERO_PINS.GJ[1] * K];
const B = [HERO_PINS.AS[0] * K, HERO_PINS.AS[1] * K];
const PIN_PX = 16; // on-screen pin height

/**
 * Home hero, static: India in white with soft red borders, pins on Gujarat and Assam, and a dashed ink
 * route between them that draws in once on load (600 ms); with reduced motion it is simply there.
 */
export function Hero({ className = '' }: { className?: string }) {
  const reduced = useReducedMotion();
  // hero units per screen px (meet), so the pins stay ~16 px tall at any width
  const ref = useRef<SVGSVGElement>(null);
  const [upp, setUpp] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width && r.height) setUpp(Math.max(200 / r.width, 228 / r.height));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const S = (PIN_PX / PIN.length) * upp; // hero units per sprite pixel
  return (
    <svg ref={ref} viewBox="0 0 200 228" className={className} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <g transform={`scale(${K})`} fill="#fff" fillOpacity="0.9" stroke="#f3b4b0" strokeWidth="1" strokeLinejoin="round">
        {Object.entries(map.regions).map(([id, d]) => (
          <path key={id} d={d} vectorEffect="non-scaling-stroke" />
        ))}
      </g>
      {!reduced && (
        <mask id="hero-route" maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="228">
          <path d={ROUTE} fill="none" stroke="#fff" strokeWidth="8" pathLength={1} className="route-draw" />
        </mask>
      )}
      <path
        d={ROUTE}
        fill="none"
        stroke="var(--color-ink)"
        strokeWidth="2.2"
        strokeDasharray="7 6"
        strokeLinecap="round"
        mask={reduced ? undefined : 'url(#hero-route)'}
      />
      {[A, B].map(([x, y], i) => (
        // the pin's tip (bottom centre of the sprite) sits exactly on the label point
        <g key={i} transform={`translate(${x - 4.5 * S} ${y - 11 * S}) scale(${S})`} shapeRendering="crispEdges">
          <SpriteRects rows={PIN} />
        </g>
      ))}
    </svg>
  );
}
