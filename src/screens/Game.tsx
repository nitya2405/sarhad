import { useEffect, useMemo, useState } from 'react';
import { isWon, linkedSet, shortestRouteWithin, type Puzzle, type RegionId } from '@engine/index.ts';
import { GuessInput } from '../components/GuessInput.tsx';
import { GuessBar, GuessList } from '../components/GuessList.tsx';
import { MapView } from '../components/MapView.tsx';
import { BackButton, Pair, iconBtn } from '../components/ui.tsx';
import { adjacency, regionName } from '../lib/data.ts';
import { formatClock } from '../lib/format.ts';
import { PATTERN, buzz } from '../lib/haptics.ts';
import type { LocalAttempt } from '../game/storage.ts';

/** Ready: endpoints stay hidden until Start so nobody can study the pair before the clock runs. */
interface ReadyProps {
  mode: 'daily' | 'practice';
  /** waiting for start_daily (server builds) */
  busy?: boolean;
  error?: string;
  onStart: () => void;
  onHome: () => void;
}

export function Ready({ mode, busy, error, onStart, onHome }: ReadyProps) {
  return (
    <div className="mx-auto flex min-h-[var(--app-h,100dvh)] flex-col p-4">
      <div className="flex items-center justify-between">
        <BackButton onClick={onHome} />
        <span className="font-display text-base uppercase tracking-wide text-muted">{mode === 'daily' ? 'Today' : 'Practice'}</span>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <h1 className="text-5xl">
          <Pair a="?" b="?" />
        </h1>
        <button
          autoFocus
          disabled={busy}
          className="btn w-full max-w-xs text-2xl"
          onClick={onStart}
        >
          {busy ? 'Starting…' : error ? 'Try again' : 'Start'}
        </button>
        <p className="text-muted">Clock starts when you tap.</p>
        <p className="min-h-8">
          <span role="alert" className="err-pill text-sm">
            {error}
          </span>
        </p>
      </div>
    </div>
  );
}

interface Props {
  attempt: LocalAttempt;
  puzzle: Puzzle;
  /** first game on this phone: one short hint under the map */
  firstGame: boolean;
  /** `now` = startedAt + monotonic elapsed, so device clock changes cannot move the time */
  onGuess: (id: RegionId, now: number) => void;
  onGiveUp: (now: number) => void;
  onHome: () => void;
  /** a tap during the win celebration goes straight to the result */
  onSkip: () => void;
}

export function Game({ attempt, puzzle, firstGame, onGuess, onGiveUp, onHome, onSkip }: Props) {
  // Display uses performance.now(); the persisted startedAt only sets the baseline on resume.
  const elapsed = useMemo(() => {
    const base = Math.max(0, Date.now() - attempt.startedAt);
    const p0 = performance.now();
    return () => base + performance.now() - p0;
  }, [attempt.attemptId, attempt.startedAt]);
  const playing = attempt.status === 'playing';
  const [, tick] = useState(0);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [playing]);
  const [confirmGiveUp, setConfirmGiveUp] = useState(false);
  const [pulse, setPulse] = useState<{ id: RegionId; n: number }>();

  const ids = useMemo(() => attempt.guesses.map((g) => g.id), [attempt.guesses]);
  const linked = useMemo(() => linkedSet(puzzle.start, puzzle.end, ids, adjacency), [puzzle, ids]);
  const now = () => attempt.startedAt + elapsed();
  const won = attempt.status === 'won';
  const shownMs = playing ? elapsed() : (attempt.finishedAt ?? attempt.startedAt) - attempt.startedAt;

  function guess(id: RegionId) {
    const next = [...ids, id];
    if (isWon(puzzle.start, puzzle.end, next, adjacency)) buzz(PATTERN.won);
    else buzz(linkedSet(puzzle.start, puzzle.end, next, adjacency).has(id) ? PATTERN.connected : PATTERN.accepted);
    onGuess(id, now());
  }

  return (
    <div
      className="mx-auto flex h-[var(--app-h,100dvh)] flex-col overflow-hidden"
      onClick={won ? onSkip : undefined}
      onKeyDown={won ? onSkip : undefined}
    >
      <header className="game-head px-4 pt-2">
        <div className="game-head-grid">
          <span style={{ gridArea: 'back' }}>
            <BackButton onClick={onHome} />
          </span>
          <h1 className="min-w-0 text-lg leading-tight text-balance" style={{ gridArea: 'title' }}>
            <Pair a={regionName(puzzle.start)} b={regionName(puzzle.end)} />
          </h1>
          <span className="num justify-self-end font-display text-2xl" style={{ gridArea: 'time' }} aria-label="Time">
            {formatClock(shownMs)}
          </span>
          {playing && (
            <button className={iconBtn} style={{ gridArea: 'flag' }} aria-label="Give up" onClick={() => setConfirmGiveUp((v) => !v)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
              </svg>
            </button>
          )}
        </div>
        {confirmGiveUp && playing ? (
          <div className="fade-in flex flex-wrap items-center justify-end gap-2 pb-1 text-sm">
            <span className="font-semibold">Give up?</span>
            <button className="btn btn-2 min-h-11 px-3 text-base" onClick={() => onGiveUp(now())}>
              Yes, give up
            </button>
            <button className="btn min-h-11 px-3 text-base" onClick={() => setConfirmGiveUp(false)}>
              Keep playing
            </button>
          </div>
        ) : (
          <GuessBar used={ids.length} />
        )}
      </header>

      <div className="min-h-0 flex-1 px-4 py-1.5">
        <div className="relative h-full overflow-hidden rounded-[18px] border-2 border-ink bg-white">
          <MapView
            start={puzzle.start}
            end={puzzle.end}
            guesses={ids}
            linked={linked}
            latest={ids.at(-1)}
            route={won ? (shortestRouteWithin(puzzle.start, puzzle.end, ids, adjacency) ?? undefined) : undefined}
            celebrate={won}
            interactive
            zoom
            inset
            className="absolute inset-0"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5 px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="max-h-[4.6rem] overflow-y-auto">
          <GuessList guesses={ids} linked={linked} pulse={pulse} />
        </div>
        {playing && (
          <GuessInput
            start={puzzle.start}
            end={puzzle.end}
            guesses={ids}
            hint={firstGame && ids.length === 0 ? 'Type the states between. Any order.' : undefined}
            onAccept={guess}
            onDuplicate={(id) => setPulse((p) => ({ id, n: (p?.n ?? 0) + 1 }))}
          />
        )}
      </div>
    </div>
  );
}

