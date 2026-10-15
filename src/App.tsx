import { useCallback, useEffect, useState } from 'react';
import { istDate, type RegionId } from '@engine/index.ts';
import { adjacency, dailyPuzzle, getPuzzle, randomPracticePuzzle } from './lib/data.ts';
import { useAppHeight, useOnline, useToday } from './lib/hooks.ts';
import { serverEnabled } from './lib/server.ts';
import { uuid } from './lib/uuid.ts';
import { activeAttempt, addGuess, createAttempt, findDaily, giveUp, startDailyAttempt, stats, upsertAttempt } from './game/model.ts';
import { loadPlayer, savePlayer, STORAGE_KEY, type LocalAttempt, type SavedPlayer } from './game/storage.ts';
import { fetchDailyStart, openSessionWhenIdle, syncPending } from './game/sync.ts';

const NEEDS_CONNECTION = 'Needs a connection to start. Practice still works offline.';
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
  const online = useOnline();
  const [player, setPlayer] = useState(readPlayer);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string>();
  // Loading → Playing when an attempt is in progress (it keeps its puzzle past midnight), else Home.
  const [view, setView] = useState<View>(() => {
    const a = activeAttempt(player);
    return a ? viewFor(a) : { name: 'home' };
  });

  const reload = useCallback(() => setPlayer(readPlayer()), []);

  useEffect(() => {
    // supabase-js loads after first paint; pending results are sent once signed in
    const cancelIdle = openSessionWhenIdle(() => void syncPending(reload));
    const onStorage = (e: StorageEvent) => e.key === STORAGE_KEY && reload(); // F3: other tab wrote
    const onOnline = () => void syncPending(reload);
    window.addEventListener('storage', onStorage);
    window.addEventListener('online', onOnline);
    return () => {
      cancelIdle();
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('online', onOnline);
    };
  }, [reload]);

  // Braces matter: Chromium's scrollTo returns a Promise, which React would call as the cleanup.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view.name]);

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
    if (saved.status !== 'playing' && saved.mode === 'daily') void syncPending(reload);
  }

  function openDaily() {
    const existing = findDaily(readPlayer(), today);
    if (existing) return setView(viewFor(existing));
    setStartError(undefined);
    // Server builds learn the pair only at Start (start_daily); offline builds use the bundled schedule.
    if (serverEnabled) return setView({ name: 'ready', mode: 'daily', date: today, puzzleId: '' });
    const p = dailyPuzzle(today);
    if (p) setView({ name: 'ready', mode: 'daily', date: today, puzzleId: p.id });
  }

  function openPractice() {
    const dailyId = findDaily(readPlayer(), today)?.puzzleId ?? dailyPuzzle(today)?.id;
    setView({ name: 'ready', mode: 'practice', date: today, puzzleId: randomPracticePuzzle(dailyId).id });
  }

  async function startServerDaily() {
    setStarting(true);
    setStartError(undefined);
    const s = await fetchDailyStart();
    setStarting(false);
    if (!s) return setStartError(NEEDS_CONNECTION);
    if (!getPuzzle(s.puzzleId)) return setStartError('This app is out of date. Reload to get today’s puzzle.');
    const fresh = readPlayer();
    const existing = findDaily(fresh, s.istDate);
    if (existing) return setView(viewFor(existing));
    if (s.status !== 'playing') return setStartError('Today’s daily was already finished on this account.');
    // Local startedAt drives the on-screen timer; the official time is server finish − server start.
    const a: LocalAttempt = { ...createAttempt('daily', s.puzzleId, s.istDate, Date.now(), uuid()), serverAttemptId: s.attemptId };
    commit(upsertAttempt(fresh, a, s.istDate));
    setView(viewFor(a));
  }

  function start(v: Extract<View, { name: 'ready' }>) {
    const now = Date.now();
    const fresh = readPlayer();
    if (v.mode === 'practice') {
      const a = createAttempt('practice', v.puzzleId, undefined, now, uuid());
      commit(upsertAttempt(fresh, a, istDate(now)));
      return setView(viewFor(a));
    }
    if (serverEnabled) return void startServerDaily();
    // Offline build: the daily belongs to the IST date on which Start is pressed.
    const date = istDate(now);
    const puzzle = dailyPuzzle(date);
    if (!puzzle) return setView({ name: 'home' });
    const r = startDailyAttempt(fresh, date, puzzle.id, now, uuid());
    commit(r.player);
    setView(viewFor(r.attempt));
  }

  const s = stats(player, today);
  const attempt = 'attemptId' in view ? player.attempts.find((a) => a.attemptId === view.attemptId) : undefined;
  const finishedInGame = view.name === 'game' && attempt && attempt.status !== 'playing' ? attempt : undefined;

  // A finished game moves to Result: a win first stays on the board for the stitch pulse and glow.
  const finishedId = finishedInGame?.attemptId;
  const finishedWon = finishedInGame?.status === 'won';
  useEffect(() => {
    if (!finishedId) return;
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = setTimeout(() => setView({ name: 'result', attemptId: finishedId }), finishedWon ? (reduced ? 400 : 1100) : 0);
    return () => clearTimeout(t);
  }, [finishedId, finishedWon]);
  const puzzle = attempt && getPuzzle(attempt.puzzleId);

  if (view.name === 'ready') {
    return (
      <Ready
        mode={view.mode}
        busy={starting}
        error={view.mode === 'daily' ? startError : undefined}
        onStart={() => start(view)}
        onHome={() => setView({ name: 'home' })}
      />
    );
  }

  if (view.name === 'game' && attempt && puzzle) {
    if (attempt.status === 'lost') return <Result attempt={attempt} puzzle={puzzle} player={player} stats={s} onPractice={openPractice} onHome={() => setView({ name: 'home' })} />;
    return (
      <Game
        attempt={attempt}
        puzzle={puzzle}
        firstGame={!player.attempts.some((a) => a.status !== 'playing')}
        onGuess={(id: RegionId, now) => act(attempt.attemptId, (a) => addGuess(a, id, puzzle, adjacency, now))}
        onGiveUp={(now) => act(attempt.attemptId, (a) => giveUp(a, now))}
        onHome={() => setView({ name: 'home' })}
        onSkip={() => setView({ name: 'result', attemptId: attempt.attemptId })}
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
      dailyAvailable={serverEnabled || Boolean(dailyPuzzle(today))}
      dailyNote={serverEnabled && !online ? NEEDS_CONNECTION : undefined}
      todayAttempt={todayAttempt}
      resumable={active && active.attemptId !== todayAttempt?.attemptId ? active : undefined}
      onDaily={openDaily}
      onPractice={openPractice}
      onOpen={(a) => setView(viewFor(a))}
    />
  );
}
