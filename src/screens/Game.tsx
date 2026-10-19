import { useEffect, useMemo, useState } from 'react';
import { useKeyboardInset, useReducedMotion } from '../lib/hooks.ts';
import { isWon, linkedSet, shortestRouteWithin, type Puzzle, type RegionId } from '@engine/index.ts';
import { GuessInput } from '../components/GuessInput.tsx';
import { GuessBar, GuessList } from '../components/GuessList.tsx';
import { MapView } from '../components/MapView.tsx';
import { BackButton, Mark, Pair, iconBtn } from '../components/ui.tsx';
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
    <div className="mx-auto flex h-full flex-col p-4">
      <div className="flex items-center justify-between">
        <BackButton onClick={onHome} />
        <span className="font-display text-base uppercase tracking-wide text-muted">{mode === 'daily' ? 'Today' : 'Practice'}</span>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <h1 className="text-5xl">
          <Mark busy={busy} label="Starting" />
        </h1>
        {/* no autoFocus: on a phone the keyboard opens only when the player taps the input */}
        <button
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
  /** practice only: the give-up pop-up paused the clock for `ms` */
  onResume: (ms: number) => void;
  onHome: () => void;
  /** a tap during the win celebration goes straight to the result */
  onSkip: () => void;
}

export function Game({ attempt, puzzle, firstGame, onGuess, onGiveUp, onResume, onHome, onSkip }: Props) {
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
  // Give-up pop-up. Practice: the clock pauses while it is open (pausedAt = elapsed ms when opened).
  // Daily: it can't pause, the server measures the official time.
  const [confirmGiveUp, setConfirmGiveUp] = useState(false);
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const keyboard = useKeyboardInset();
  const reduced = useReducedMotion();
  const [pulse, setPulse] = useState<{ id: RegionId; n: number }>();
  const [toast, setToast] = useState<{ text: string; n: number }>();
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(undefined), 1300);
    return () => clearTimeout(t);
  }, [toast]);
  const say = (text: string) => setToast((t) => ({ text, n: (t?.n ?? 0) + 1 }));

  const ids = useMemo(() => attempt.guesses.map((g) => g.id), [attempt.guesses]);
  const linked = useMemo(() => linkedSet(puzzle.start, puzzle.end, ids, adjacency), [puzzle, ids]);
  const now = () => attempt.startedAt + (pausedAt ?? elapsed());
  const won = attempt.status === 'won';
  const daily = attempt.mode === 'daily';
  const shownMs = playing ? (pausedAt ?? elapsed()) : (attempt.finishedAt ?? attempt.startedAt) - attempt.startedAt;

  function openGiveUp() {
    (document.activeElement as HTMLElement | null)?.blur(); // closes the keyboard
    if (!daily) setPausedAt(elapsed());
    setConfirmGiveUp(true);
  }
  function keepPlaying() {
    if (pausedAt != null) onResume(elapsed() - pausedAt);
    setPausedAt(null);
    setConfirmGiveUp(false);
  }

  function guess(id: RegionId) {
    const next = [...ids, id];
    if (isWon(puzzle.start, puzzle.end, next, adjacency)) {
      buzz(PATTERN.won);
      say('Connected!');
    } else if (linkedSet(puzzle.start, puzzle.end, next, adjacency).has(id)) buzz(PATTERN.connected);
    else {
      buzz(PATTERN.accepted);
      say('Not linked yet'); // not joined to either end yet: never "wrong", it may join later
    }
    onGuess(id, now());
  }

  return (
    <div
      className="mx-auto flex h-full flex-col overflow-hidden"
      data-game-screen
      // Keyboard open: the whole screen slides up by its height (nothing shrinks); back down on close.
      style={{ transform: keyboard ? `translateY(${-keyboard}px)` : undefined, transition: reduced ? 'none' : 'transform 200ms ease' }}
      onClick={won ? onSkip : undefined}
      onKeyDown={won ? onSkip : undefined}
    >
      <header className="px-4 pt-2">
        <div className="flex items-center gap-2">
          <BackButton onClick={onHome} />
          <span className="num ml-auto font-display text-2xl" aria-label="Time">
            {formatClock(shownMs)}
          </span>
          {playing && (
            <button className={iconBtn} aria-label="Give up" aria-haspopup="dialog" onClick={openGiveUp}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
              </svg>
            </button>
          )}
        </div>
        {/* the pair on its own row: both names in full, wrapping cleanly at 320px */}
        <h1 className="mt-1 text-center text-[22px] leading-tight text-balance">
          <Pair a={regionName(puzzle.start)} b={regionName(puzzle.end)} />
        </h1>
        <GuessBar used={ids.length} />
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
          <div aria-live="polite" className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
            {toast && (
              <p key={toast.n} className="toast rounded-full border-2 border-ink bg-white px-4 py-1 font-display text-xl shadow-[0_3px_0_var(--color-ink)]">
                {toast.text}
              </p>
            )}
          </div>
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
      {confirmGiveUp && playing && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-ink/55 p-6">
          <div role="dialog" aria-modal="true" aria-labelledby="give-up-title" className="panel pop-in flex w-full max-w-xs flex-col gap-3 px-5 pt-6 pb-5 text-center">
            <h2 id="give-up-title" className="font-display text-3xl">
              Give up?
            </h2>
            <p className="text-sm text-muted">{daily ? 'The clock keeps running.' : 'The clock is paused.'}</p>
            <button className="btn w-full" onClick={() => onGiveUp(now())}>
              Yes, give up
            </button>
            <button className="btn btn-2 w-full" onClick={keepPlaying}>
              Keep playing
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

