import minimap from '../data/minimap.json';
import type { RegionId } from '@engine/index.ts';

const map = minimap as { viewBox: string; regions: Record<string, string> };

/** Small India map: the `on` states in red, the rest in land grey. Decorative; the count says it in text. */
export function MiniIndia({ on, className = '' }: { on: ReadonlySet<RegionId>; className?: string }) {
  return (
    <svg viewBox={map.viewBox} className={className} aria-hidden="true">
      {Object.entries(map.regions).map(([id, d]) => (
        <path
          key={id}
          d={d}
          fill={on.has(id) ? 'var(--color-red)' : 'var(--color-land)'}
          stroke="var(--color-ink)"
          strokeWidth={1}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}
