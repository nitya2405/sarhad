import { GUESS_CAP, type RegionId } from '@engine/index.ts';
import { regionName } from '../lib/data.ts';
import { PixelBar } from './pixel.tsx';

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
            className={`inline-flex min-h-8 items-center gap-1 rounded-full border-2 border-ink px-3 text-sm font-semibold transition-colors duration-200 ${
              on ? 'bg-red text-white' : 'bg-white text-ink'
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

/** Guesses left as a pixel bar draining from 20; the text equivalent is for screen readers and tests. */
export function GuessBar({ used }: { used: number }) {
  const n = Math.min(used + 1, GUESS_CAP);
  const left = Math.max(0, GUESS_CAP - used);
  return (
    <div className="mt-1 flex items-center gap-2" role="group" aria-label={`Guess ${n} of ${GUESS_CAP}`}>
      <span className="sr-only">
        Guess {n} of {GUESS_CAP}
      </span>
      <div className="min-w-0 flex-1" aria-hidden="true">
        <PixelBar left={left} />
      </div>
      <span className="num w-6 text-right font-display text-base leading-none" aria-hidden="true">
        {left}
      </span>
    </div>
  );
}
