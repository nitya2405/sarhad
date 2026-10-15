import { useEffect, useMemo, useState } from 'react';
import { GUESS_CAP, linkedSet, shortestRouteWithin, type Puzzle } from '@engine/index.ts';
import { Countdown, Footer, Leaderboard, NamePrompt } from '../components/bits.tsx';
import { MapView } from '../components/MapView.tsx';
import { BackButton, Pair } from '../components/ui.tsx';
import { adjacency, regionName } from '../lib/data.ts';
import { formatDate, formatTime } from '../lib/format.ts';
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

export function Result({ attempt, puzzle, stats, onPractice, onHome }: Props) {
  const [boardKey, setBoardKey] = useState(0);
  const ids = useMemo(() => attempt.guesses.map((g) => g.id), [attempt.guesses]);
  const linked = useMemo(() => linkedSet(puzzle.start, puzzle.end, ids, adjacency), [puzzle, ids]);
  const won = attempt.status === 'won';
  const mine = won ? shortestRouteWithin(puzzle.start, puzzle.end, ids, adjacency) : null;
  const foundShortest = !!mine && mine.length === puzzle.shortest.length;
  const daily = attempt.mode === 'daily';
  const official = attempt.serverTimeMs != null;
  const time = attempt.serverTimeMs ?? elapsedMs(attempt);
  const points = useCountUp(daily ? (attempt.serverPoints ?? attempt.points ?? 0) : 0);

  const heading = won ? 'Linked!' : ids.length >= GUESS_CAP ? 'Out of guesses' : 'You gave up';
  const big = 'num font-display text-3xl font-extrabold leading-none';

  return (
    <div className="mx-auto flex min-h-[var(--app-h,100dvh)] max-w-md flex-col gap-4 p-4">
      <header className="flex items-center gap-1">
        <BackButton onClick={onHome} />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl font-extrabold leading-tight">{heading}</h1>
          <p className="truncate text-ink-soft">
            {daily ? formatDate(attempt.date!) : 'Practice'} · <Pair a={regionName(puzzle.start)} b={regionName(puzzle.end)} className="font-semibold" />
          </p>
        </div>
      </header>

      <dl className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-card bg-white p-3">
          <dd className={big}>{won ? formatTime(time) : '–'}</dd>
          <dt className="mt-1 text-xs text-ink-soft">{official ? 'Official time' : 'Time'}</dt>
        </div>
        <div className="rounded-card bg-white p-3">
          <dd className={big}>{ids.length}</dd>
          <dt className="mt-1 text-xs text-ink-soft">Guesses</dt>
        </div>
        <div className="rounded-card bg-white p-3">
          <dd className={big} aria-label={daily ? undefined : 'unscored'}>
            {daily ? points : '–'}
          </dd>
          <dt className="mt-1 text-xs text-ink-soft">{daily ? 'Points' : 'Unscored'}</dt>
        </div>
      </dl>
      {daily && attempt.pendingSync && serverEnabled && <p className="text-xs text-ink-soft">Sending your result…</p>}

      <MapView
        start={puzzle.start}
        end={puzzle.end}
        guesses={ids}
        linked={linked}
        route={foundShortest ? mine! : puzzle.shortest}
        revealRoute={!foundShortest}
        className="aspect-[1000/1139] max-h-[46vh] w-full"
      />

      <section aria-label="Route" className="text-center">
        {foundShortest ? (
          <p className="font-display text-xl font-extrabold">You found a shortest route!</p>
        ) : (
          <>
            <p className="font-display text-lg font-semibold">
              One shortest route needs {puzzle.k} {puzzle.k === 1 ? 'state' : 'states'}
            </p>
            <p className="text-ink-soft">{puzzle.shortest.slice(1, -1).map(regionName).join(' · ')}</p>
          </>
        )}
      </section>

      {daily && (
        <>
          <p className="num text-center font-display text-lg font-semibold">
            <span aria-hidden="true">🔥</span> {stats.streak} <span className="text-ink-soft">·</span> Best streak {stats.best}{' '}
            <span className="text-ink-soft">·</span> Wins {stats.wins}
          </p>
          <p className="text-center text-ink-soft">
            <Countdown />
          </p>
          {serverEnabled && won && <NamePrompt onSaved={() => setBoardKey((k) => k + 1)} />}
          {serverEnabled && <Leaderboard date={attempt.date!} refreshKey={`${boardKey}-${attempt.pendingSync}`} />}
        </>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button className="min-h-12 rounded-card bg-ink px-4 font-display text-xl font-extrabold text-paper" onClick={onPractice}>
          Practice
        </button>
        <button className="min-h-12 rounded-card border-2 border-ink px-4 font-display text-xl font-semibold" onClick={onHome}>
          Home
        </button>
      </div>
      <Footer />
    </div>
  );
}
