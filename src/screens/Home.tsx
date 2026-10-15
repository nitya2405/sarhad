import type { Puzzle } from '@engine/index.ts';
import { BestTimes, Countdown, Footer, StatsRow } from '../components/bits.tsx';
import { bestTimes, elapsedMs, type Stats } from '../game/model.ts';
import type { LocalAttempt, SavedPlayer } from '../game/storage.ts';
import { formatDate, formatTime } from '../lib/format.ts';

interface Props {
  player: SavedPlayer;
  stats: Stats;
  today: string;
  todayPuzzle: Puzzle | undefined;
  todayAttempt: LocalAttempt | undefined;
  /** an unfinished attempt from another date or practice */
  resumable: LocalAttempt | undefined;
  onDaily: () => void;
  onPractice: () => void;
  onOpen: (a: LocalAttempt) => void;
}

const btn = 'rounded-lg px-4 py-3 text-center font-semibold';

export function Home({ player, stats, today, todayPuzzle, todayAttempt, resumable, onDaily, onPractice, onOpen }: Props) {
  const done = todayAttempt && todayAttempt.status !== 'playing';
  return (
    <div className="mx-auto flex min-h-[var(--app-h,100dvh)] max-w-md flex-col gap-5 p-4">
      <header>
        <h1 className="text-3xl font-bold text-teal-800">Sarhad</h1>
        <p className="text-slate-700">Connect two Indian states by naming the regions between them — as fast as you can.</p>
      </header>

      <section aria-labelledby="daily" className="flex flex-col gap-3 rounded-xl border border-slate-300 p-4">
        <h2 id="daily" className="text-lg font-semibold">
          Daily · {formatDate(today)}
        </h2>
        {!todayPuzzle && !todayAttempt && <p>No daily scheduled for today. Try Practice.</p>}
        {todayPuzzle && !todayAttempt && (
          <>
            <p className="text-sm text-slate-600">One scored attempt. The clock starts when you press Start.</p>
            <button className={`${btn} bg-teal-700 text-white`} onClick={onDaily}>
              Play today's puzzle
            </button>
          </>
        )}
        {todayAttempt?.status === 'playing' && (
          <button className={`${btn} bg-teal-700 text-white`} onClick={onDaily}>
            Continue today's puzzle
          </button>
        )}
        {done && (
          <>
            <p>
              Done today ✓ —{' '}
              {todayAttempt.status === 'won'
                ? `${todayAttempt.serverPoints ?? todayAttempt.points ?? 0} points in ${formatTime(todayAttempt.serverTimeMs ?? elapsedMs(todayAttempt))}`
                : 'not linked this time'}
            </p>
            <button className={`${btn} border border-teal-700 text-teal-800`} onClick={onDaily}>
              See result
            </button>
            <p className="text-sm text-slate-600">
              <Countdown />
            </p>
          </>
        )}
      </section>

      {resumable && (
        <button className={`${btn} border border-teal-700 text-teal-800`} onClick={() => onOpen(resumable)}>
          Continue {resumable.mode === 'daily' ? `the ${formatDate(resumable.date!)} daily` : 'practice'}
        </button>
      )}

      <button className={`${btn} bg-slate-800 text-white`} onClick={onPractice}>
        Practice (unscored)
      </button>

      <StatsRow stats={stats} />
      <BestTimes attempts={bestTimes(player)} />

      <section aria-labelledby="how" className="text-sm text-slate-700">
        <h2 id="how" className="font-semibold text-slate-900">
          How to play
        </h2>
        <p>
          Name states and union territories, in any order, until your guesses form a land route from start to end. Any route
          wins; faster wins earn more points. 20 guesses at most. Andaman & Nicobar, Lakshadweep and Puducherry have no land
          route and are not playable.
        </p>
      </section>
      <Footer />
    </div>
  );
}
