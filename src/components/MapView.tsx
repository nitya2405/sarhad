import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { RegionId } from '@engine/index.ts';
import { adjacency, loadMap, mapLabel, type MapData } from '../lib/data.ts';
import { LEADER, PRIORITY, SMALL, placeLabels, textWidth, type LabelBox } from '../lib/labels.ts';
import { useReducedMotion } from '../lib/hooks.ts';

let mapPromise: Promise<MapData | null> | null = null;

/** Lazily loaded map (separate chunk); null if it failed — the game stays playable without it (F6). */
function useMapData(): MapData | null | undefined {
  const [map, setMap] = useState<MapData | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    (mapPromise ??= loadMap()).then((m) => live && setMap(m));
    return () => {
      live = false;
    };
  }, []);
  return map;
}

/** Map user units per screen px, kept current as the SVG resizes. */
function useUnitsPerPx(ref: RefObject<SVGSVGElement | null>, vb: number[] | null): number {
  const [upp, setUpp] = useState(3);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !vb) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width && r.height) setUpp(Math.max(vb[2] / r.width, vb[3] / r.height));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, vb]);
  return upp;
}

/** Hop distance from `from` to each id, moving only through `within`. */
function hops(from: RegionId | undefined, within: Set<RegionId>): Map<RegionId, number> {
  const d = new Map<RegionId, number>();
  if (!from || !within.has(from)) return d;
  d.set(from, 0);
  const q = [from];
  for (let i = 0; i < q.length; i++) {
    for (const nb of adjacency[q[i]] ?? []) {
      if (within.has(nb) && !d.has(nb)) {
        d.set(nb, d.get(q[i])! + 1);
        q.push(nb);
      }
    }
  }
  return d;
}

interface Fresh {
  nonce: number;
  /** newly connected region → delay ms (chain order, 60 ms apart) */
  regions: Map<RegionId, number>;
  /** new stitch 'A-B' (drawn from A) → delay ms */
  edges: Map<string, number>;
  pop?: RegionId;
}

interface Props {
  /** undefined: pair still hidden */
  start?: RegionId;
  end?: RegionId;
  guesses?: RegionId[];
  linked?: Set<RegionId>;
  /** the newest guess, labelled on the map */
  latest?: RegionId;
  /** result screen: route drawn as a thread */
  route?: RegionId[];
  /** draw the route in (reveal of one shortest route) */
  revealRoute?: boolean;
  /** win: one pulse along the route + endpoint glow */
  celebrate?: boolean;
  labels?: boolean;
  /** tap a guessed region to see its name */
  interactive?: boolean;
  className?: string;
}

const EMPTY: RegionId[] = [];

