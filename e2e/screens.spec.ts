// Screenshots of every screen at phone sizes, for visual review (test-results/screens/*.png).
import { expect, test, type Page } from '@playwright/test';

const SIZES = [
  { width: 360, height: 740 },
  { width: 320, height: 640 },
];

/** Practice RJ → WB in progress: KL (not connected), then PB, HR, DL (connected via RJ); DL is latest. */
function seedMidPlay(page: Page) {
  return page.addInitScript(() => {
    const now = Date.now();
    const guesses = ['KL', 'PB', 'HR', 'DL'].map((id, i) => ({ id, at: now - 40_000 + i * 8_000 }));
    const player = {
      playerId: 'shot',
      streak: 3,
      best: 5,
      totalPoints: 1240,
      prunedWins: 0,
      attempts: [{ attemptId: 'mid', mode: 'practice', puzzleId: 'RJ-WB', startedAt: now - 84_000, guesses, status: 'playing' }],
    };
    localStorage.setItem('sarhad:v1', JSON.stringify({ schemaVersion: 1, player }));
    localStorage.setItem('sarhad:coach', '1');
  });
}

async function type(page: Page, text: string) {
  const input = page.getByLabel('Name a state or union territory');
  await input.fill(text);
  await input.press('Enter');
}

for (const size of SIZES) {
  const tag = `${size.width}x${size.height}`;
  test.describe(tag, () => {
    test.use({ viewport: size });

    test('home, ready, game, result (daily)', async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem('sarhad:coach', '1'));
      // pin the day so the bundled daily is always AS → PB (2026-10-15 IST); timers still run
      await page.clock.setFixedTime(new Date('2026-10-15T06:00:00Z'));
      await page.goto('/');
      await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `test-results/screens/home-${tag}.png` });

      await page.getByRole('button', { name: 'Play', exact: true }).click();
      await page.screenshot({ path: `test-results/screens/ready-${tag}.png` });
      await page.getByRole('button', { name: 'Start' }).click();

      // the pinned day's bundled daily (AS → PB): a wrong guess, then one shortest route
      await type(page, 'Tripura');
      for (const name of ['West Bengal', 'Bihar', 'Uttar Pradesh', 'Himachal Pradesh']) await type(page, name);
      await expect(page.getByRole('heading', { name: 'Connected!' })).toBeVisible({ timeout: 4000 });
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `test-results/screens/result-${tag}.png`, fullPage: true });
    });

    test('home after today\'s daily (offline build: Practice is the main button)', async ({ page }) => {
      await page.clock.setFixedTime(new Date('2026-10-15T06:00:00Z'));
      await page.addInitScript(() => {
        const t = Date.parse('2026-10-15T05:58:00Z');
        const guesses = ['WB', 'BR', 'UP', 'HP'].map((id, i) => ({ id, at: t + 10_000 * (i + 1) }));
        const daily = { attemptId: 'd', mode: 'daily', date: '2026-10-15', puzzleId: 'AS-PB', startedAt: t, guesses, status: 'won', finishedAt: t + 40_000, points: 412 };
        const player = { playerId: 'shot', streak: 4, best: 6, totalPoints: 2310, prunedWins: 0, attempts: [daily] };
        localStorage.setItem('sarhad:v1', JSON.stringify({ schemaVersion: 1, player }));
        localStorage.setItem('sarhad:coach', '1');
      });
      await page.goto('/');
      await expect(page.getByRole('button', { name: "See today's result" })).toBeVisible();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `test-results/screens/home-after-${tag}.png` });
    });

    test('game mid-play (Punjab, Haryana, Delhi guessed)', async ({ page }) => {
      await seedMidPlay(page);
      await page.goto('/');
      await expect(page.getByRole('group', { name: 'Guess 5 of 20' })).toBeVisible();
      await page.waitForTimeout(400);
      await page.screenshot({ path: `test-results/screens/game-${tag}.png` });
    });

    test('result loss (game over)', async ({ page }) => {
      await seedMidPlay(page);
      await page.goto('/');
      await page.getByRole('button', { name: 'Give up' }).click();
      await page.getByRole('button', { name: 'Yes, give up' }).click();
      await expect(page.getByRole('heading', { name: 'Game over' })).toBeVisible();
      await page.waitForTimeout(1300);
      await page.screenshot({ path: `test-results/screens/result-loss-${tag}.png`, fullPage: true });
    });

    test('game at 200% text size', async ({ page }) => {
      await seedMidPlay(page);
      await page.goto('/');
      await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
      await page.waitForTimeout(400);
      await page.screenshot({ path: `test-results/screens/game-200pct-${tag}.png` });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, 'no sideways scroll').toBeLessThanOrEqual(0);
    });
  });
}
