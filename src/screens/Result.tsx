import { useEffect, useMemo, useState } from 'react';
import { GUESS_CAP, linkedSet, shortestRouteWithin, type Puzzle } from '@engine/index.ts';
import { Countdown } from '../components/bits.tsx';
import { MapView } from '../components/MapView.tsx';
import { Flame } from '../components/pixel.tsx';
import { Pair } from '../components/ui.tsx';
import { adjacency, regionName } from '../lib/data.ts';
import { formatTime } from '../lib/format.ts';
import { useReducedMotion } from '../lib/hooks.ts';
import { serverEnabled } from '../lib/server.ts';
import { elapsedMs, type Stats } from '../game/model.ts';
import type { LocalAttempt, SavedPlayer } from '../game/storage.ts';

interface Props {
  attempt: LocalAttempt;
  puzzle: Puzzle;
  player: SavedPlayer;
  stats: Stats;
  onPractice: () => void;
  onHome: () => void;
  /** Leaderboard (server builds) or My stats (offline) */
  onBoard: () => void;
}

/** Counts up to `target` over `ms` (ease-out); jumps straight there with reduced motion. */
function useCountUp(target: number, ms = 800): number {
  const reduced = useReducedMotion();
  const [v, setV] = useState(reduced ? target : 0);
  useEffect(() => {
    if (reduced || typeof requestAnimationFrame !== 'function') return setV(target);
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      setV(Math.round(target * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, reduced]);
  return v;
}

/**
 * Result: the final map fills the screen (zoomed to the route) behind a dimmed backdrop, with a
 * pop-up card on top. "See map" closes the card to inspect the route; "Results" brings it back.
 */
export function Result({ attempt, puzzle, stats, onPractice, onHome, onBoard }: Props) {
  const [card, setCard] = useState(true);
  // One shortest route is drawn only on request, in map view, so the map stays clean.
  const [showShortest, setShowShortest] = useState(false);
  const ids = useMemo(() => attempt.guesses.map((g) => g.id), [attempt.guesses]);
  const linked = useMemo(() => linkedSet(puzzle.start, puzzle.end, ids, adjacency), [puzzle, ids]);
  const won = attempt.status === 'won';
  const mine = won ? shortestRouteWithin(puzzle.start, puzzle.end, ids, adjacency) : null;
  const foundShortest = !!mine && mine.length === puzzle.shortest.length;
  const daily = attempt.mode === 'daily';
  const official = attempt.serverTimeMs != null;
  const time = attempt.serverTimeMs ?? elapsedMs(attempt);
  const points = useCountUp(daily ? (attempt.serverPoints ?? attempt.points ?? 0) : 0);

  const heading = won ? 'Connected!' : 'Game over';
  const line = won ? 'You got it!' : ids.length >= GUESS_CAP ? 'Out of guesses' : 'You gave up';
  const big = 'num font-display text-2xl leading-none';
  const shown = card ? undefined : showShortest ? puzzle.shortest : undefined;

  return (
    <div className="absolute inset-0 overflow-hidden bg-white">
      <MapView
        start={puzzle.start}
        end={puzzle.end}
        guesses={ids}
        linked={linked}
        route={shown}
        revealRoute
        zoom
        focus={shown}
        inset={!card}
        className="absolute inset-0"
      />

      {card && <div className="result-backdrop absolute inset-0" aria-hidden="true" />}
      {card ? (
        <div className="absolute inset-0 flex flex-col items-center overflow-y-auto p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="result-heading"
            className="panel pop-in relative my-auto flex w-full max-w-[340px] flex-col items-center gap-3 px-4 pt-5 pb-4 text-center"
          >
            <h1 id="result-heading" className="sticker text-[min(2rem,9vw)]">
              {heading}
            </h1>
            <p className="font-display text-xl">{line}</p>
            <p className="text-lg leading-tight">
              <Pair a={regionName(puzzle.start)} b={regionName(puzzle.end)} />
            </p>

            <dl className="grid w-full grid-cols-3 gap-2">
              <div className="panel px-1 py-2">
                <dd className={big}>{won ? formatTime(time) : '—'}</dd>
                <dt className="mt-1 text-xs text-muted">{official ? 'Official time' : 'Time'}</dt>
              </div>
              <div className="panel px-1 py-2">
                <dd className={big}>{ids.length}</dd>
                <dt className="mt-1 text-xs text-muted">Guesses</dt>
              </div>
              <div className="panel px-1 py-2">
                {daily ? (
                  <dd className={big}>{points}</dd>
                ) : (
                  // practice: how the route compares with the shortest one
                  <dd className="num font-display text-xl leading-none">{foundShortest ? 'Shortest ✓' : mine ? `+${mine.length - puzzle.shortest.length} extra` : '—'}</dd>
                )}
                <dt className="mt-1 text-xs text-muted">{daily ? 'Points' : 'Route'}</dt>
              </div>
            </dl>
            {!daily && <p className="-mt-1 text-xs text-muted">Practice doesn't earn points.</p>}

            <p className="font-display text-lg">
              {foundShortest ? (
                <>
                  Ekdum seedha! <span className="text-muted">Shortest route ✓</span>
                </>
              ) : (
                `Shortest: ${puzzle.k} ${puzzle.k === 1 ? 'state' : 'states'}`
              )}
            </p>
            {daily && attempt.pendingSync && serverEnabled && <p className="text-xs text-muted">Sending your result…</p>}
            {won && attempt.serverFlagged && <p className="text-xs font-semibold text-muted">Under review: very fast finish</p>}

            <div className="grid w-full grid-cols-2 gap-3 pt-1">
              {daily ? (
                <button className="btn px-1 text-lg" onClick={onBoard}>
                  {serverEnabled ? 'Leaderboard' : 'My stats'}
                </button>
              ) : (
                <button className="btn px-1 text-lg" onClick={onPractice}>
                  Play again
                </button>
              )}
              <button className="btn btn-2 px-1 text-lg" onClick={onHome}>
                Home
              </button>
            </div>
            <button className="min-h-11 px-3 text-sm font-semibold underline" onClick={() => setCard(false)}>
              See map
            </button>

            {daily && (
              <div className="flex flex-col items-center gap-0.5 text-sm text-muted">
                <p className="num inline-flex flex-wrap items-center justify-center gap-x-1.5">
                  <span className="inline-flex items-center gap-1 text-ink" aria-label={`Streak ${stats.streak}`}>
                    <Flame px={2} /> {stats.streak}
                  </span>
                  · Best streak {stats.best} · Wins {stats.wins}
                </p>
                <p>
                  <Countdown />
                </p>
              </div>
            )}
            <p className="text-[0.7rem] text-muted">
              Map data © <a className="underline" href="https://simplemaps.com/gis/country/in" target="_blank" rel="noreferrer">
                SimpleMaps
              </a>
              ,{' '}
              <a className="underline" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
                CC BY 4.0
              </a>
            </p>
          </section>
        </div>
      ) : (
        <>
          <div className="absolute top-3 left-3">
            <button className="btn min-h-11 px-4 text-lg" onClick={() => setCard(true)}>
              Results
            </button>
          </div>
          {!foundShortest && (
            <div className="absolute inset-x-0 bottom-[max(1.75rem,calc(env(safe-area-inset-bottom)+1.25rem))] flex justify-center">
              <button className="btn btn-2 mb-0 min-h-11 px-4 text-sm" aria-pressed={showShortest} onClick={() => setShowShortest((v) => !v)}>
                {showShortest ? 'Hide shortest route' : 'Show shortest route'}
              </button>
            </div>
          )}
          <p className="absolute right-2 bottom-1 text-[0.7rem] text-muted">
            Map data © <a className="underline" href="https://simplemaps.com/gis/country/in" target="_blank" rel="noreferrer">
              SimpleMaps
            </a>
            ,{' '}
            <a className="underline" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
              CC BY 4.0
            </a>
          </p>
        </>
      )}
    </div>
  );
}
