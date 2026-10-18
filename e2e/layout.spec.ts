// Layout guarantees: the app is one ≤ 440px column (nothing outside it), and the game's start view shows
// both endpoints fully inside the map panel, with the inset never covering them.
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const puzzleData: unknown = JSON.parse(readFileSync(new URL('../src/data/puzzles.json', import.meta.url), 'utf8'));

const all = (Array.isArray(puzzleData) ? puzzleData : (puzzleData as { puzzles: unknown[] }).puzzles) as { id: string; start: string; end: string }[];

/** A practice game in progress with these guesses (no win yet). */
function seedPractice(page: Page, puzzleId: string, ids: string[] = []) {
  return page.addInitScript(
    ([puzzleId, ids]) => {
      const now = Date.now();
      const guesses = (ids as string[]).map((id, i) => ({ id, at: now - 60_000 + i * 6_000 }));
      const player = { playerId: 't', streak: 0, best: 0, totalPoints: 0, prunedWins: 0,
        attempts: [{ attemptId: 'p', mode: 'practice', puzzleId, startedAt: now - 70_000, guesses, status: 'playing' }] };
      localStorage.setItem('sarhad:v1', JSON.stringify({ schemaVersion: 1, player }));
      localStorage.setItem('sarhad:coach', '1');
    },
    [puzzleId, ids] as const,
  );
}

/** Every HTML element of the page lies inside #root (SVG internals are clipped by their <svg>). */
async function outsideColumn(page: Page): Promise<{ root: number; outside: string[] }> {
  // measure after the 180 ms screen slide-in (#root clips it while it runs)
  await page.waitForFunction(() => [...document.querySelectorAll('.screen')].every((el) => el.getAnimations().every((a) => a.playState === 'finished')));
  return page.evaluate(() => {
    const root = document.getElementById('root')!.getBoundingClientRect();
    const outside: string[] = [];
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
      if (['SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT'].includes(el.tagName)) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.left < root.left - 0.5 || r.right > root.right + 0.5) {
        outside.push(`${el.tagName.toLowerCase()}.${String(el.getAttribute('class') ?? '').slice(0, 40)} [${Math.round(r.left)}, ${Math.round(r.right)}]`);
      }
    }
    return { root: root.width, outside };
  });
}

test.describe('1440×900: the app is one ≤ 440px column', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('home, the name card and the coach', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('dialog', { name: 'What should we call you?' })).toBeVisible();
    let r = await outsideColumn(page);
    expect(r.outside).toEqual([]);
    await page.getByRole('button', { name: "That's me" }).click();
    await expect(page.getByRole('dialog', { name: 'How to play' })).toBeVisible();
    r = await outsideColumn(page);
    expect(r.root).toBeLessThanOrEqual(440);
    expect(r.outside).toEqual([]);
    await page.getByRole('button', { name: 'Skip' }).click();
    r = await outsideColumn(page);
    expect(r.outside).toEqual([]);
  });

  test('game, result card, map view and My stats', async ({ page }) => {
    await seedPractice(page, 'GJ-OD', ['KA', 'KL', 'TN', 'GA', 'AP']);
    await page.goto('/');
    await expect(page.getByRole('group', { name: 'Guess 6 of 20' })).toBeVisible();
    await page.waitForTimeout(400);
    expect((await outsideColumn(page)).outside).toEqual([]);

    await page.getByRole('button', { name: 'Give up' }).click();
    await page.getByRole('button', { name: 'Yes, give up' }).click();
    await expect(page.getByRole('heading', { name: 'Game over' })).toBeVisible();
    await page.waitForTimeout(400);
    let r = await outsideColumn(page);
    expect(r.root).toBeLessThanOrEqual(440);
    expect(r.outside).toEqual([]);
    const card = await page.getByRole('dialog').boundingBox();
    expect(card!.width).toBeLessThanOrEqual(340);

    await page.getByRole('button', { name: 'See map' }).click();
    await page.getByRole('button', { name: 'Show shortest route' }).click();
    await page.waitForTimeout(400);
    expect((await outsideColumn(page)).outside).toEqual([]);

    await page.getByRole('button', { name: 'Results' }).click();
    await page.getByRole('button', { name: 'Home' }).click();
    await page.getByRole('button', { name: 'My stats' }).click();
    await expect(page.getByRole('heading', { name: 'My stats' })).toBeVisible();
    expect((await outsideColumn(page)).outside).toEqual([]);
  });
});

// 10 puzzles from a fixed seed (stable across runs), plus the two named in the bug report.
let seed = 20261018;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
const picks = new Set<string>(['HP-KA', 'JH-MZ']);
while (picks.size < 12) picks.add(all[Math.floor(rand() * all.length)].id);

for (const size of [{ width: 360, height: 740 }, { width: 320, height: 640 }]) {
  test.describe(`start view ${size.width}×${size.height}`, () => {
    test.use({ viewport: size });
    for (const id of picks) {
      test(`${id}: both endpoints fully inside the map panel; inset covers neither`, async ({ page }) => {
        const p = all.find((x) => x.id === id)!;
        await seedPractice(page, id);
        await page.goto('/');
        await expect(page.locator(`path[data-region="${p.start}"]`)).toBeAttached();
        await page.waitForTimeout(450); // let the zoom settle
        const r = await page.evaluate(([a, b]) => {
          const panel = document.querySelector('svg[role="img"]')!.parentElement!.parentElement!.getBoundingClientRect();
          const inner = { l: panel.left + 2, t: panel.top + 2, r: panel.right - 2, b: panel.bottom - 2 };
          const box = (id: string) => document.querySelector(`path[data-region="${id}"]`)!.getBoundingClientRect();
          const inset = document.querySelector('[data-inset]')?.getBoundingClientRect();
          const inside = (e: DOMRect) => e.left >= inner.l - 0.5 && e.right <= inner.r + 0.5 && e.top >= inner.t - 0.5 && e.bottom <= inner.b + 0.5;
          const hit = (e: DOMRect) => !!inset && e.left < inset.right && inset.left < e.right && e.top < inset.bottom && inset.top < e.bottom;
          return { a: inside(box(a)), b: inside(box(b)), insetHitsA: hit(box(a)), insetHitsB: hit(box(b)) };
        }, [p.start, p.end]);
        expect(r).toEqual({ a: true, b: true, insetHitsA: false, insetHitsB: false });
      });
    }
  });
}
