import { useEffect, useState } from 'react';
import type { RegionId } from '@engine/index.ts';
import { loadMap, mapLabel, type MapData } from '../lib/data.ts';

/** Regions too small to tap or see: larger invisible hit area and a dot marker once revealed. */
const SMALL = new Set(['DL', 'CH', 'GA', 'TR', 'DD']);

let mapPromise: Promise<MapData | null> | null = null;

interface Props {
  start: RegionId;
  end: RegionId;
  guesses: RegionId[];
  linked: Set<RegionId>;
  /** route drawn as a line through label points (result screen) */
  route?: RegionId[];
  animateRoute?: boolean;
  className?: string;
}

export function MapView({ start, end, guesses, linked, route, animateRoute, className = '' }: Props) {
  const [map, setMap] = useState<MapData | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    (mapPromise ??= loadMap()).then((m) => live && setMap(m));
    return () => {
      live = false;
    };
  }, []);

  if (map === undefined) return <div className={className} aria-hidden="true" />;
  if (map === null || !map.regions) {
    return (
      <p className={`${className} flex items-center justify-center p-4 text-center text-sm text-slate-500`}>
        Map unavailable — the guess list below is all you need.
      </p>
    );
  }

  const vb = Array.isArray(map.viewBox) ? map.viewBox : map.viewBox.split(/[\s,]+/).map(Number);
  const w = vb[2];
  const fs = w / 42;
  const revealed = new Set([start, end, ...guesses]);
  const fill = (id: RegionId) =>
    id === start || id === end ? 'var(--c-end)' : linked.has(id) ? 'var(--c-linked)' : revealed.has(id) ? 'var(--c-grey)' : 'var(--c-land)';
  const entries = Object.entries(map.regions);
  const routePts = route?.map((id) => map.regions[id]?.label).filter(Boolean) ?? [];

  return (
    <svg
      viewBox={vb.join(' ')}
      className={className}
      role="img"
      aria-label={`Map of India. Start and end, and your guesses, are labelled.`}
      preserveAspectRatio="xMidYMid meet"
    >
      <g strokeLinejoin="round">
        {entries.map(([id, r]) => (
          <path key={id} d={r.d} fill={fill(id)} stroke="var(--c-border)" strokeWidth={0.8} vectorEffect="non-scaling-stroke">
            {revealed.has(id) && <title>{mapLabel(id)}</title>}
          </path>
        ))}
      </g>
      {routePts.length > 1 && (
        <polyline
          points={routePts.map((p) => p!.join(',')).join(' ')}
          fill="none"
          stroke="var(--c-route)"
          strokeWidth={fs / 3}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={animateRoute ? undefined : `${fs / 2} ${fs / 2}`}
          pathLength={animateRoute ? 1 : undefined}
          className={animateRoute ? 'route-draw' : undefined}
        />
      )}
      {entries.map(([id, r]) =>
        SMALL.has(id) ? (
          <g key={id}>
            {revealed.has(id) && <circle cx={r.label[0]} cy={r.label[1]} r={fs / 3} fill={fill(id)} stroke="var(--c-ink)" strokeWidth={fs / 12} />}
            <circle cx={r.label[0]} cy={r.label[1]} r={fs * 1.2} fill="transparent">
              {revealed.has(id) && <title>{mapLabel(id)}</title>}
            </circle>
          </g>
        ) : null,
      )}
      <g fontSize={fs} textAnchor="middle" className="map-label" aria-hidden="true">
        {entries
          .filter(([id]) => revealed.has(id))
          .map(([id, r]) => (
            <text key={id} x={r.label[0]} y={r.label[1] + (SMALL.has(id) ? -fs * 0.7 : fs * 0.35)}>
              {mapLabel(id)}
            </text>
          ))}
      </g>
    </svg>
  );
}