export function MapView({
  start,
  end,
  guesses = EMPTY,
  linked,
  latest,
  route,
  revealRoute,
  celebrate,
  labels = true,
  interactive = false,
  className = '',
}: Props) {
  const map = useMapData();
  const svgRef = useRef<SVGSVGElement>(null);
  const reduced = useReducedMotion();
  const vb = useMemo(
    () => (map ? (Array.isArray(map.viewBox) ? map.viewBox : map.viewBox.split(/[\s,]+/).map(Number)) : null),
    [map],
  );
  const u = useUnitsPerPx(svgRef, vb); // map units per screen px
  const [tip, setTip] = useState<RegionId>();

  // Connected set: endpoints + guesses linked to them.
  const connected = useMemo(() => {
    const c = new Set<RegionId>();
    if (start && end) {
      c.add(start).add(end);
      for (const g of guesses) if (linked?.has(g)) c.add(g);
    }
    return c;
  }, [start, end, guesses, linked]);
  const connectedKey = [...connected].sort().join(',');

  const edges = useMemo(() => {
    const out: [RegionId, RegionId][] = [];
    for (const a of connected) for (const b of adjacency[a] ?? []) if (a < b && connected.has(b)) out.push([a, b]);
    return out;
  }, [connected]);

  // Animate only what changed since the last render (never on mount or resume).
  const prev = useRef<Set<RegionId> | null>(null);
  const [fresh, setFresh] = useState<Fresh | null>(null);
  useLayoutEffect(() => {
    const before = prev.current;
    prev.current = connected;
    if (!before || reduced) return;
    const added = [...connected].filter((id) => !before.has(id));
    if (!added.length) return;
    const dist = hops(latest && connected.has(latest) ? latest : added[0], connected);
    const regions = new Map(added.map((id) => [id, (dist.get(id) ?? 0) * 60]));
    const edgeDelays = new Map<string, number>();
    for (const [a, b] of edges) {
      if (before.has(a) && before.has(b)) continue;
      const [from, to] = (dist.get(a) ?? 99) <= (dist.get(b) ?? 99) ? [a, b] : [b, a];
      edgeDelays.set(`${from}-${to}`, 220 + (dist.get(from) ?? 0) * 60);
    }
    setFresh({ nonce: Date.now(), regions, edges: edgeDelays, pop: latest && added.includes(latest) ? latest : undefined });
    const t = setTimeout(() => setFresh(null), 1500);
    return () => clearTimeout(t);
  }, [connectedKey]);

  useEffect(() => {
    if (!tip) return;
    const t = setTimeout(() => setTip(undefined), 2000);
    return () => clearTimeout(t);
  }, [tip]);

  if (map === undefined) return <div className={className} aria-hidden="true" />;
  if (map === null || !map.regions || !vb) {
    return (
      <p className={`${className} flex items-center justify-center p-4 text-center text-sm text-muted`}>
        Map unavailable. Your guesses below are all you need.
      </p>
    );
  }

  const guessed = new Set(guesses);
  const pt = (id: RegionId) => map.regions[id]?.label;
  const state = (id: RegionId): 'end' | 'on' | 'off' | 'land' =>
    id === start || id === end ? 'end' : connected.has(id) ? 'on' : guessed.has(id) ? 'off' : 'land';
  const FILL = { end: 'var(--color-red)', on: 'var(--color-red)', off: 'var(--color-slate)', land: 'var(--color-land)' };
  const STROKE = { end: 'var(--color-ink)', on: 'var(--color-ink)', off: 'var(--color-muted)', land: 'var(--color-border)' };

  // Labels: endpoints always, the latest guess, and a tapped region; collisions hide the lower priority.
  const fs = 12 * u;
  const candidates: (LabelBox & { leader?: [number, number] })[] = [];
  const addLabel = (id: RegionId | undefined, priority: number) => {
    const p = id && pt(id);
    if (!id || !p || candidates.some((c) => c.id === id)) return;
    const text = mapLabel(id);
    const w = textWidth(text, fs) + 4 * u;
    const h = fs * 1.25;
    if (SMALL.has(id)) {
      const [dx, dy] = LEADER[id] ?? [0, -20];
      const x = p[0] + dx * u;
      const y = p[1] + dy * u;
      const anchor = dx > 4 ? 'start' : dx < -4 ? 'end' : 'middle';
      candidates.push({ id, priority, x, y, w, h, anchor, leader: [p[0], p[1]] });
    } else {
      candidates.push({ id, priority, x: p[0], y: p[1], w, h, anchor: 'middle' });
    }
  };
  if (labels) {
    addLabel(tip, PRIORITY.tooltip);
    addLabel(start, PRIORITY.endpoint);
    addLabel(end, PRIORITY.endpoint);
    addLabel(latest, PRIORITY.latest);
  }
  const shown = placeLabels(candidates, 2 * u);
  const revealed = new Set([...(start ? [start] : []), ...(end ? [end] : []), ...guesses]);

  const sw = 2.5 * u;
  const dash = `${6 * u} ${5 * u}`;
  const routePts = route?.map(pt).filter(Boolean) as [number, number][] | undefined;
  const entries = Object.entries(map.regions);
  const nonce = fresh?.nonce ?? 0;

  return (
    <svg
      ref={svgRef}
      viewBox={vb.join(' ')}
      className={className}
      role="img"
      aria-label={start && end ? `Map: ${mapLabel(start)} to ${mapLabel(end)}` : 'Map of India'}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <pattern id="hatch" patternUnits="userSpaceOnUse" width={6 * u} height={6 * u} patternTransform="rotate(45)">
          <rect width={6 * u} height={6 * u} fill="var(--color-slate)" />
          <line x1="0" y1="0" x2="0" y2={6 * u} stroke="#fff" strokeOpacity={0.55} strokeWidth={2 * u} />
        </pattern>
      </defs>

      <g strokeLinejoin="round">
        {entries.map(([id, r]) => {
          const s = state(id);
          const delay = fresh?.regions.get(id);
          const p = r.label;
          const pop = fresh?.pop === id;
          return (
            <path
              key={pop ? `${id}-${nonce}` : id}
              d={r.d}
              fill={FILL[s]}
              stroke={STROKE[s]}
              strokeWidth={s === 'land' ? 1 : 1.5}
              vectorEffect="non-scaling-stroke"
              className={`region ${s}${pop ? ' pop' : ''}`}
              style={{
                ...(delay !== undefined ? { transitionDelay: `${delay}ms` } : {}),
                ...(pop ? { transformOrigin: `${p[0]}px ${p[1]}px` } : {}),
              }}
              onClick={interactive && revealed.has(id) ? () => setTip(id) : undefined}
            />
          );
        })}
        {/* hatch marks accepted-but-not-connected guesses (colour is never the only signal) */}
        {entries
          .filter(([id]) => state(id) === 'off')
          .map(([id, r]) => (
            <path key={`h-${id}`} d={r.d} fill="url(#hatch)" className="fade-in" pointerEvents="none" />
          ))}
      </g>

      {/* the stitch: a running thread between connected neighbours */}
      <g fill="none" strokeLinecap="round" pointerEvents="none">
        {edges.map(([a, b]) => {
          const key = fresh?.edges.has(`${a}-${b}`) ? `${a}-${b}` : fresh?.edges.has(`${b}-${a}`) ? `${b}-${a}` : null;
          const [from, to] = key ? (key.split('-') as [RegionId, RegionId]) : [a, b];
          const p = pt(from);
          const q = pt(to);
          if (!p || !q) return null;
          const maskId = key ? `m-${key}-${nonce}` : undefined;
          return (
            <g key={`${a}-${b}${key ? `-${nonce}` : ''}`}>
              {maskId && (
                <mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={vb[2]} height={vb[3]}>
                  <line
                    x1={p[0]}
                    y1={p[1]}
                    x2={q[0]}
                    y2={q[1]}
                    stroke="#fff"
                    strokeWidth={10 * u}
                    pathLength={1}
                    className="stitch-draw"
                    style={{ animationDelay: `${fresh!.edges.get(key!)}ms` }}
                  />
                </mask>
              )}
              <g mask={maskId ? `url(#${maskId})` : undefined}>
                <line x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke="#fff" strokeWidth={sw + 4 * u} strokeDasharray={dash} />
                <line x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke="var(--color-ink)" strokeWidth={sw} strokeDasharray={dash} />
              </g>
            </g>
          );
        })}
      </g>

      {/* result: the route as a thread (drawn in when revealing one shortest route) */}
      {routePts && routePts.length > 1 && (
        <g fill="none" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none">
          {revealRoute && !reduced && (
            <mask id="m-route" maskUnits="userSpaceOnUse" x={0} y={0} width={vb[2]} height={vb[3]}>
              <polyline
                points={routePts.map((p) => p.join(',')).join(' ')}
                stroke="#fff"
                strokeWidth={10 * u}
                pathLength={1}
                className="stitch-draw"
                style={{ animationDuration: '900ms', animationDelay: '300ms' }}
              />
            </mask>
          )}
          <g mask={revealRoute && !reduced ? 'url(#m-route)' : undefined}>
            <polyline points={routePts.map((p) => p.join(',')).join(' ')} stroke="#fff" strokeWidth={sw + 4 * u} strokeDasharray={dash} />
            <polyline
              points={routePts.map((p) => p.join(',')).join(' ')}
              stroke={revealRoute ? 'var(--color-red-lip)' : 'var(--color-ink)'}
              strokeWidth={sw}
              strokeDasharray={dash}
            />
          </g>
          {celebrate && (
            <polyline points={routePts.map((p) => p.join(',')).join(' ')} stroke="#fff" strokeWidth={4 * u} pathLength={1} className="route-pulse" />
          )}
        </g>
      )}
      {celebrate && start && end && (
        <g fill="none" pointerEvents="none">
          {[start, end].map((id) => (
            <path key={`glow-${id}`} d={map.regions[id].d} stroke="var(--color-ink)" vectorEffect="non-scaling-stroke" className="glow" />
          ))}
        </g>
      )}

      {/* small regions: dot marker when revealed, larger invisible hit area */}
      {entries
        .filter(([id]) => SMALL.has(id))
        .map(([id, r]) => {
          const s = state(id);
          return (
            <g key={`s-${id}`}>
              {s !== 'land' && (
                <circle cx={r.label[0]} cy={r.label[1]} r={4 * u} fill={FILL[s]} stroke="var(--color-ink)" strokeWidth={u} />
              )}
              {interactive && (
                <circle cx={r.label[0]} cy={r.label[1]} r={16 * u} fill="transparent" onClick={revealed.has(id) ? () => setTip(id) : undefined} />
              )}
            </g>
          );
        })}

      {labels && (
        <g aria-hidden="true">
          {candidates
            .filter((c) => shown.has(c.id))
            .map((c) => (
              <g key={`l-${c.id}`}>
                {c.leader && (
                  <line
                    x1={c.leader[0]}
                    y1={c.leader[1]}
                    x2={c.x - (c.anchor === 'start' ? 2 * u : c.anchor === 'end' ? -2 * u : 0)}
                    y2={c.y + (c.anchor === 'middle' ? fs * 0.6 : 0)}
                    stroke="var(--color-ink)"
                    strokeWidth={u}
                  />
                )}
                <text
                  x={c.x}
                  y={c.y}
                  fontSize={fs}
                  textAnchor={c.anchor}
                  dominantBaseline="central"
                  strokeWidth={4 * u}
                  className={`map-label${!c.leader && (state(c.id) === 'end' || state(c.id) === 'on') ? ' on-red' : ''}`}
                >
                  {mapLabel(c.id)}
                </text>
              </g>
            ))}
        </g>
      )}

      {/* "+1" bounce beside a newly connected region (not drawn with reduced motion: fresh stays null) */}
      {fresh?.pop && pt(fresh.pop) && (
        <text
          key={`plus-${nonce}`}
          x={pt(fresh.pop)![0] + 14 * u}
          y={pt(fresh.pop)![1] - 10 * u}
          fontSize={15 * u}
          strokeWidth={4 * u}
          textAnchor="start"
          dominantBaseline="central"
          className="plus-one"
          style={{ ['--rise' as string]: `${-12 * u}px` }}
          aria-hidden="true"
        >
          +1
        </text>
      )}
    </svg>
  );
}
