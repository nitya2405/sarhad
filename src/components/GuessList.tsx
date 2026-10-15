import type { RegionId } from '@engine/index.ts';
import { regionName } from '../lib/data.ts';

/** Newest first. ● connected / ○ not yet connected — colour is never the only signal. */
export function GuessList({ guesses, linked }: { guesses: RegionId[]; linked: Set<RegionId> }) {
  if (guesses.length === 0) return <p className="text-sm text-slate-500">No guesses yet.</p>;
  return (
    <ol aria-label="Your guesses, newest first" className="flex flex-col gap-1">
      {[...guesses].reverse().map((id) => {
        const on = linked.has(id);
        return (
          <li key={id} className="flex items-center gap-2">
            <span aria-hidden="true" className={on ? 'text-teal-700' : 'text-slate-400'}>
              {on ? '●' : '○'}
            </span>
            <span className={on ? 'font-medium' : 'text-slate-600'}>{regionName(id)}</span>
            <span className="sr-only">{on ? ', connected' : ', not yet connected'}</span>
          </li>
        );
      })}
    </ol>
  );
}
