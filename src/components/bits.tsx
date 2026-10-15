import { useEffect, useState, type FormEvent } from 'react';
import { nextIstMidnight } from '@engine/index.ts';
import { formatCountdown, formatTime } from '../lib/format.ts';
import { useNow } from '../lib/hooks.ts';
import { getDailyBoard, needsDisplayName, setDisplayName, type DailyBoard } from '../lib/server.ts';

export function Countdown() {
  const now = useNow(1000);
  return (
    <span>
      Next in <span className="num">{formatCountdown(nextIstMidnight(now) - now)}</span>
    </span>
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
    <section aria-labelledby="board" className="rounded-card bg-white p-4">
      <h2 id="board" className="font-display text-lg font-semibold">
        Today
      </h2>
      {board === undefined && <p className="text-sm text-ink-soft">Loading…</p>}
      {board === null && <p className="text-sm text-ink-soft">Leaderboard offline.</p>}
      {board && board.rows.length === 0 && <p className="text-sm text-ink-soft">No winners yet.</p>}
      {board && board.rows.length > 0 && (
        <ol className="mt-1 flex flex-col gap-1 text-sm">
          {board.rows.map((r) => (
            <li
              key={`${r.rank}-${r.displayName}`}
              className={`flex justify-between gap-3 rounded-full px-2 py-0.5 ${r.isMe ? 'bg-marigold font-semibold' : ''}`}
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
    <form onSubmit={save} className="flex flex-col gap-2 rounded-card border-2 border-marigold-deep bg-white p-3">
      <label htmlFor="display-name" className="font-semibold">
        Your name on the board
      </label>
      <div className="flex gap-2">
        <input
          id="display-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          autoComplete="nickname"
          className="min-h-12 min-w-0 flex-1 rounded-card border-2 border-ink-line bg-white px-3"
        />
        <button className="min-h-12 rounded-card bg-ink px-4 font-display font-extrabold text-paper">Save</button>
      </div>
      <p role="status" className="text-sm font-semibold text-kumkum">
        {error}
      </p>
    </form>
  );
}

export function Footer() {
  return (
    <footer className="mt-auto pt-4 text-center text-xs text-ink-soft">
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
