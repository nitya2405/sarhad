import { useEffect, useMemo, useState } from 'react';
import { GUESS_CAP, linkedSet, type Puzzle, type RegionId } from '@engine/index.ts';
import { GuessInput } from '../components/GuessInput.tsx';
import { GuessList } from '../components/GuessList.tsx';
import { MapView } from '../components/MapView.tsx';
import { adjacency, regionName } from '../lib/data.ts';
import { formatClock, formatDate } from '../lib/format.ts';
import type { LocalAttempt } from '../game/storage.ts';

/** Ready: endpoints stay hidden until Start so nobody can study the pair before the clock runs. */
export function Ready({ mode, date, onStart, onHome }: { mode: 'daily' | 'practice'; date: string; onStart: () => void; onHome: () => void }) {
  return (
    <div className="mx-auto flex min-h-[var(--app-h,100dvh)] max-w-md flex-col justify-center gap-5 p-4">
      <h1 className="text-2xl font-bold text-teal-800">{mode === 'daily' ? `Daily · ${formatDate(date)}` : 'Practice'}</h1>
      <p>
        You'll see two states. Name the states and union territories in between, in any order, until they link up. The clock
        starts when you press Start.
      </p>
      {mode === 'daily' && <p className="text-sm text-slate-600">One scored attempt per day. Faster = more points.</p>}
      <button autoFocus className="rounded-lg bg-teal-700 px-4 py-3 text-lg font-semibold text-white" onClick={onStart}>
        Start
      </button>
      <button className="text-sm text-slate-600 underline" onClick={onHome}>
        Back
      </button>
    </div>
  );
}

interface Props {
  attempt: LocalAttempt;
  puzzle: Puzzle;
  /** `now` = startedAt + monotonic elapsed, so device clock changes cannot move the time */
  onGuess: (id: RegionId, now: number) => void;
  onGiveUp: (now: number) => void;
  onHome: () => void;
}

export function Game({ attempt, puzzle, onGuess, onGiveUp, onHome }: Props) {
  // Display uses performance.now(); the persisted startedAt only sets the baseline on resume.
  const elapsed = useMemo(() => {
    const base = Math.max(0, Date.now() - attempt.startedAt);
    const p0 = performance.now();
    return () => base + performance.now() - p0;
  }, [attempt.attemptId, attempt.startedAt]);
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, []);
  const [confirmGiveUp, setConfirmGiveUp] = useState(false);

  const ids = useMemo(() => attempt.guesses.map((g) => g.id), [attempt.guesses]);
  const linked = useMemo(() => linkedSet(puzzle.start, puzzle.end, ids, adjacency), [puzzle, ids]);
  const now = () => attempt.startedAt + elapsed();

  return (
    <div className="mx-auto flex h-[var(--app-h,100dvh)] max-w-md flex-col overflow-hidden">
      <header className="px-4 pt-2">
        <div className="flex items-center justify-between gap-2">
          <button onClick={onHome} className="-ml-2 p-2 text-slate-600" aria-label="Home">
            ←
          </button>
          <h1 className="min-w-0 flex-1 truncate text-lg font-bold text-teal-800">
            {regionName(puzzle.start)} → {regionName(puzzle.end)}
          </h1>
          <span className="font-mono text-lg tabular-nums" aria-label="Time">
            {formatClock(elapsed())}
          </span>
        </div>
        <p className="flex flex-wrap justify-between gap-x-3 text-sm text-slate-600">
          <span>Name the states in between, in any order.</span>
          <span className="font-semibold text-slate-800">
            Guess {Math.min(ids.length + 1, GUESS_CAP)} of {GUESS_CAP}
            {attempt.mode === 'practice' && ' · practice'}
          </span>
        </p>
      </header>

      <div className="min-h-0 flex-[1_1_55%] px-2">
        <MapView start={puzzle.start} end={puzzle.end} guesses={ids} linked={linked} className="h-full w-full" />
      </div>

      <div className="min-h-10 flex-[1_1_20%] overflow-y-auto px-4 py-2">
        <GuessList guesses={ids} linked={linked} />
      </div>

      <div className="border-t border-slate-200 bg-white px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1">
        <GuessInput start={puzzle.start} end={puzzle.end} guesses={ids} onAccept={(id) => onGuess(id, now())} />
        <div className="flex justify-end gap-3 py-1 text-sm">
          {confirmGiveUp ? (
            <>
              <span className="text-slate-700">Give up?</span>
              <button className="font-semibold text-rose-700 underline" onClick={() => onGiveUp(now())}>
                Yes, give up
              </button>
              <button className="text-slate-600 underline" onClick={() => setConfirmGiveUp(false)}>
                Keep playing
              </button>
            </>
          ) : (
            <button className="text-slate-500 underline" onClick={() => setConfirmGiveUp(true)}>
              Give up
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
