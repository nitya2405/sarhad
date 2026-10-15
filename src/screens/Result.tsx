import { useMemo, useState } from 'react';
import { GUESS_CAP, linkedSet, shortestRouteWithin, type Puzzle } from '@engine/index.ts';
import { Countdown, Footer, Leaderboard, NamePrompt, StatsRow } from '../components/bits.tsx';
import { BestTimes } from '../components/bits.tsx';
import { MapView } from '../components/MapView.tsx';
import { adjacency, regionName } from '../lib/data.ts';
import { formatDate, formatTime } from '../lib/format.ts';
import { useReducedMotion } from '../lib/hooks.ts';
import { serverEnabled } from '../lib/server.ts';
import { bestTimes, elapsedMs, type Stats } from '../game/model.ts';
import type { LocalAttempt, SavedPlayer } from '../game/storage.ts';

interface Props {
  attempt: LocalAttempt;
  puzzle: Puzzle;
  player: SavedPlayer;
  stats: Stats;
  onPractice: () => void;
  onHome: () => void;
}

export function Result({ attempt, puzzle, player, stats, onPractice, onHome }: Props) {
  const reduced = useReducedMotion();
  const [boardKey, setBoardKey] = useState(0);
  const ids = useMemo(() => attempt.guesses.map((g) => g.id), [attempt.guesses]);
  const linked = useMemo(() => linkedSet(puzzle.start, puzzle.end, ids, adjacency), [puzzle, ids]);
  const won = attempt.status === 'won';
  const mine = won ? shortestRouteWithin(puzzle.start, puzzle.end, ids, adjacency) : null;
  const foundShortest = !!mine && mine.length === puzzle.shortest.length;
  const daily = attempt.mode === 'daily';
  const official = attempt.serverTimeMs != null;
  const time = attempt.serverTimeMs ?? elapsedMs(attempt);
  const points = attempt.serverPoints ?? attempt.points ?? 0;

  const heading = won ? 'Linked!' : ids.length >= GUESS_CAP ? 'Out of guesses' : 'You gave up';

  return (
    <div className="mx-auto flex min-h-[var(--app-h,100dvh)] max-w-md flex-col gap-4 p-4">
      <header>
        <p className="text-sm text-slate-600">{daily ? `Daily · ${formatDate(attempt.date!)}` : 'Practice'}</p>
        <h1 className="text-2xl font-bold text-teal-800">{heading}</h1>
        <p className="font-medium">
          {regionName(puzzle.start)} → {regionName(puzzle.end)}
        </p>
      </header>

      <dl className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-slate-100 p-2">
          <dt className="text-xs text-slate-600">{official ? 'Official time' : 'Time'}</dt>
          <dd className="text-lg font-semibold tabular-nums">{won ? formatTime(time) : '—'}</dd>
        </div>
        <div className="rounded-lg bg-slate-100 p-2">
          <dt className="text-xs text-slate-600">Guesses</dt>
          <dd className="text-lg font-semibold tabular-nums">{ids.length}</dd>
        </div>
        <div className="rounded-lg bg-slate-100 p-2">
          <dt className="text-xs text-slate-600">Points</dt>
          <dd className="text-lg font-semibold tabular-nums">{daily ? points : 'unscored'}</dd>
        </div>
      </dl>
      {daily && attempt.pendingSync && serverEnabled && <p className="text-xs text-slate-500">Sending your result…</p>}

      <MapView
        start={puzzle.start}
        end={puzzle.end}
        guesses={ids}
        linked={linked}
        route={foundShortest ? mine! : puzzle.shortest}
        animateRoute={!foundShortest && !reduced}
        className="aspect-square max-h-[55vh] w-full"
      />

      <section aria-label="Route" className="rounded-lg bg-teal-50 p-3">
        {foundShortest ? (
          <p className="font-semibold text-teal-900">You found a shortest route!</p>
        ) : (
          <>
            <p className="font-semibold text-teal-900">
              One shortest route needs {puzzle.k} {puzzle.k === 1 ? 'state' : 'states'}:
            </p>
            <p>{puzzle.shortest.map(regionName).join(' → ')}</p>
          </>
        )}
      </section>

      {daily && (
        <>
          <StatsRow stats={stats} />
          <p className="text-sm text-slate-600">
            <Countdown />
          </p>
          {serverEnabled && won && <NamePrompt onSaved={() => setBoardKey((k) => k + 1)} />}
          {serverEnabled && <Leaderboard date={attempt.date!} refreshKey={`${boardKey}-${attempt.pendingSync}`} />}
        </>
      )}
      <BestTimes attempts={bestTimes(player)} />

      <div className="grid grid-cols-2 gap-2">
        <button className="rounded-lg bg-slate-800 px-4 py-3 font-semibold text-white" onClick={onPractice}>
          Practice
        </button>
        <button className="rounded-lg border border-teal-700 px-4 py-3 font-semibold text-teal-800" onClick={onHome}>
          Home
        </button>
      </div>
      <Footer />
    </div>
  );
}
