import { useEffect, useState } from 'react';
import { nextIstMidnight } from '@engine/index.ts';
import { formatCountdown, formatTime } from '../lib/format.ts';
import { useNow } from '../lib/hooks.ts';
import { getDailyBoard, getDailyStats, type DailyBoard, type DailyStats } from '../lib/server.ts';
import { regionName } from '../lib/data.ts';
import { Mark } from './ui.tsx';

export function Countdown() {
  const now = useNow(1000);
  return (
    <span>
      Next in <span className="num">{formatCountdown(nextIstMidnight(now) - now)}</span>
    </span>
  );
}

/** Today's stats and leaderboard (phase 2). Shown only when the server is enabled. */
export function Leaderboard({ date, refreshKey }: { date: string; refreshKey: unknown }) {
  const [board, setBoard] = useState<DailyBoard | null | undefined>(undefined);
  const [stats, setStats] = useState<DailyStats | null>(null);
  useEffect(() => {
    let live = true;
    // the stats are optional: without them (offline, or not deployed yet) the board still shows
    void Promise.all([getDailyBoard(date).catch(() => null), getDailyStats(date).catch(() => null)]).then(([b, s]) => {
      if (!live) return;
      setBoard(b);
      setStats(s);
    });
    return () => {
      live = false;
    };
  }, [date, refreshKey]);

  return (
    <section aria-labelledby="board" className="panel p-4">
      <h2 id="board" className="font-display text-lg uppercase tracking-wide">
        Today
      </h2>
      {board === undefined && (
        <p className="py-2 text-center text-3xl">
          <Mark busy label="Loading leaderboard" />
        </p>
      )}
      {board === null && <p className="text-sm text-muted">Leaderboard offline.</p>}
      {board && stats && <TodayStats s={stats} />}
      {board && board.rows.length === 0 && <p className="text-sm text-muted">No winners yet.</p>}
      {board && board.rows.length > 0 && (
        <ol className="mt-1 flex flex-col gap-1 text-sm">
          {board.rows.map((r) => (
            <li
              key={`${r.rank}-${r.displayName}`}
              className={`flex justify-between gap-3 rounded-full px-2 py-0.5 ${r.isMe ? 'bg-red font-semibold text-white' : ''}`}
            >
              <span>
                {r.rank}. {r.displayName}
                {r.isMe && ' (you)'}
              </span>
              <span className="num">
                {formatTime(r.timeMs)} · {r.nGuesses}
              </span>
            </li>
          ))}
        </ol>
      )}
      {board?.myRank != null && !board.rows.some((r) => r.isMe) && <p className="mt-1 text-sm">Your rank: {board.myRank}</p>}
      {board?.myReview && (
        <p className="mt-1 text-sm text-muted">
          You: <span className="num">{formatTime(board.myReview.timeMs)} · {board.myReview.nGuesses}</span> (under review: very fast finish)
        </p>
      )}
    </section>
  );
}

function TodayStats({ s }: { s: DailyStats }) {
  const tile = 'rounded-card border-2 border-ink px-1 py-2 text-center';
  return (
    <div className="mt-2 mb-3 flex flex-col gap-2">
      <dl className="grid grid-cols-2 gap-2">
        <div className={tile}>
          <dd className="num font-display text-2xl leading-none">{s.players.toLocaleString('en-IN')}</dd>
          <dt className="mt-1 text-xs text-muted">{s.players === 1 ? 'Player' : 'Players'}</dt>
        </div>
        <div className={tile}>
          <dd className="num font-display text-2xl leading-none">{s.medianMs == null ? '—' : formatTime(s.medianMs)}</dd>
          <dt className="mt-1 text-xs text-muted">Median time</dt>
        </div>
      </dl>
      {s.fasterThanPct != null && (
        <p className="text-sm">
          You were faster than <span className="num font-display text-base">{s.fasterThanPct}%</span> today
        </p>
      )}
      {s.topState && (
        <p className="text-sm">
          Most guessed today: <span className="font-display text-base">{regionName(s.topState)}</span>
        </p>
      )}
    </div>
  );
}

export function Footer() {
  return (
    <footer className="mt-auto pt-4 text-center text-xs text-muted">
      Map data ©{' '}
      <a className="underline" href="https://simplemaps.com/gis/country/in" target="_blank" rel="noreferrer">
        SimpleMaps
      </a>
      ,{' '}
      <a className="underline" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
        CC BY 4.0
      </a>
    </footer>
  );
}
