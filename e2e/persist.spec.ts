// Keeping a player's data: persist() once after the first finished game; the install tip on iOS Safari;
// the "under review" line on a flagged win.
import { expect, test, type Page } from '@playwright/test';

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1';
const TIP = 'Add to Home Screen to keep your streak.';

async function practiceAndGiveUp(page: Page) {
  await page.getByRole('button', { name: /Practice/ }).click();
  await page.getByRole('button', { name: 'Start' }).click();
  await page.getByRole('button', { name: 'Give up' }).click();
  await page.getByRole('button', { name: 'Yes, give up' }).click();
  await expect(page.getByRole('heading', { name: 'Game over' })).toBeVisible();
  await page.getByRole('button', { name: 'Home' }).click();
}

test('navigator.storage.persist() is asked once, after the first finished game', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sarhad:coach', '1');
    const w = window as unknown as { persistCalls: number };
    w.persistCalls = 0;
    navigator.storage.persist = () => {
      w.persistCalls++;
      return Promise.reject(new Error('denied')); // failures are ignored
    };
  });
  await page.goto('/');
  const calls = () => page.evaluate(() => (window as unknown as { persistCalls: number }).persistCalls);
  expect(await calls()).toBe(0);
  await practiceAndGiveUp(page);
  expect(await calls()).toBe(1);
  await practiceAndGiveUp(page);
  expect(await calls()).toBe(1);
});

test.describe('iPhone Safari, not installed', () => {
  test.use({ userAgent: IPHONE_SAFARI, viewport: { width: 360, height: 740 } });

  test('shows the install tip; Home still fits; dismissing hides it for good', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('sarhad:coach', '1'));
    await page.goto('/');
    await expect(page.getByText(TIP)).toBeVisible();
    const scroll = await page.evaluate(() => document.documentElement.scrollHeight - document.documentElement.clientHeight);
    expect(scroll, 'Home fits on one screen with the tip').toBeLessThanOrEqual(0);
    await page.screenshot({ path: 'test-results/screens/home-ios-tip-360x740.png' });
    await page.getByRole('button', { name: 'Dismiss tip' }).click();
    await expect(page.getByText(TIP)).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('button', { name: /^Play daily/ })).toBeVisible();
    await expect(page.getByText(TIP)).toHaveCount(0);
  });

  test('no tip when installed (standalone)', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sarhad:coach', '1');
      Object.defineProperty(navigator, 'standalone', { value: true });
    });
    await page.goto('/');
    await expect(page.getByRole('button', { name: /^Play daily/ })).toBeVisible();
    await expect(page.getByText(TIP)).toHaveCount(0);
  });
});

test.describe('other browsers', () => {
  test.use({ userAgent: IPHONE_CHROME });
  test('no tip in iOS Chrome', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('sarhad:coach', '1'));
    await page.goto('/');
    await expect(page.getByRole('button', { name: /^Play daily/ })).toBeVisible();
    await expect(page.getByText(TIP)).toHaveCount(0);
  });
});

test('no tip on Android / desktop Chrome', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sarhad:coach', '1'));
  await page.goto('/');
  await expect(page.getByRole('button', { name: /^Play daily/ })).toBeVisible();
  await expect(page.getByText(TIP)).toHaveCount(0);
});

for (const flagged of [true, false]) {
  test(`result card ${flagged ? 'shows' : 'hides'} "Under review" for a ${flagged ? 'flagged' : 'normal'} win`, async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-15T06:00:00Z'));
    await page.addInitScript((flagged) => {
      const t = Date.parse('2026-10-15T05:59:00Z');
      const guesses = ['WB', 'BR', 'UP', 'HP'].map((id, i) => ({ id, at: t + 400 * (i + 1) }));
      const daily = {
        attemptId: 'd', mode: 'daily', date: '2026-10-15', puzzleId: 'AS-PB', startedAt: t, guesses, status: 'won',
        finishedAt: t + 1900, points: 480, serverTimeMs: 1900, serverPoints: 480, serverFlagged: flagged,
      };
      localStorage.setItem('sarhad:v1', JSON.stringify({ schemaVersion: 1, player: { playerId: 'f', streak: 1, best: 1, totalPoints: 480, prunedWins: 0, attempts: [daily] } }));
      localStorage.setItem('sarhad:coach', '1');
    }, flagged);
    await page.goto('/');
    await page.getByRole('button', { name: "See today's result" }).click();
    await expect(page.getByRole('heading', { name: 'Connected!' })).toBeVisible();
    await expect(page.getByText('Under review: very fast finish')).toHaveCount(flagged ? 1 : 0);
  });
}
