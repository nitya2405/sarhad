// Polish round: name step, game toasts and copy, the '? ⋯⋯ ?' mark, screen transitions, the wordmark
// wave, and the You panel. Offline build (the server parts are covered by App.server.test.tsx).
import { expect, test, type Page } from '@playwright/test';

/** A practice GJ → KL (shortest: Maharashtra, Karnataka) ready to play, coach and name done. */
function seedPractice(page: Page, attempts: unknown[] = []) {
  return page.addInitScript((attempts) => {
    const now = Date.now();
    const playing = { attemptId: 'p', mode: 'practice', puzzleId: 'GJ-KL', startedAt: now - 5_000, guesses: [], status: 'playing' };
    const player = { playerId: 't', streak: 0, best: 2, totalPoints: 0, prunedWins: 0, attempts: [...(attempts as object[]), playing] };
    if (!sessionStorage.getItem('seeded')) localStorage.setItem('sarhad:v1', JSON.stringify({ schemaVersion: 1, player }));
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('sarhad:coach', '1');
    localStorage.setItem('sarhad:name', 'Asha');
  }, attempts);
}

async function guess(page: Page, text: string) {
  const input = page.getByLabel('Name a state or union territory');
  await input.fill(text);
  await input.press('Enter');
}

test('toasts: "Abhi juda nahi" for a guess not joined yet, "Raasta clear!" on the win; "Ekdum seedha!" for a shortest route', async ({ page }) => {
  await seedPractice(page);
  await page.goto('/');
  await guess(page, 'Punjab');
  await expect(page.getByText('Abhi juda nahi')).toBeVisible();
  await expect(page.getByText('Abhi juda nahi')).toHaveCount(0, { timeout: 3000 }); // goes away by itself
  await guess(page, 'Maharashtra'); // joined to Gujarat: no toast
  await page.waitForTimeout(150);
  await expect(page.getByText('Abhi juda nahi')).toHaveCount(0);
  await guess(page, 'Karnataka');
  await expect(page.getByText('Raasta clear!')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Connected!' })).toBeVisible();
  // Punjab was spare, but the route inside is still the shortest one
  await expect(page.getByText('Ekdum seedha!')).toBeVisible();
});

test("Ready shows the '? ⋯⋯ ?' mark idling: six dots, animated", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sarhad:coach', '1');
    localStorage.setItem('sarhad:name', 'Asha');
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Practice', exact: true }).click();
  const mark = page.getByRole('img', { name: 'Two hidden states' });
  await expect(mark).toBeVisible();
  await expect(mark.locator('.mark-dots i')).toHaveCount(6);
  const anim = await mark.locator('.mark-dots i').nth(5).evaluate((el) => [getComputedStyle(el).animationName, getComputedStyle(el).animationDelay]);
  expect(anim).toEqual(['mark-dot', '1s']); // the sixth dot starts last: left to right
});

test('screens slide in over 180 ms; the wordmark waves letter by letter every 4 s', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sarhad:coach', '1');
    localStorage.setItem('sarhad:name', 'Asha');
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sarhad' })).toBeVisible();
  const screen = await page.locator('.screen').evaluate((el) => [getComputedStyle(el).animationName, getComputedStyle(el).animationDuration]);
  expect(screen).toEqual(['screen-in', '0.18s']);
  const waves = await page.locator('.wave').evaluateAll((els) => els.map((el) => [getComputedStyle(el).animationDuration, getComputedStyle(el).animationDelay]));
  expect(waves.map((w) => w[0])).toEqual(Array(6).fill('4s'));
  expect(waves.map((w) => w[1])).toEqual(['0s', '0.11s', '0.22s', '0.33s', '0.44s', '0.55s']);
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('screens change instantly; the wordmark and the mark are still', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sarhad:coach', '1');
      localStorage.setItem('sarhad:name', 'Asha');
    });
    await page.goto('/');
    const still = (sel: string) => page.locator(sel).first().evaluate((el) => getComputedStyle(el).animationName);
    expect(await still('.screen')).toBe('none');
    expect(await still('.wave')).toBe('none');
    await page.getByRole('button', { name: 'Practice', exact: true }).click();
    expect(await still('.screen')).toBe('none');
    expect(await still('.mark-q')).toBe('none');
    expect(await still('.mark-dots i')).toBe('none');
  });
});

test('My stats: states discovered on the mini map, records; change name', async ({ page }) => {
  const won = (id: string, puzzleId: string, guesses: string[], ms: number) => ({
    attemptId: id, mode: 'practice', puzzleId, startedAt: 1_000, finishedAt: 1_000 + ms, status: 'won',
    guesses: guesses.map((g, i) => ({ id: g, at: 1_000 + i })),
  });
  await seedPractice(page, [won('a', 'GJ-KL', ['MH', 'KA'], 41_000), won('b', 'GJ-KL', ['RJ', 'MP', 'MH', 'KA'], 63_000)]);
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Home' }).click();
  await page.getByRole('button', { name: 'My stats' }).click();
  const you = page.getByRole('region', { name: 'You' });
  // GJ, KL, MH, KA, RJ, MP
  await expect(you.getByText('6/33')).toBeVisible();
  await expect(you.locator('path[fill="var(--color-red)"]')).toHaveCount(6);
  await expect(you.getByText('Shortest routes').locator('..')).toContainText('2');
  await expect(you.getByText('Fastest win').locator('..')).toContainText('41');
  await expect(you.getByText('Best streak').locator('..')).toContainText('2');
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'test-results/screens/stats-360x740.png', fullPage: true });

  await expect(page.getByText('Playing as Asha')).toBeVisible();
  await page.getByRole('button', { name: 'Change name' }).click();
  await page.getByLabel('Your name').fill('Asha Rani');
  await page.getByRole('button', { name: "That's me" }).click();
  await expect(page.getByText('Playing as Asha Rani')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('sarhad:name'))).toBe('Asha Rani');
});
