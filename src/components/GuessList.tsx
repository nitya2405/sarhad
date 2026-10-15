import { GUESS_CAP, type RegionId } from '@engine/index.ts';
import { regionName } from '../lib/data.ts';

/**
 * Guess chips, newest first. ● connected / ○ not yet connected — colour is never the only signal.
 * This row alone is enough to play (map failed to load, screen readers).
 */
export function GuessList({ guesses, linked, pulse }: { guesses: RegionId[]; linked: Set<RegionId>; pulse?: { id: RegionId; n: number } }) {
  if (guesses.length === 0) return null;
  return (
    <ol aria-label="Your guesses, newest first" className="flex flex-wrap gap-1.5">
      {[...guesses].reverse().map((id) => {
        const on = linked.has(id);
        const pulsing = pulse?.id === id;
        return (
          <li
            key={pulsing ? `${id}-${pulse!.n}` : id}
            className={`inline-flex min-h-8 items-center gap-1 rounded-full px-3 text-sm transition-colors duration-200 ${
              on ? 'bg-marigold font-semibold text-ink' : 'border border-ink-line bg-paper text-ink'
            } ${pulsing ? 'chip-pulse' : ''}`}
          >
            <span aria-hidden="true">{on ? '●' : '○'}</span>
            {regionName(id)}
            <span className="sr-only">{on ? ', connected' : ', not yet connected'}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Guesses left as a thin 20-segment bar; the text equivalent is for screen readers and tests. */
export function GuessBar({ used }: { used: number }) {
  const n = Math.min(used + 1, GUESS_CAP);
  return (
    <div className="flex items-center" role="group" aria-label={`Guess ${n} of ${GUESS_CAP}`}>
      <span className="sr-only">
        Guess {n} of {GUESS_CAP}
      </span>
      <div className="flex h-1.5 flex-1 gap-[2px]" aria-hidden="true">
        {Array.from({ length: GUESS_CAP }, (_, i) => (
          <span key={i} className={`flex-1 rounded-full ${i < used ? 'bg-ink' : 'bg-land'} ${i < used ? '' : 'outline outline-1 -outline-offset-1 outline-border'}`} />
        ))}
      </div>
    </div>
  );
}
