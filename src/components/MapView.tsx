import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { RegionId } from '@engine/index.ts';
import { adjacency, loadMap, mapLabel, type MapData } from '../lib/data.ts';
import { LEADER, PRIORITY, SMALL, placeLabels, textWidth, type LabelBox } from '../lib/labels.ts';
import { useReducedMotion } from '../lib/hooks.ts';
import minimap from '../data/minimap.json';

const mini = minimap as { viewBox: string; regions: Record<string, string> };

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

/**
 * Element size in CSS px, kept current. `stableHeight`: once measured, a change in height alone is
 * ignored (only a width change re-measures), so the zoom never reacts to the on-screen keyboard.
 */
function useSize(ref: RefObject<HTMLElement | null>, stableHeight = false): { w: number; h: number } {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize((p) =>
        (p.w === r.width && p.h === r.height) || (stableHeight && p.h > 0 && p.w === r.width) ? p : { w: r.width, h: r.height },
      );
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, stableHeight]);
  return size;
}

type Box = [number, number, number, number]; // x0, y0, x1, y1

/** Bounding box of an absolute M/L/Z path. */
function pathBox(d: string): Box {
  const n = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const b: Box = [Infinity, Infinity, -Infinity, -Infinity];
  for (let i = 0; i + 1 < n.length; i += 2) {
    b[0] = Math.min(b[0], n[i]);
    b[1] = Math.min(b[1], n[i + 1]);
    b[2] = Math.max(b[2], n[i]);
    b[3] = Math.max(b[3], n[i + 1]);
  }
  return b;
}

/**
 * Auto-zoom: the box + 18% padding on each side, at least 35% of India's width, fitted to the panel's
 * aspect ratio and kept inside the map. If that view would reach past India, or would barely zoom (wider
 * than 80% of India), show all of India with a small margin instead: endpoints always fully in view, and
 * no hard cut through land unless the zoom is real.
 */
