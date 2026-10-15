import { useEffect, useState, type FormEvent } from 'react';
import { nextIstMidnight } from '@engine/index.ts';
import { formatCountdown, formatDate, formatTime } from '../lib/format.ts';
import { useNow } from '../lib/hooks.ts';
import { getPuzzle, regionName } from '../lib/data.ts';
import { getDailyBoard, needsDisplayName, setDisplayName, type DailyBoard } from '../lib/server.ts';
import { elapsedMs } from '../game/model.ts';
import type { LocalAttempt } from '../game/storage.ts';
import type { Stats } from '../game/model.ts';

export function Countdown() {
  const now = useNow(1000);
  return (
    <span>
      Next daily in <span className="font-mono tabular-nums">{formatCountdown(nextIstMidnight(now) - now)}</span>
    </span>
  );
}

export function StatsRow({ stats, showPoints = true }: { stats: Stats; showPoints?: boolean }) {
  const items: [string, number][] = [
    ...(showPoints ? ([['Points', stats.totalPoints]] as [string, number][]) : []),
    ['Streak', stats.streak],
    ['Best streak', stats.best],
    ['Wins', stats.wins],
  ];
  return (
    <dl className="grid grid-cols-2 gap-2 min-[360px]:grid-cols-4">
      {items.map(([k, v]) => (
        <div key={k} className="rounded-lg bg-slate-100 p-2 text-center">
          <dt className="text-xs text-slate-600">{k}</dt>
          <dd className="text-xl font-semibold tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** 'Your best times' — this phone only, never presented as a global board. */
export function BestTimes({ attempts }: { attempts: LocalAttempt[] }) {
  return (
    <section aria-labelledby="best-times">
      <h2 id="best-times" className="font-semibold">
        Your best times <span className="text-sm font-normal text-slate-500">(on this phone)</span>
      </h2>
      {attempts.length === 0 ? (
        <p className="text-sm text-slate-500">Win a daily to set your first time.</p>
      ) : (
        <ol className="mt-1 flex flex-col gap-1 text-sm">
          {attempts.map((a) => {
            const p = getPuzzle(a.puzzleId);
            return (
              <li key={a.attemptId} className="flex flex-wrap justify-between gap-x-3">
                <span>
                  {formatDate(a.date!)} · {p ? `${regionName(p.start)} → ${regionName(p.end)}` : a.puzzleId}
                </span>
                <span className="tabular-nums">
                  {formatTime(a.serverTimeMs ?? elapsedMs(a))} · {a.guesses.length} guesses
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

/** Today's leaderboard (phase 2). Shown only when the server is enabled. */
export function Leaderboard({ date, refreshKey }: { date: string; refreshKey: unknown }) {
  const [board, setBoard] = useState<DailyBoard | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    getDailyBoard(date)
      .catch(() => null)
      .then((b) => live && setBoard(b));
    return () => {
      live = false;
    };
  }, [date, refreshKey]);

  return (
    <section aria-labelledby="board">
      <h2 id="board" className="font-semibold">
        Today's leaderboard
      </h2>
      {board === undefined && <p className="text-sm text-slate-500">Loading…</p>}
      {board === null && <p className="text-sm text-slate-500">Leaderboard unavailable right now.</p>}
      {board && board.rows.length === 0 && <p className="text-sm text-slate-500">No winners yet today.</p>}
      {board && board.rows.length > 0 && (
        <ol className="mt-1 flex flex-col gap-1 text-sm">
          {board.rows.map((r) => (
            <li key={`${r.rank}-${r.displayName}`} className={`flex justify-between gap-3 ${r.isMe ? 'font-semibold text-teal-800' : ''}`}>
              <span>
                {r.rank}. {r.displayName}
                {r.isMe && ' (you)'}
              </span>
              <span className="tabular-nums">
                {formatTime(r.timeMs)} · {r.nGuesses}
              </span>
            </li>
          ))}
        </ol>
      )}
      {board?.myRank != null && !board.rows.some((r) => r.isMe) && <p className="mt-1 text-sm">Your rank: {board.myRank}</p>}
    </section>
  );
}

/** Display-name prompt after the first win (phase 2). */
export function NamePrompt({ onSaved }: { onSaved: () => void }) {
  const [show, setShow] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    needsDisplayName()
      .catch(() => false)
      .then(setShow);
  }, []);
  if (!show) return null;

  async function save(e: FormEvent) {
    e.preventDefault();
    let err: string | null;
    try {
      err = await setDisplayName(name);
    } catch {
      err = 'Could not save right now.';
    }
    if (err) return setError(err);
    setShow(false);
    onSaved();
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-2 rounded-lg border border-teal-700 p-3">
      <label htmlFor="display-name" className="font-semibold">
        Name for the leaderboard
      </label>
      <div className="flex gap-2">
        <input
          id="display-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          autoComplete="nickname"
          className="min-w-0 flex-1 rounded-lg border border-slate-400 px-3 py-2"
        />
        <button className="rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white">Save</button>
      </div>
      <p role="status" className="text-sm text-rose-700">
        {error}
      </p>
    </form>
  );
}

export function Footer() {
  return (
    <footer className="mt-auto pt-6 text-center text-xs text-slate-500">
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
