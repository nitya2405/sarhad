// @vitest-environment jsdom
// Server builds: the daily pair comes only from start_daily at Start (never from a bundled schedule).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { getPuzzle, regionName } from './lib/data.ts';
import { STORAGE_KEY } from './game/storage.ts';
import type { ServerDailyStart } from './lib/server.ts';

const startDaily = vi.fn<() => Promise<ServerDailyStart | 'no_daily' | null>>();

vi.mock('./lib/server.ts', () => ({
  serverEnabled: true,
  ServerRejectedError: class extends Error {},
  ensureSession: async () => true,
  startDaily: () => startDaily(),
  finishDaily: async () => null,
  getDailyBoard: async () => null,
  needsDisplayName: async () => false,
  setDisplayName: async () => null,
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
});
