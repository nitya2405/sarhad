import { useState } from 'react';
import { Countdown, Footer } from '../components/bits.tsx';
import { Coach, coachSeen } from '../components/Coach.tsx';
import { MiniMap } from '../components/MiniMap.tsx';
import { Coin, Flame } from '../components/pixel.tsx';
import { Pair } from '../components/ui.tsx';
import { getPuzzle, regionName } from '../lib/data.ts';
import { bestTimes, elapsedMs, type Stats } from '../game/model.ts';
import type { LocalAttempt, SavedPlayer } from '../game/storage.ts';
import { formatDate, formatTime } from '../lib/format.ts';
import { hapticsOn, setHapticsOn } from '../lib/haptics.ts';
import { serverEnabled } from '../lib/server.ts';

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

const primary = 'btn w-full text-2xl';
const secondary = 'btn btn-2 w-full';
const icon = 'btn btn-2 btn-icon';

export function Home({ player, stats, today, dailyAvailable, dailyNote, todayAttempt, resumable, onDaily, onPractice, onOpen }: Props) {
  const [coach, setCoach] = useState(() => !coachSeen());
  const [haptics, setHaptics] = useState(hapticsOn);
  const done = todayAttempt && todayAttempt.status !== 'playing';
  const puzzle = todayAttempt && getPuzzle(todayAttempt.puzzleId);
  const best = bestTimes(player, 1)[0];
  // One practice button: continue the one in progress, or start a new one.
  const practicing = resumable?.mode === 'practice' ? resumable : undefined;
  const otherDaily = resumable?.mode === 'daily' ? resumable : undefined;
  // Once today's daily is done, the red button goes to the leaderboard (server) or to Practice (offline).
  const practicePrimary = done && !serverEnabled;

  return (
    <div className="mx-auto flex min-h-[var(--app-h,100dvh)] max-w-md flex-col gap-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h1 className="sticker text-[min(1.375rem,6.9vw)]">Sarhad</h1>
        <p className="num flex items-center gap-3 font-display text-xl">
          <span className="inline-flex items-center gap-1.5" aria-label={`Streak ${stats.streak}`}>
            <Flame /> {stats.streak}
          </span>
          <span className="inline-flex items-center gap-1.5" aria-label={`${stats.totalPoints} points`}>
            <Coin /> {stats.totalPoints.toLocaleString('en-IN')}
          </span>
        </p>
      </header>

      <section aria-label={`Today, ${formatDate(today)}`} className="panel flex flex-col gap-3 p-4">
        <div className="relative mx-auto h-[min(14rem,30vh)] w-full">
          <MiniMap lit={puzzle ? [puzzle.start, puzzle.end] : []} className="h-full w-full" />
          {!puzzle && (
            <p className="absolute inset-0 flex items-center justify-center text-4xl" aria-hidden="true">
              <Pair a="?" b="?" className="rounded-card bg-white/85 px-3" />
            </p>
          )}
        </div>
        <p className="text-center font-display text-xl">
          {puzzle ? <Pair a={regionName(puzzle.start)} b={regionName(puzzle.end)} /> : `Today · ${formatDate(today)}`}
        </p>
        {!dailyAvailable && !todayAttempt && <p className="text-center text-muted">No daily today.</p>}
        {dailyAvailable && !todayAttempt && (
          <>
            {dailyNote && (
              <p className="text-center">
                <span role="status" className="err-pill text-sm">
                  {dailyNote}
                </span>
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
            <span className="num font-display text-3xl">
              {todayAttempt.status === 'won'
                ? `${formatTime(todayAttempt.serverTimeMs ?? elapsedMs(todayAttempt))} · ${todayAttempt.serverPoints ?? todayAttempt.points ?? 0} pts`
                : 'Not linked'}
            </span>
            <span className="text-muted">
              <Countdown />
            </span>
          </button>
        )}
        {done && serverEnabled && (
          <button className={primary} onClick={onDaily}>
            Leaderboard
          </button>
        )}
      </section>

      {otherDaily && (
        <button className={secondary} onClick={() => onOpen(otherDaily)}>
          Continue {formatDate(otherDaily.date!)}
        </button>
      )}
      <button className={practicePrimary ? primary : secondary} onClick={practicing ? () => onOpen(practicing) : onPractice}>
        {practicing ? 'Continue practice' : 'Practice'}
      </button>

      <div className="flex items-center justify-between gap-2">
        <p className="num text-sm text-muted">
          Best {best ? formatTime(best.serverTimeMs ?? elapsedMs(best)) : '–'} · Wins {stats.wins}
        </p>
        <div className="flex gap-2">
          <button
            className={`${icon} ${haptics ? '' : 'text-muted'}`}
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
          <button className={icon} aria-label="How to play" onClick={() => setCoach(true)}>
            ?
          </button>
        </div>
      </div>
      <Footer />
      {coach && <Coach onClose={() => setCoach(false)} />}
    </div>
  );
}
