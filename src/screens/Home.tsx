import { useState } from 'react';
import { Countdown, Footer } from '../components/bits.tsx';
import { Coach, coachSeen } from '../components/Coach.tsx';
import { MiniMap } from '../components/MiniMap.tsx';
import { Pair } from '../components/ui.tsx';
import { getPuzzle, regionName } from '../lib/data.ts';
import { bestTimes, elapsedMs, type Stats } from '../game/model.ts';
import type { LocalAttempt, SavedPlayer } from '../game/storage.ts';
import { formatDate, formatTime } from '../lib/format.ts';
import { hapticsOn, setHapticsOn } from '../lib/haptics.ts';

interface Props {
  player: SavedPlayer;
  stats: Stats;
  today: string;
  /** a daily can be started today (server builds: always; offline builds: if the bundled schedule covers today) */
  dailyAvailable: boolean;
  /** shown on the daily card, e.g. 'Needs a connection to start' */
  dailyNote?: string;
  todayAttempt: LocalAttempt | undefined;
  /** an unfinished attempt from another date or practice */
  resumable: LocalAttempt | undefined;
  onDaily: () => void;
  onPractice: () => void;
  onOpen: (a: LocalAttempt) => void;
}

const primary = 'min-h-14 w-full rounded-card bg-ink px-6 font-display text-2xl font-extrabold text-paper';
const secondary = 'min-h-12 w-full rounded-card border-2 border-ink px-6 font-display text-xl font-semibold text-ink';
const icon = 'inline-flex min-h-12 min-w-12 items-center justify-center rounded-card text-ink';

export function Home({ player, stats, today, dailyAvailable, dailyNote, todayAttempt, resumable, onDaily, onPractice, onOpen }: Props) {
  const [coach, setCoach] = useState(() => !coachSeen());
  const [haptics, setHaptics] = useState(hapticsOn);
  const done = todayAttempt && todayAttempt.status !== 'playing';
  const puzzle = todayAttempt && getPuzzle(todayAttempt.puzzleId);
  const best = bestTimes(player, 1)[0];

  return (
    <div className="mx-auto flex min-h-[var(--app-h,100dvh)] max-w-md flex-col gap-4 p-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-display text-4xl font-extrabold text-ink">Sarhad</h1>
        <p className="num flex items-center gap-3 font-display text-lg font-semibold">
          <span aria-label={`Streak ${stats.streak}`}>
            <span aria-hidden="true">🔥</span> {stats.streak}
          </span>
          <span>{stats.totalPoints.toLocaleString('en-IN')} pts</span>
        </p>
      </header>

      <section aria-label={`Today, ${formatDate(today)}`} className="flex flex-col gap-3 rounded-card border border-border bg-white p-4">
        <div className="relative mx-auto h-56 w-full">
          <MiniMap lit={puzzle ? [puzzle.start, puzzle.end] : []} className="h-full w-full" />
          {!puzzle && (
            <p className="absolute inset-0 flex items-center justify-center text-4xl" aria-hidden="true">
              <Pair a="?" b="?" className="rounded-card bg-white/80 px-3" />
            </p>
          )}
        </div>
        <p className="text-center font-display text-lg font-semibold">
          {puzzle ? <Pair a={regionName(puzzle.start)} b={regionName(puzzle.end)} /> : `Today · ${formatDate(today)}`}
        </p>
        {!dailyAvailable && !todayAttempt && <p className="text-center text-ink-soft">No daily today.</p>}
        {dailyAvailable && !todayAttempt && (
          <>
            {dailyNote && (
              <p role="status" className="text-center text-sm font-semibold text-kumkum">
                {dailyNote}
              </p>
            )}
            <button className={primary} onClick={onDaily}>
              Play
            </button>
          </>
        )}
        {todayAttempt?.status === 'playing' && (
          <button className={primary} onClick={onDaily}>
            Continue
          </button>
        )}
        {done && (
          <button onClick={onDaily} className="flex min-h-12 flex-col items-center rounded-card px-2 py-1" aria-label="See today's result">
            <span className="num font-display text-3xl font-extrabold">
              {todayAttempt.status === 'won'
                ? `${formatTime(todayAttempt.serverTimeMs ?? elapsedMs(todayAttempt))} · ${todayAttempt.serverPoints ?? todayAttempt.points ?? 0} pts`
                : 'Not linked'}
            </span>
            <span className="text-ink-soft">
              <Countdown />
            </span>
          </button>
        )}
      </section>

      {resumable && (
        <button className={secondary} onClick={() => onOpen(resumable)}>
          Continue {resumable.mode === 'daily' ? formatDate(resumable.date!) : 'practice'}
        </button>
      )}
      <button className={secondary} onClick={onPractice}>
        Practice
      </button>

      <div className="flex items-center justify-between gap-2">
        <p className="num text-ink-soft">
          Best {best ? formatTime(best.serverTimeMs ?? elapsedMs(best)) : '–'} · Wins {stats.wins}
        </p>
        <div className="flex">
          <button
            className={`${icon} ${haptics ? '' : 'text-ink-soft'}`}
            aria-label="Vibration"
            aria-pressed={haptics}
            onClick={() => {
              setHapticsOn(!haptics);
              setHaptics(!haptics);
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <rect x="8" y="4" width="8" height="16" rx="2" />
              {haptics ? <path d="M4 9v6M20 9v6M1.5 11v2M22.5 11v2" /> : <path d="M3 3l18 18" />}
            </svg>
          </button>
          <button className={`${icon} font-display text-xl font-extrabold`} aria-label="How to play" onClick={() => setCoach(true)}>
            ?
          </button>
        </div>
      </div>
      <Footer />
      {coach && <Coach onClose={() => setCoach(false)} />}
    </div>
  );
}