function fitView(box: Box, base: number[], aspect: number): number[] {
  const fit = (w: number, h: number) => (w / h < aspect ? [h * aspect, h] : [w, w / aspect]);
  const [w, h] = fit(Math.max((box[2] - box[0]) * 1.36, base[2] * 0.35), (box[3] - box[1]) * 1.36);
  // Barely zoomed (wider than 80% of India) would only shave the coasts: show all of India instead.
  if (w > base[2] * 0.8 || h > base[3]) {
    const [fw, fh] = fit(base[2] * 1.06, base[3] * 1.06);
    return [base[0] + (base[2] - fw) / 2, base[1] + (base[3] - fh) / 2, fw, fh];
  }
  // Kept inside the map, but never flush with its edge: a 3% margin so a coast is not cut by the frame.
  const mx = base[2] * 0.03;
  const my = base[3] * 0.03;
  const x = Math.min(Math.max((box[0] + box[2]) / 2 - w / 2, base[0] - mx), base[0] + base[2] - w + mx);
  const y = Math.min(Math.max((box[1] + box[3]) / 2 - h / 2, base[1] - my), base[1] + base[3] - h + my);
  return [x, y, w, h];
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
  /** a route drawn as its own thread: the win pulse in the game, or "Show shortest route" on Result */
  route?: RegionId[];
  /** draw the route in as a separate ink line (one shortest route, shown on request) */
  revealRoute?: boolean;
  /** win: one pulse along the route + endpoint glow */
  celebrate?: boolean;
  labels?: boolean;
  /** tap a guessed region to see its name */
  interactive?: boolean;
  /** zoom to the endpoints, guesses and `focus` (animated); otherwise all of India */
  zoom?: boolean;
  /** extra regions to keep in view when zoomed (e.g. the shortest route once shown) */
  focus?: RegionId[];
  /** small full-India inset with the current view, when zoomed in */
  inset?: boolean;
  /** the zoom follows the panel's width only, never a change in its height */
  stableHeight?: boolean;
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
  zoom = false,
  focus = EMPTY,
  inset = false,
  stableHeight = false,
  className = '',
}: Props) {
  const map = useMapData();
  const boxRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const vb = useMemo(
    () => (map ? (Array.isArray(map.viewBox) ? map.viewBox : map.viewBox.split(/[\s,]+/).map(Number)) : null),
    [map],
  );
  const size = useSize(boxRef, stableHeight);
  const boxes = useMemo(
    () => (map?.regions ? (Object.fromEntries(Object.entries(map.regions).map(([id, r]) => [id, pathBox(r.d)])) as Record<RegionId, Box>) : null),
    [map],
  );

  // Target view: zoomed to the endpoints + guesses (+ focus), or the whole map.
  const inViewKey = zoom ? [start, end, ...guesses, ...focus].filter(Boolean).join(',') : '';
  const target = useMemo(() => {
    if (!vb || !boxes || !size.w || !size.h) return null;
    const ids = inViewKey ? inViewKey.split(',').filter((id) => boxes[id]) : [];
    if (!ids.length) return vb;
    const b: Box = [Infinity, Infinity, -Infinity, -Infinity];
    for (const id of ids) {
      const r = boxes[id];
      b[0] = Math.min(b[0], r[0]);
      b[1] = Math.min(b[1], r[1]);
      b[2] = Math.max(b[2], r[2]);
      b[3] = Math.max(b[3], r[3]);
    }
    return fitView(b, vb, size.w / size.h);
  }, [vb, boxes, size.w, size.h, inViewKey]);

  // Animated viewBox (300 ms ease-out); instant the first time and with reduced motion.
  const [view, setView] = useState<number[] | null>(null);
  const viewRef = useRef<number[] | null>(null);
  useEffect(() => {
    if (!target) return;
    const from = viewRef.current;
    if (!from || reduced || typeof requestAnimationFrame !== 'function') {
      viewRef.current = target;
      setView(target);
      return;
    }
    if (from.every((v, i) => Math.abs(v - target[i]) < 0.5)) return;
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 300);
      const e = 1 - (1 - k) ** 3;
      const v = from.map((f, i) => f + (target[i] - f) * e);
      viewRef.current = v;
      setView(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, reduced]);

  const V = view ?? vb ?? [0, 0, 1000, 1139];
  const u = size.w && size.h ? Math.max(V[2] / size.w, V[3] / size.h) : 3; // map units per screen px
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

  // Stitches follow a spanning tree of the connected set: BFS from the start (then the end), each region
  // joins the one already-joined neighbour that reached it first. No triangles, no zigzags, only land borders.
  const edges = useMemo(() => {
    const out: [RegionId, RegionId][] = [];
    const joined = new Set<RegionId>();
    for (const root of [start, end]) {
      if (!root || !connected.has(root) || joined.has(root)) continue;
      joined.add(root);
      const queue = [root];
      for (let i = 0; i < queue.length; i++) {
        for (const nb of adjacency[queue[i]] ?? []) {
          if (connected.has(nb) && !joined.has(nb)) {
            joined.add(nb);
            out.push([queue[i], nb]);
            queue.push(nb);
          }
        }
      }
    }
    return out;
  }, [connected, start, end]);

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

  if (map === undefined) return <div ref={boxRef} className={className} aria-hidden="true" />;
  if (map === null || !map.regions || !vb) {
    return (
      <div ref={boxRef} className={`${className} flex items-center justify-center p-4 text-center text-sm text-muted`}>
        Map unavailable. Your guesses below are all you need.
      </div>
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
  const edge = 4 * u; // labels stay this far inside the view
  /** One line if it fits the view; else two lines ("Arunachal / Pradesh"); else the short form. */
  const fitLines = (text: string): string[] => {
    const room = V[2] - 2 * edge - 4 * u;
    if (textWidth(text, fs) <= room) return [text];
    const words = text.split(' ');
    if (words.length > 1) {
      let best = [text];
      let widest = Infinity;
      for (let i = 1; i < words.length; i++) {
        const two = [words.slice(0, i).join(' '), words.slice(i).join(' ')];
        const m = Math.max(...two.map((l) => textWidth(l, fs)));
        if (m < widest) [best, widest] = [two, m];
      }
      if (widest <= room) return best;
    }
    return [words[0]];
  };
  const clamp = (v: number, lo: number, hi: number) => (lo > hi ? (lo + hi) / 2 : Math.min(Math.max(v, lo), hi));
  const candidates: (LabelBox & { leader?: [number, number]; lines: string[] })[] = [];
  const addLabel = (id: RegionId | undefined, priority: number) => {
    const p = id && pt(id);
    if (!id || !p || candidates.some((c) => c.id === id)) return;
    const lines = fitLines(mapLabel(id));
    const w = Math.max(...lines.map((l) => textWidth(l, fs))) + 4 * u;
    const h = fs * 1.25 * lines.length;
    let x = p[0];
    let y = p[1];
    let anchor: LabelBox['anchor'] = 'middle';
    let leader: [number, number] | undefined;
    if (SMALL.has(id)) {
      const [dx, dy] = LEADER[id] ?? [0, -20];
      x += dx * u;
      y += dy * u;
      anchor = dx > 4 ? 'start' : dx < -4 ? 'end' : 'middle';
      leader = [p[0], p[1]];
    }
    // keep the whole label box inside the view
    const [x0, x1] = [V[0] + edge, V[0] + V[2] - edge];
    if (anchor === 'middle') x = clamp(x, x0 + w / 2, x1 - w / 2);
    else if (anchor === 'start') x = clamp(x, x0, x1 - w);
    else x = clamp(x, x0 + w, x1);
    y = clamp(y, V[1] + edge + h / 2, V[1] + V[3] - edge - h / 2);
    candidates.push({ id, priority, x, y, w, h, anchor, leader, lines });
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

  const zoomedIn = !!(zoom && view && (view[2] < vb[2] * 0.98 || view[3] < vb[3] * 0.98));
  // The inset sits top-right, or top-left if it would cover an endpoint (hidden if both corners would).
  const sc = size.w && size.h ? Math.min(size.w / V[2], size.h / V[3]) : 0;
  const ox = (size.w - V[2] * sc) / 2;
  const oy = (size.h - V[3] * sc) / 2;
  const INSET: [number, number] = [68, 77]; // 64 px wide + border, India's aspect
  const covers = (r: Box) =>
    [start, end].some((id) => {
      const b = id && boxes?.[id];
      if (!b) return false;
      const e: Box = [ox + (b[0] - V[0]) * sc, oy + (b[1] - V[1]) * sc, ox + (b[2] - V[0]) * sc, oy + (b[3] - V[1]) * sc];
      return e[0] < r[2] + 4 && r[0] - 4 < e[2] && e[1] < r[3] + 4 && r[1] - 4 < e[3];
    });
  const insetSide = !covers([size.w - 4 - INSET[0], 4, size.w - 4, 4 + INSET[1]])
    ? 'right-1'
    : !covers([4, 4, 4 + INSET[0], 4 + INSET[1]])
      ? 'left-1'
      : null;
  return (
    <div ref={boxRef} className={/\b(absolute|fixed)\b/.test(className) ? className : `relative ${className}`}>
      <svg
        viewBox={V.join(' ')}
        className="absolute inset-0 h-full w-full"
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
              data-region={id}
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
              <polyline
                points={routePts.map((p) => p.join(',')).join(' ')}
                stroke="#fff"
                strokeWidth={(revealRoute ? 2 * u : sw) + 4 * u}
                strokeDasharray={revealRoute ? undefined : dash}
              />
              <polyline
                points={routePts.map((p) => p.join(',')).join(' ')}
                stroke="var(--color-ink)"
                strokeWidth={revealRoute ? 2 * u : sw}
                strokeDasharray={revealRoute ? `${11 * u} ${6 * u}` : dash}
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
                  {c.lines.map((line, i) => (
                    <text
                      key={i}
                      x={c.x}
                      y={c.y + (i - (c.lines.length - 1) / 2) * fs * 1.2}
                      fontSize={fs}
                      textAnchor={c.anchor}
                      dominantBaseline="central"
                      strokeWidth={4 * u}
                      className={`map-label${!c.leader && (state(c.id) === 'end' || state(c.id) === 'on') ? ' on-red' : ''}`}
                    >
                      {line}
                    </text>
                  ))}
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
      {inset && zoomedIn && insetSide && (
        <svg
          viewBox={mini.viewBox}
          className={`absolute top-1 ${insetSide} w-16 rounded-md border-2 border-ink bg-white`}
          data-inset=""
          aria-hidden="true"
        >
          {Object.entries(mini.regions).map(([id, d]) => (
            <path key={id} d={d} fill="var(--color-land)" stroke="var(--color-border)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}
          <rect x={V[0]} y={V[1]} width={V[2]} height={V[3]} fill="rgb(220 38 38 / 0.15)" stroke="var(--color-red)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </svg>
      )}
    </div>
  );
}
