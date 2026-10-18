// @vitest-environment jsdom
// Server builds: the daily pair comes only from start_daily at Start (never from a bundled schedule).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { getPuzzle, regionName } from './lib/data.ts';
import { STORAGE_KEY } from './game/storage.ts';
import type { DailyBoard, DailyStats, ServerDailyStart } from './lib/server.ts';

const startDaily = vi.fn<() => Promise<ServerDailyStart | 'no_daily' | null>>();
const setDisplayName = vi.fn<(n: string) => Promise<string | null>>(async () => null);
const getDailyBoard = vi.fn<() => Promise<DailyBoard | null>>(async () => null);
const getDailyStats = vi.fn<() => Promise<DailyStats | null>>(async () => null);

vi.mock('./lib/server.ts', () => ({
  serverEnabled: true,
  ServerRejectedError: class extends Error {},
  ensureSession: async () => true,
  startDaily: () => startDaily(),
  finishDaily: async () => null,
  getDailyBoard: () => getDailyBoard(),
  getDailyStats: () => getDailyStats(),
  needsDisplayName: async () => false,
  setDisplayName: (n: string) => setDisplayName(n),
}));

const { App } = await import('./App.tsx');

// A date the bundled schedule does not cover, so the pair can only have come from the server.
const DATE = '2030-01-01';
const PUZZLE = getPuzzle('GJ-KL')!;

describe('App (server build)', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('sarhad:coach', '1'); // first-open coach already seen
    startDaily.mockReset();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(`${DATE}T06:00:00Z`));
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('takes the daily pair from start_daily at Start', async () => {
    startDaily.mockResolvedValue({
      attemptId: 'srv-1', istDate: DATE, puzzleId: PUZZLE.id, start: PUZZLE.start, end: PUZZLE.end,
      k: PUZZLE.k, startedAt: Date.now(), status: 'playing',
    });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^Play daily/ }));
    expect(startDaily).not.toHaveBeenCalled(); // Ready reveals nothing and asks the server nothing
    await act(async () => fireEvent.click(screen.getByText('Start')));
    expect(startDaily).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain(regionName(PUZZLE.end));
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved.player.attempts[0]).toMatchObject({ mode: 'daily', date: DATE, puzzleId: PUZZLE.id, serverAttemptId: 'srv-1' });
  });

  it('shows "Needs a connection to start" when start_daily fails; Practice still works', async () => {
    startDaily.mockResolvedValue(null);
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^Play daily/ }));
    await act(async () => fireEvent.click(screen.getByText('Start')));
    expect(screen.getByRole('alert').textContent).toMatch(/Needs a connection to start/);
    expect(localStorage.getItem(STORAGE_KEY) ?? '').not.toContain('"mode":"daily"');

    fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    fireEvent.click(screen.getByRole('button', { name: 'Practice' }));
    fireEvent.click(screen.getByText('Start'));
    expect(screen.getByText(/Guess 1 of 20/)).toBeTruthy();
  });

  it('shows "No daily today — try Practice" when the server has nothing scheduled', async () => {
    startDaily.mockResolvedValue('no_daily');
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^Play daily/ }));
    await act(async () => fireEvent.click(screen.getByText('Start')));
    expect(screen.getByRole('alert').textContent).toBe('No daily today — try Practice');
    expect(localStorage.getItem(STORAGE_KEY) ?? '').not.toContain('"mode":"daily"');
  });

  it('first open asks for a name before How to play, and sends it to the server', async () => {
    localStorage.removeItem('sarhad:coach');
    setDisplayName.mockClear();
    render(<App />);
    const input = screen.getByLabelText('Your name') as HTMLInputElement;
    expect(input.value).toMatch(/^Player [0-9A-F]{4}$/);
    expect(screen.queryByRole('dialog', { name: 'How to play' })).toBeNull();
    fireEvent.change(input, { target: { value: 'ab' } });
    fireEvent.click(screen.getByText("That's me"));
    expect(screen.getByRole('alert').textContent).toMatch(/3–20/);
    fireEvent.change(input, { target: { value: '  Asha   K ' } });
    await act(async () => fireEvent.click(screen.getByText("That's me")));
    expect(screen.getByRole('dialog', { name: 'How to play' })).toBeTruthy();
    expect(localStorage.getItem('sarhad:name')).toBe('Asha K');
    expect(setDisplayName).toHaveBeenCalledWith('Asha K');
    expect(localStorage.getItem('sarhad:name-synced')).toBe('Asha K');
  });

  it("leaderboard shows today's aggregates; without them the board still shows", async () => {
    getDailyBoard.mockResolvedValue({ rows: [{ rank: 1, displayName: 'Asha', timeMs: 41_000, nGuesses: 3, isMe: false }], myRank: null, myReview: null });
    getDailyStats.mockResolvedValue({ players: 12, medianMs: 45_000, fasterThanPct: 75, topState: 'MP' });
    render(<App />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Leaderboard' })));
    expect(screen.getByText('Players')).toBeTruthy();
    expect(screen.getByText('Median time')).toBeTruthy();
    expect(screen.getByText(/You were faster than/).textContent).toBe('You were faster than 75% today');
    expect(screen.getByText(/Most guessed today/).textContent).toContain(regionName('MP'));
    expect(screen.getByText(/1\. Asha/)).toBeTruthy();
    cleanup();

    getDailyStats.mockResolvedValue(null); // not deployed / failed
    render(<App />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Leaderboard' })));
    expect(screen.queryByText('Median time')).toBeNull();
    expect(screen.getByText(/1\. Asha/)).toBeTruthy();
  });

  it("the '? ⋯⋯ ?' mark animates while start_daily and the leaderboard load", async () => {
    startDaily.mockReturnValue(new Promise(() => {})); // never answers
    getDailyBoard.mockReturnValue(new Promise(() => {}));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^Play daily/ }));
    expect(screen.getByRole('img', { name: 'Two hidden states' })).toBeTruthy(); // idle on Ready
    await act(async () => fireEvent.click(screen.getByText('Start')));
    expect(screen.getByRole('status', { name: 'Starting' }).className).toContain('mark-busy');
    cleanup();
    render(<App />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Leaderboard' })));
    expect(screen.getByRole('status', { name: 'Loading leaderboard' }).className).toContain('mark-busy');
  });
});
