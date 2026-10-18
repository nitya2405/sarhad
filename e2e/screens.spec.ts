// Screenshots of every screen at phone sizes, for visual review (test-results/screens/*.png).
import { expect, test, type Page } from '@playwright/test';

const SIZES = [
  { width: 360, height: 740 },
  { width: 320, height: 640 },
  { width: 1440, height: 900 },
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

/** A practice game in progress with these guesses (no win yet). */
function seedPractice(page: Page, puzzleId: string, ids: string[]) {
  return page.addInitScript(
    ([puzzleId, ids]) => {
      const now = Date.now();
      const guesses = (ids as string[]).map((id, i) => ({ id, at: now - 60_000 + i * 6_000 }));
      const player = { playerId: 'shot', streak: 0, best: 0, totalPoints: 0, prunedWins: 0,
        attempts: [{ attemptId: 'p', mode: 'practice', puzzleId, startedAt: now - 70_000, guesses, status: 'playing' }] };
      localStorage.setItem('sarhad:v1', JSON.stringify({ schemaVersion: 1, player }));
      localStorage.setItem('sarhad:coach', '1');
    },
    [puzzleId, ids] as const,
  );
}

const noScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollHeight - document.documentElement.clientHeight);

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
      await expect(page.getByRole('button', { name: /^Play daily/ })).toBeVisible();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `test-results/screens/home-${tag}.png` });
      expect(await noScroll(page), 'Home fits on one screen').toBeLessThanOrEqual(0);

      await page.getByRole('button', { name: /^Play daily/ }).click();
      await page.waitForTimeout(250); // after the 180 ms slide-in
      await page.screenshot({ path: `test-results/screens/ready-${tag}.png` });
      await page.getByRole('button', { name: 'Start' }).click();
      await expect(page.getByText('Your guesses show here')).toBeVisible();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `test-results/screens/game-start-${tag}.png` });

      // the pinned day's bundled daily (AS → PB): a wrong guess, then one shortest route
      await type(page, 'Tripura');
      for (const name of ['West Bengal', 'Bihar', 'Uttar Pradesh', 'Himachal Pradesh']) await type(page, name);
      await expect(page.getByRole('heading', { name: 'Connected!' })).toBeVisible({ timeout: 4000 });
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `test-results/screens/result-${tag}.png` });
    });

    test('home with the daily in progress', async ({ page }) => {
      await page.clock.setFixedTime(new Date('2026-10-15T06:00:00Z'));
      await page.addInitScript(() => {
        const t = Date.parse('2026-10-15T05:59:00Z');
        const daily = { attemptId: 'd', mode: 'daily', date: '2026-10-15', puzzleId: 'AS-PB', startedAt: t, guesses: [{ id: 'WB', at: t + 9000 }], status: 'playing' };
        const player = { playerId: 'shot', streak: 3, best: 5, totalPoints: 1240, prunedWins: 0, attempts: [daily] };
        localStorage.setItem('sarhad:v1', JSON.stringify({ schemaVersion: 1, player }));
        localStorage.setItem('sarhad:coach', '1');
      });
      await page.goto('/'); // resumes the game; go back to Home
      await page.getByRole('button', { name: 'Home' }).click();
      await expect(page.getByRole('button', { name: 'Continue daily' })).toBeVisible();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `test-results/screens/home-progress-${tag}.png` });
      expect(await noScroll(page), 'Home fits on one screen').toBeLessThanOrEqual(0);
    });

    test('name card, then how to play, frames 1–3', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('dialog', { name: 'What should we call you?' })).toBeVisible();
      await page.waitForTimeout(250);
      await page.screenshot({ path: `test-results/screens/name-${tag}.png` });
      await page.getByRole('button', { name: "That's me" }).click();
      const coach = page.getByRole('dialog', { name: 'How to play' });
      for (let i = 1; i <= 3; i++) {
        await expect(coach).toBeVisible();
        await page.waitForTimeout(250);
        await page.screenshot({ path: `test-results/screens/coach-${i}-${tag}.png` });
        if (i < 3) await coach.getByRole('button', { name: 'Next' }).click();
      }
    });

    test('home at 200% text size', async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem('sarhad:coach', '1'));
      await page.goto('/');
      await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
      await page.waitForTimeout(400);
      await page.screenshot({ path: `test-results/screens/home-200pct-${tag}.png`, fullPage: true });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, 'no sideways scroll').toBeLessThanOrEqual(0);
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
      expect(await noScroll(page), 'Home fits on one screen').toBeLessThanOrEqual(0);
    });

    for (const [id, name] of [['HP-KA', 'hp-ka'], ['JH-MZ', 'jh-mz']]) {
      test(`game start ${id}`, async ({ page }) => {
        await seedPractice(page, id, []);
        await page.goto('/');
        await expect(page.getByText('Your guesses show here')).toBeVisible();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `test-results/screens/game-start-${name}-${tag}.png` });
      });
    }

    test('game mid-play at the edge (Sikkim, Arunachal guessed)', async ({ page }) => {
      await seedPractice(page, 'BR-MN', ['SK', 'AR']);
      await page.goto('/');
      await expect(page.getByRole('group', { name: 'Guess 3 of 20' })).toBeVisible();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `test-results/screens/game-edge-${tag}.png` });
    });

    test('game mid-play (Punjab, Haryana, Delhi guessed)', async ({ page }) => {
      await seedMidPlay(page);
      await page.goto('/');
      await expect(page.getByRole('group', { name: 'Guess 5 of 20' })).toBeVisible();
      await page.waitForTimeout(400);
      await page.screenshot({ path: `test-results/screens/game-${tag}.png` });
    });

    test('result loss (game over): a southern cluster draws as a tree, no crossing stitches', async ({ page }) => {
      // GJ → OD, given up with a cluster joined to Odisha through Andhra Pradesh
      await seedPractice(page, 'GJ-OD', ['KA', 'KL', 'TN', 'GA', 'AP']);
      await page.goto('/');
      await page.getByRole('button', { name: 'Give up' }).click();
      await page.getByRole('button', { name: 'Yes, give up' }).click();
      await expect(page.getByRole('heading', { name: 'Game over' })).toBeVisible();
      await page.waitForTimeout(1300);
      await page.screenshot({ path: `test-results/screens/result-loss-${tag}.png` });
      await page.getByRole('button', { name: 'See map' }).click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: `test-results/screens/result-map-${tag}.png` });
      await page.getByRole('button', { name: 'Show shortest route' }).click();
      await page.waitForTimeout(1400);
      await page.screenshot({ path: `test-results/screens/result-map-route-${tag}.png` });
      await page.getByRole('button', { name: 'Results' }).click();
      await expect(page.getByRole('heading', { name: 'Game over' })).toBeVisible();
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
