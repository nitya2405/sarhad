import { useState } from 'react';
import { Leaderboard, NamePrompt } from '../components/bits.tsx';
import { BackButton } from '../components/ui.tsx';
import { bestTimes, elapsedMs, type Stats } from '../game/model.ts';
import type { SavedPlayer } from '../game/storage.ts';
import { getPuzzle, regionName } from '../lib/data.ts';
import { formatDate, formatTime } from '../lib/format.ts';
import { serverEnabled } from '../lib/server.ts';

interface Props {
  player: SavedPlayer;
  stats: Stats;
  today: string;
  onHome: () => void;
}

/** Leaderboard (server builds: today's board) or My stats (offline: best times, wins, streaks). */
export function Board({ player, stats, today, onHome }: Props) {
  const best = bestTimes(player, 5);
  const [boardKey, setBoardKey] = useState(0);
  const tile = 'panel px-1 py-2.5 text-center';
  return (
    <div className="mx-auto flex min-h-[var(--app-h,100dvh)] flex-col gap-4 p-4">
      <header className="flex items-center gap-3">
        <BackButton onClick={onHome} />
        <h1 className="font-display text-3xl uppercase tracking-wide">{serverEnabled ? 'Leaderboard' : 'My stats'}</h1>
      </header>

      <dl className="grid grid-cols-3 gap-2">
        <div className={tile}>
          <dd className="num font-display text-3xl leading-none">{stats.wins}</dd>
          <dt className="mt-1 text-xs text-muted">Wins</dt>
        </div>
        <div className={tile}>
          <dd className="num font-display text-3xl leading-none">{stats.streak}</dd>
          <dt className="mt-1 text-xs text-muted">Streak</dt>
        </div>
        <div className={tile}>
          <dd className="num font-display text-3xl leading-none">{stats.best}</dd>
          <dt className="mt-1 text-xs text-muted">Best streak</dt>
        </div>
      </dl>

      {serverEnabled && stats.wins > 0 && <NamePrompt onSaved={() => setBoardKey((k) => k + 1)} />}
      {serverEnabled && <Leaderboard date={today} refreshKey={boardKey} />}

      <section aria-labelledby="best" className="panel p-4">
        <h2 id="best" className="font-display text-lg uppercase tracking-wide">
          Best times
        </h2>
        {best.length === 0 ? (
          <p className="text-sm text-muted">No daily wins yet.</p>
        ) : (
          <ol className="mt-1 flex flex-col gap-1 text-sm">
            {best.map((a, i) => {
              const p = getPuzzle(a.puzzleId);
              return (
                <li key={a.attemptId} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate">
                    {i + 1}. {formatDate(a.date!)}
                    {p && <span className="text-muted"> · {regionName(p.start)} – {regionName(p.end)}</span>}
                  </span>
                  <span className="num font-semibold">{formatTime(a.serverTimeMs ?? elapsedMs(a))}</span>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
