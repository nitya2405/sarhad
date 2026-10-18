import { useMemo, useState } from 'react';
import { Leaderboard } from '../components/bits.tsx';
import { MiniIndia } from '../components/MiniIndia.tsx';
import { NameCard } from '../components/NameCard.tsx';
import { BackButton } from '../components/ui.tsx';
import { bestTimes, elapsedMs, youStats, type Stats } from '../game/model.ts';
import type { SavedPlayer } from '../game/storage.ts';
import { adjacency, getPuzzle, playableIds, regionName } from '../lib/data.ts';
import { formatDate, formatTime } from '../lib/format.ts';
import { localName, syncName } from '../lib/name.ts';
import { serverEnabled } from '../lib/server.ts';

interface Props {
  player: SavedPlayer;
  stats: Stats;
  today: string;
  onHome: () => void;
}

/** Leaderboard (server builds: today's stats and board) and You (local: map of states met, records). */
export function Board({ player, stats, today, onHome }: Props) {
  const best = bestTimes(player, 5);
  const you = useMemo(() => youStats(player, getPuzzle, adjacency, playableIds), [player]);
  const [boardKey, setBoardKey] = useState(0);
  const [name, setName] = useState(localName);
  const [naming, setNaming] = useState(false);
  const tile = 'panel px-1 py-2.5 text-center';
  return (
    // the only scrolling screen: it scrolls inside its own container, never the page
    <div className="mx-auto flex h-full flex-col gap-4 overflow-y-auto overscroll-contain p-4" data-scroll="board">
      <header className="flex items-center gap-3">
        <BackButton onClick={onHome} />
        <h1 className="font-display text-3xl uppercase tracking-wide">{serverEnabled ? 'Leaderboard' : 'My stats'}</h1>
      </header>

      {naming ? (
        <NameCard
          inline
          onDone={(n) => {
            setName(n);
            setNaming(false);
            void syncName().then(() => setBoardKey((k) => k + 1));
          }}
        />
      ) : (
        <p className="flex items-center justify-between gap-3 text-sm">
          <span className="min-w-0 truncate">
            {name ? (
              <>
                Playing as <span className="font-display text-base">{name}</span>
              </>
            ) : (
              'No name yet'
            )}
          </span>
          <button className="min-h-11 shrink-0 px-2 font-semibold underline" onClick={() => setNaming(true)}>
            {name ? 'Change name' : 'Set name'}
          </button>
        </p>
      )}

      {serverEnabled && <Leaderboard date={today} refreshKey={boardKey} />}

      <section aria-labelledby="you" className="panel p-4">
        <h2 id="you" className="font-display text-lg uppercase tracking-wide">
          You
        </h2>
        <div className="mt-1 flex items-center gap-3">
          <MiniIndia on={you.discovered} className="h-28 w-24 shrink-0" />
          <p className="flex flex-col">
            <span className="num font-display text-4xl leading-none">
              {you.discovered.size}/{playableIds.size}
            </span>
            <span className="text-sm text-muted">states discovered</span>
          </p>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-2">
          <div className={tile}>
            <dd className="num font-display text-3xl leading-none">{you.shortestRoutes}</dd>
            <dt className="mt-1 text-xs text-muted">Shortest routes</dt>
          </div>
          <div className={tile}>
            <dd className="num font-display text-3xl leading-none">{you.fastestMs == null ? '—' : formatTime(you.fastestMs)}</dd>
            <dt className="mt-1 text-xs text-muted">Fastest win</dt>
          </div>
          <div className={tile}>
            <dd className="num font-display text-3xl leading-none">{stats.best}</dd>
            <dt className="mt-1 text-xs text-muted">Best streak</dt>
          </div>
          <div className={tile}>
            <dd className="num font-display text-3xl leading-none">{stats.wins}</dd>
            <dt className="mt-1 text-xs text-muted">Wins</dt>
          </div>
        </dl>
      </section>

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
