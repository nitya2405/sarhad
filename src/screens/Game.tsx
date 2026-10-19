import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useKeyboardLift, useReducedMotion } from '../lib/hooks.ts';
import { GUESS_CAP, isWon, linkedSet, shortestRouteWithin, type Puzzle, type RegionId } from '@engine/index.ts';
import { GuessInput } from '../components/GuessInput.tsx';
import { GuessBar, GuessList } from '../components/GuessList.tsx';
import { MapView } from '../components/MapView.tsx';
import { BackButton, Mark, Pair, iconBtn } from '../components/ui.tsx';
import { adjacency, regionName } from '../lib/data.ts';
import { formatClock } from '../lib/format.ts';
import { play } from '../lib/sound.ts';
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
  const lift = useKeyboardLift();
  const reduced = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const panelH = useFixedHeight(panelRef);
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
      play('win');
      if (shortestRouteWithin(puzzle.start, puzzle.end, next, adjacency)?.length === puzzle.shortest.length) play('shortest');
      say('Connected!');
    } else if (next.length >= GUESS_CAP) play('lose'); // out of guesses
    else if (linkedSet(puzzle.start, puzzle.end, next, adjacency).has(id)) play('connected');
    else {
      play('notLinked');
      say('Not linked yet'); // not joined to either end yet: never "wrong", it may join later
    }
    onGuess(id, now());
  }

  return (
    <div
      className="mx-auto flex h-full flex-col overflow-hidden"
      data-game-screen
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
        {/* one size for the whole game (useFixedHeight): the keyboard never moves or resizes the map */}
        <div ref={panelRef} data-map-panel style={{ height: panelH ?? '100%' }} className="relative overflow-hidden rounded-[18px] border-2 border-ink bg-white">
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
            stableHeight
            className="absolute inset-0"
          />
          {DEBUG && <DebugOverlay panel={panelRef} />}
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
        {/* a fixed height, so more guesses never shrink the map */}
        <div className="h-[4.6rem] overflow-y-auto">
          <GuessList guesses={ids} linked={linked} pulse={pulse} />
        </div>
        {playing && (
          // Keyboard open: only this bar lifts, to sit on the keyboard over the bottom of the map.
          <div
            data-input-bar
            className={`relative z-20 -mx-4 px-4 ${lift ? 'bg-white py-1.5' : ''}`}
            style={{ transform: lift ? `translateY(${-lift}px)` : undefined, transition: reduced ? 'none' : 'transform 150ms ease-out' }}
          >
            <GuessInput
              start={puzzle.start}
              end={puzzle.end}
              guesses={ids}
              hint={firstGame && ids.length === 0 ? 'Type the states between. Any order.' : undefined}
              onAccept={guess}
              onDuplicate={(id) => setPulse((p) => ({ id, n: (p?.n ?? 0) + 1 }))}
            />
          </div>
        )}
      </div>
      {confirmGiveUp && playing && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-ink/55 p-6">
          <div role="dialog" aria-modal="true" aria-labelledby="give-up-title" className="panel pop-in flex w-full max-w-xs flex-col gap-3 px-5 pt-6 pb-5 text-center">
            <h2 id="give-up-title" className="font-display text-3xl">
              Give up?
            </h2>
            <p className="text-sm text-muted">{daily ? 'The clock keeps running.' : 'The clock is paused.'}</p>
            <button
              className="btn w-full"
              onClick={() => {
                play('lose');
                onGiveUp(now());
              }}
            >
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


/**
 * The map panel's height in px, measured when the game opens, once more after the display font has
 * loaded (it can change the header's height), and again only when the window's width changes
 * (rotation). Never on a height change alone, so the keyboard can't move or resize the map.
 */
function useFixedHeight(ref: RefObject<HTMLDivElement | null>): number | null {
  const [h, setH] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (h != null) return;
    const measured = ref.current?.getBoundingClientRect().height ?? 0;
    if (measured > 0) setH(Math.round(measured));
  }, [h, ref]);
  useEffect(() => {
    let alive = true;
    let width = window.innerWidth;
    const onResize = () => {
      if (window.innerWidth === width) return;
      width = window.innerWidth;
      setH(null); // back to the flexible height for one layout pass, then measured again
    };
    void document.fonts?.ready.then(() => alive && setH(null));
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      alive = false;
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);
  return h;
}

const DEBUG = typeof location !== 'undefined' && new URLSearchParams(location.search).get('debug') === '1';

/** ?debug=1 only: the numbers behind the layout, to screenshot on a real phone. */
function DebugOverlay({ panel }: { panel: RefObject<HTMLDivElement | null> }) {
  const [, tick] = useState(0);
  const probe = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const on = () => tick((n) => n + 1);
    const id = setInterval(on, 300);
    const vv = window.visualViewport;
    vv?.addEventListener('resize', on);
    vv?.addEventListener('scroll', on);
    return () => {
      clearInterval(id);
      vv?.removeEventListener('resize', on);
      vv?.removeEventListener('scroll', on);
    };
  }, []);
  const vv = window.visualViewport;
  const p = panel.current?.getBoundingClientRect();
  const r = (n: number | undefined) => (n == null ? '—' : Math.round(n));
  const box = panel.current?.querySelector('svg[role="img"]')?.getAttribute('viewBox');
  const lines = [
    `svh ${r(probe.current?.getBoundingClientRect().height)}`,
    `innerHeight ${window.innerHeight}`,
    `vv height ${r(vv?.height)} offsetTop ${r(vv?.offsetTop)}`,
    `scrollY ${r(window.scrollY)}`,
    `map ${r(p?.width)}×${r(p?.height)} y ${r(p?.top)}`,
    `viewBox ${box ? box.split(' ').map((n) => Math.round(Number(n))).join(' ') : '—'}`,
  ];
  return (
    <>
      <div ref={probe} aria-hidden="true" className="pointer-events-none invisible fixed top-0 left-0 w-px" style={{ height: '100svh' }} />
      <pre data-debug className="pointer-events-none absolute top-1 left-1 z-30 m-0 rounded bg-ink/80 px-1.5 py-1 font-mono text-[10px] leading-tight text-white">
        {lines.join('\n')}
      </pre>
    </>
  );
}
