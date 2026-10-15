// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { istDate } from '@engine/index.ts';
import { dailyPuzzle, regionName } from './lib/data.ts';
import { STORAGE_KEY } from './game/storage.ts';

vi.mock('./lib/server.ts', () => ({
  serverEnabled: false,
  ServerRejectedError: class extends Error {},
  ensureSession: async () => false,
  startDaily: async () => null,
  finishDaily: async () => null,
  getDailyBoard: async () => null,
  needsDisplayName: async () => false,
  setDisplayName: async () => null,
}));

const { App } = await import('./App.tsx');

function type(text: string) {
  const input = screen.getByLabelText('Name a state or union territory');
  fireEvent.change(input, { target: { value: text } });
  fireEvent.submit(input.closest('form')!);
}

describe('App (smoke)', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('sarhad:coach', '1'); // first-open coach already seen
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-16T06:00:00Z')); // first scheduled daily
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('plays today’s daily from Home to Result, rejecting bad input without spending guesses', async () => {
    const puzzle = dailyPuzzle(istDate(Date.now()))!;
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    // Ready: endpoints hidden until Start
    expect(screen.queryByText(new RegExp(regionName(puzzle.start)))).toBeNull();
    fireEvent.click(screen.getByText('Start'));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain(regionName(puzzle.end));

    type('Paris');
    expect(screen.getByRole('status').textContent).toBe('Not a state name');
    type(regionName(puzzle.start));
    expect(screen.getByRole('status').textContent).toBe("That's your start");
    type('Puducherry');
    expect(screen.getByRole('status').textContent).toBe('No land border — not playable');
    expect(screen.getByText(/Guess 1 of 20/)).toBeTruthy();

    for (const id of puzzle.shortest.slice(1, -1)) type(regionName(id));
    await act(async () => {});
    expect(await screen.findByText('Linked!', undefined, { timeout: 3000 })).toBeTruthy(); // after the win pulse
    expect(screen.getByText('You found a shortest route!')).toBeTruthy();

    // F2: reopening lands on Done today, not a second attempt
    cleanup();
    render(<App />);
    expect(screen.getByRole('button', { name: "See today's result" })).toBeTruthy();
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved.player.attempts).toHaveLength(1);
  });

  it('F4: loads with a corrupt save', () => {
    localStorage.setItem(STORAGE_KEY, '{"schemaVersion":1,"player":');
    render(<App />);
    expect(screen.getByText('Sarhad')).toBeTruthy();
  });
});
