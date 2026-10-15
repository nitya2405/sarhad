import type { RegionId } from '@engine/index.ts';
import minimap from '../data/minimap.json';

const map = minimap as { viewBox: string; regions: Record<RegionId, string> };

/** Home card: coarse India outline (2 KB, bundled) with today's two states lit once known. */
export function MiniMap({ lit = [], className = '' }: { lit?: RegionId[]; className?: string }) {
  return (
    <svg viewBox={map.viewBox} className={className} aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      {Object.entries(map.regions).map(([id, d]) => {
        const on = lit.includes(id);
        return (
          <path
            key={id}
            d={d}
            fill={on ? 'var(--color-marigold)' : 'var(--color-land)'}
            stroke={on ? 'var(--color-marigold-deep)' : 'var(--color-border)'}
            strokeWidth={on ? 1.5 : 1}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </svg>
  );
}
