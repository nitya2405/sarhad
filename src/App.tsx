import { useCallback, useEffect, useState } from 'react';
import { istDate, type RegionId } from '@engine/index.ts';
import { adjacency, dailyPuzzle, getPuzzle, randomPracticePuzzle } from './lib/data.ts';
import { useAppHeight, useToday } from './lib/hooks.ts';
import { uuid } from './lib/uuid.ts';
import { activeAttempt, addGuess, createAttempt, findDaily, giveUp, startDailyAttempt, stats, upsertAttempt } from './game/model.ts';
import { loadPlayer, savePlayer, STORAGE_KEY, type LocalAttempt, type SavedPlayer } from './game/storage.ts';
import { openSession, registerDailyStart, syncPending } from './game/sync.ts';
import { Home } from './screens/Home.tsx';
import { Game, Ready } from './screens/Game.tsx';
import { Result } from './screens/Result.tsx';

type View =
  | { name: 'home' }
  | { name: 'ready'; mode: 'daily' | 'practice'; date: string; puzzleId: string }
  | { name: 'game'; attemptId: string }
  | { name: 'result'; attemptId: string };

/** Hide attempts whose puzzle is no longer in the shipped data (never crash on them). */
function readPlayer(): SavedPlayer {
  const p = loadPlayer();
  return { ...p, attempts: p.attempts.filter((a) => getPuzzle(a.puzzleId)) };
}

function viewFor(a: LocalAttempt): View {
  return a.status === 'playing' ? { name: 'game', attemptId: a.attemptId } : { name: 'result', attemptId: a.attemptId };
}

export function App() {
  useAppHeight();
  const today = useToday();
  const [player, setPlayer] = useState(readPlayer);
  // Loading → Playing when an attempt is in progress (it keeps its puzzle past midnight), else Home.
  const [view, setView] = useState<View>(() => {
    const a = activeAttempt(player);
    return a ? viewFor(a) : { name: 'home' };
  });

  const reload = useCallback(() => setPlayer(readPlayer()), []);

  useEffect(() => {
    openSession();
    void syncPending(reload);
    const onStorage = (e: StorageEvent) => e.key === STORAGE_KEY && reload(); // F3: other tab wrote
    const onOnline = () => void syncPending(reload);
    window.addEventListener('storage', onStorage);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('online', onOnline);
    };
  }, [reload]);

  useEffect(() => window.scrollTo(0, 0), [view.name]);

  function commit(p: SavedPlayer) {
    savePlayer(p);
    setPlayer(readPlayer());
  }

  /** Applies a change to the freshest stored copy of an attempt (another tab may have moved it on). */
  function act(attemptId: string, change: (a: LocalAttempt) => LocalAttempt) {
    const fresh = readPlayer();
    const stored = fresh.attempts.find((a) => a.attemptId === attemptId);
    if (!stored) return setView({ name: 'home' });
    const next = upsertAttempt(fresh, change(stored), istDate(Date.now()));
    commit(next);
    const saved = next.attempts.find((a) => a.attemptId === attemptId)!;
    if (saved.status !== 'playing') {
      setView({ name: 'result', attemptId });
      if (saved.mode === 'daily') void syncPending(reload);
    }
  }

  function openDaily() {
    const existing = findDaily(readPlayer(), today);
    if (existing) return setView(viewFor(existing));
    const p = dailyPuzzle(today);
    if (p) setView({ name: 'ready', mode: 'daily', date: today, puzzleId: p.id });
  }

  function openPractice() {
    setView({ name: 'ready', mode: 'practice', date: today, puzzleId: randomPracticePuzzle(dailyPuzzle(today)?.id).id });
  }

  function start(v: Extract<View, { name: 'ready' }>) {
    const now = Date.now();
    const fresh = readPlayer();
    if (v.mode === 'practice') {
      const a = createAttempt('practice', v.puzzleId, undefined, now, uuid());
      commit(upsertAttempt(fresh, a, istDate(now)));
      return setView(viewFor(a));
    }
    // The daily belongs to the IST date on which Start is pressed.
    const date = istDate(now);
    const puzzle = dailyPuzzle(date);
    if (!puzzle) return setView({ name: 'home' });
    const r = startDailyAttempt(fresh, date, puzzle.id, now, uuid());
    commit(r.player);
    registerDailyStart(r.attempt);
    setView(viewFor(r.attempt));
  }

  const s = stats(player, today);
  const attempt = 'attemptId' in view ? player.attempts.find((a) => a.attemptId === view.attemptId) : undefined;
  const puzzle = attempt && getPuzzle(attempt.puzzleId);

  if (view.name === 'ready') return <Ready mode={view.mode} date={view.date} onStart={() => start(view)} onHome={() => setView({ name: 'home' })} />;

  if (view.name === 'game' && attempt && puzzle) {
    if (attempt.status !== 'playing') return <Result attempt={attempt} puzzle={puzzle} player={player} stats={s} onPractice={openPractice} onHome={() => setView({ name: 'home' })} />;
    return (
      <Game
        attempt={attempt}
        puzzle={puzzle}
        onGuess={(id: RegionId, now) => act(attempt.attemptId, (a) => addGuess(a, id, puzzle, adjacency, now))}
        onGiveUp={(now) => act(attempt.attemptId, (a) => giveUp(a, now))}
        onHome={() => setView({ name: 'home' })}
      />
    );
  }

  if (view.name === 'result' && attempt && puzzle) {
    return <Result attempt={attempt} puzzle={puzzle} player={player} stats={s} onPractice={openPractice} onHome={() => setView({ name: 'home' })} />;
  }

  const todayAttempt = findDaily(player, today);
  const active = activeAttempt(player);
  return (
    <Home
      player={player}
      stats={s}
      today={today}
      todayPuzzle={dailyPuzzle(today)}
      todayAttempt={todayAttempt}
      resumable={active && active.attemptId !== todayAttempt?.attemptId ? active : undefined}
      onDaily={openDaily}
      onPractice={openPractice}
      onOpen={(a) => setView(viewFor(a))}
    />
  );
}
