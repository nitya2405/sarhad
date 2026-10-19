import { useState } from 'react';
import { GUESS_CAP } from '@engine/index.ts';
import { Countdown } from '../components/bits.tsx';
import { Coach, coachSeen } from '../components/Coach.tsx';
import { Hero } from '../components/Hero.tsx';
import { NameCard } from '../components/NameCard.tsx';
import { Coin, Flame } from '../components/pixel.tsx';
import { elapsedMs, type Stats } from '../game/model.ts';
import type { LocalAttempt, SavedPlayer } from '../game/storage.ts';
import { formatDate, formatTime } from '../lib/format.ts';
import { setSoundOn, soundOn } from '../lib/sound.ts';
import { serverEnabled } from '../lib/server.ts';
import { dismissInstallTip, showInstallTip } from '../lib/persist.ts';
import { localName } from '../lib/name.ts';

interface Props {
  player: SavedPlayer;
  stats: Stats;
  today: string;
  /** a daily can be started today (server builds: always; offline builds: if the bundled schedule covers today) */
  dailyAvailable: boolean;
  /** shown above the daily button, e.g. 'Needs a connection to start' */
  dailyNote?: string;
  todayAttempt: LocalAttempt | undefined;
  /** an unfinished attempt from another date or practice */
  resumable: LocalAttempt | undefined;
  onDaily: () => void;
  onPractice: () => void;
  onOpen: (a: LocalAttempt) => void;
  /** Leaderboard (server builds) or My stats (offline) */
  onBoard: () => void;
}

// On the red background: primary = white face + red text, secondary = ink face + white text.
const primary = 'btn btn-light w-full text-2xl';
const secondary = 'btn btn-dark w-full';
const icon = 'btn btn-2 btn-icon';

/** Home: a one-screen game menu. Status in the corners, the wordmark, the hero art, three big buttons. */
export function Home({ stats, today, dailyAvailable, dailyNote, todayAttempt, resumable, onDaily, onPractice, onOpen, onBoard }: Props) {
  // First open: the name card, then How to play.
  const [naming, setNaming] = useState(() => !coachSeen() && !localName());
  const [coach, setCoach] = useState(() => !coachSeen());
  const [sound, setSound] = useState(soundOn);
  const [installTip, setInstallTip] = useState(showInstallTip);
  const done = todayAttempt && todayAttempt.status !== 'playing' ? todayAttempt : undefined;
  // One practice button: continue the one in progress, or start a new one.
  const practicing = resumable?.mode === 'practice' ? resumable : undefined;
  const otherDaily = resumable?.mode === 'daily' ? resumable : undefined;
  // Once today's daily is done the red button moves: to the leaderboard (server) or to Practice (offline).
  const boardPrimary = !!done && serverEnabled;
  const practicePrimary = !!done && !serverEnabled;

  return (
    <div className="home-bg mx-auto flex h-full flex-col overflow-hidden px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between gap-3">
        <button
          className={`${icon} ${sound ? '' : 'text-muted'}`}
          aria-label="Sound"
          aria-pressed={sound}
          onClick={() => {
            setSoundOn(!sound);
            setSound(!sound);
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 9h4l5-4v14l-5-4H4z" />
            {sound ? <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /> : <path d="M17 9l5 6M22 9l-5 6" />}
          </svg>
        </button>
        <p className="num ml-auto flex flex-wrap items-center justify-end gap-x-3 rounded-full border-[3px] border-ink bg-white px-3 py-1 font-display text-xl">
          <span className="inline-flex items-center gap-1.5" aria-label={`Streak ${stats.streak}`}>
            <Flame /> {stats.streak}
          </span>
          <span className="inline-flex items-center gap-1.5" aria-label={`${stats.totalPoints} points`}>
            <Coin /> {stats.totalPoints.toLocaleString('en-IN')}
          </span>
        </p>
      </header>

      <h1 className="mt-2 text-center">
        {/* letters bob one after another, every 4 s (still with reduced motion) */}
        <span className="sticker sticker-inv text-[min(2.75rem,12.5vw)]">
          <span className="sr-only">Sarhad</span>
          {'Sarhad'.split('').map((c, i) => (
            <span key={i} className="wave" style={{ animationDelay: `${i * 110}ms` }} aria-hidden="true">
              {c}
            </span>
          ))}
        </span>
      </h1>

      <div className="relative mt-3 min-h-24 flex-1">
        <Hero className="absolute inset-0 h-full w-full" />
      </div>

      {installTip && (
        <p className="mt-2 flex items-center gap-1 rounded-full border-2 border-ink bg-white pl-3 text-sm font-semibold text-ink">
          <span className="min-w-0 flex-1">Add to Home Screen to keep your streak.</span>
          <button
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-base"
            aria-label="Dismiss tip"
            onClick={() => {
              dismissInstallTip();
              setInstallTip(false);
            }}
          >
            ✕
          </button>
        </p>
      )}

      <nav aria-label={`Today, ${formatDate(today)}`} className="mt-3 flex flex-col gap-3">
        {dailyNote && !todayAttempt && (
          <p className="text-center">
            <span role="status" className="err-pill text-sm">
              {dailyNote}
            </span>
          </p>
        )}
        {!todayAttempt &&
          (dailyAvailable ? (
            <button className={`${primary} flex-col gap-0.5 py-1.5`} onClick={onDaily} aria-label={`Play daily, ${formatDate(today)}`}>
              <span>Play daily</span>
              <span className="text-sm tracking-wide">{formatDate(today)}</span>
            </button>
          ) : (
            <p className="panel py-3 text-center font-display text-lg">No daily today</p>
          ))}
        {todayAttempt?.status === 'playing' && (
          <button className={primary} onClick={onDaily}>
            Continue daily
          </button>
        )}
        {done && (
          <button onClick={onDaily} className="panel flex min-h-[52px] flex-col items-center px-3 py-2" aria-label="See today's result">
            <span className="num font-display text-xl">
              {done.status === 'won'
                ? `Done ✓ ${formatTime(done.serverTimeMs ?? elapsedMs(done))} · ${done.serverPoints ?? done.points ?? 0} pts`
                : done.guesses.length >= GUESS_CAP
                  ? 'Out of guesses'
                  : 'You gave up'}
            </span>
            <span className="text-sm text-muted">
              <Countdown />
            </span>
          </button>
        )}

        <button className={practicePrimary ? primary : secondary} onClick={practicing ? () => onOpen(practicing) : onPractice}>
          {practicing ? 'Continue practice' : 'Practice'}
        </button>
        <button className={boardPrimary ? primary : secondary} onClick={onBoard}>
          {serverEnabled ? 'Leaderboard' : 'My stats'}
        </button>
        {otherDaily && (
          <button className="min-h-11 text-sm font-semibold text-white underline" onClick={() => onOpen(otherDaily)}>
            Continue the {formatDate(otherDaily.date!)} daily
          </button>
        )}
      </nav>

      <footer className="mt-2 flex items-center justify-between gap-3">
        <button className={icon} aria-label="How to play" onClick={() => setCoach(true)}>
          ?
        </button>
        <p className="text-right text-xs text-white/85">
          Map data ©{' '}
          <a className="underline" href="https://simplemaps.com/gis/country/in" target="_blank" rel="noreferrer">
            SimpleMaps
          </a>
          ,{' '}
          <a className="underline" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
            CC BY 4.0
          </a>
        </p>
      </footer>
      {naming ? <NameCard onDone={() => setNaming(false)} /> : coach && <Coach onClose={() => setCoach(false)} />}
    </div>
  );
}
