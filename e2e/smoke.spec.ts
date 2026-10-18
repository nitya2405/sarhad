import { expect, test, type Page } from '@playwright/test';

/** Fails the test on any uncaught page error or console error (a blank page logs little else). */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
  page.on('response', (r) => r.status() >= 400 && errors.push(`http ${r.status()}: ${r.url()}`));
  return errors;
}

/**
 * Opens straight into a practice game with a fixed pair. A random Practice pair can make a test depend on
 * which states are endpoints (e.g. "Arun" when Arunachal Pradesh is the start), so input tests pin it.
 */
async function playFixedPractice(page: Page, puzzleId = 'RJ-WB') {
  await page.addInitScript((id) => {
    const player = {
      playerId: 'fixed', streak: 0, best: 0, totalPoints: 0, prunedWins: 0,
      attempts: [{ attemptId: 'fixed', mode: 'practice', puzzleId: id, startedAt: Date.now(), guesses: [], status: 'playing' }],
    };
    localStorage.setItem('sarhad:v1', JSON.stringify({ schemaVersion: 1, player }));
  }, puzzleId);
  await page.goto('/');
  await expect(page.getByRole('group', { name: 'Guess 1 of 20' })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sarhad:coach', '1'));
});

test('Home renders with the Play button (not a blank page)', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: /^Play daily/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sarhad' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('first open shows the 3-frame coach; tapping through closes it', async ({ page }) => {
  // a genuinely first open: clear the flag on the first load only, not on the reload below
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('opened')) localStorage.removeItem('sarhad:coach');
    sessionStorage.setItem('opened', '1');
  });
  await page.goto('/');
  const coach = page.getByRole('dialog', { name: 'How to play' });
  await expect(coach).toContainText('Two states light up.');
  await expect(coach).toContainText('Join them by land.');
  await coach.getByRole('button', { name: 'Next' }).click();
  await expect(coach).toContainText('Type a state in between.');
  await coach.getByRole('button', { name: 'Next' }).click();
  await expect(coach).toContainText('Be fast. More points.');
  await coach.getByRole('button', { name: 'Play' }).click();
  await expect(coach).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('switching screens survives StrictMode effect cleanup (Practice → Start → guess)', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Practice', exact: true }).click();
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByRole('group', { name: 'Guess 1 of 20' })).toBeVisible();
  const input = page.getByLabel('Name a state or union territory');
  await input.fill('Paris');
  await input.press('Enter');
  await expect(page.getByRole('status')).toHaveText('Not a state name');
  expect(errors).toEqual([]);
});

test('typing a partial name reveals nothing; a near-complete name shows one chip', async ({ page }) => {
  await playFixedPractice(page);
  const input = page.getByLabel('Name a state or union territory');
  await input.fill('Arun');
  await expect(page.getByRole('button', { name: /Arunachal/ })).toHaveCount(0);
  await input.fill('Arunachal');
  await expect(page.getByRole('button', { name: /Arunachal Pradesh/ })).toBeVisible();
});

test('a partial name + Enter asks for the full name, spending no guess', async ({ page }) => {
  await playFixedPractice(page);
  const input = page.getByLabel('Name a state or union territory');
  await input.fill('Arun');
  await input.press('Enter');
  await expect(page.getByRole('status')).toHaveText('Type the full name');
  await expect(page.getByRole('group', { name: 'Guess 1 of 20' })).toBeAttached();
});

test('a tap skips the win celebration', async ({ page }) => {
  await page.addInitScript(() => {
    const now = Date.now();
    const player = {
      playerId: 'skip', streak: 0, best: 0, totalPoints: 0, prunedWins: 0,
      attempts: [{ attemptId: 'w', mode: 'practice', puzzleId: 'RJ-WB', startedAt: now - 20_000, guesses: [{ id: 'UP', at: now - 9_000 }], status: 'playing' }],
    };
    localStorage.setItem('sarhad:v1', JSON.stringify({ schemaVersion: 1, player }));
  });
  await page.goto('/');
  const input = page.getByLabel('Name a state or union territory');
  await input.fill('Bihar');
  await input.press('Enter');
  await page.mouse.click(180, 300);
  await expect(page.getByRole('heading', { name: 'Connected!' })).toBeVisible({ timeout: 500 });
});

test('part of an endpoint name + Enter names that endpoint, not "Not a state name"', async ({ page }) => {
  await playFixedPractice(page, 'AR-BR'); // start: Arunachal Pradesh, end: Bihar
  const input = page.getByLabel('Name a state or union territory');
  await input.fill('Arun');
  await input.press('Enter');
  await expect(page.getByRole('status')).toHaveText("That's your start");
  await input.fill('Bih');
  await input.press('Enter');
  await expect(page.getByRole('status')).toHaveText("That's your end");
  await expect(page.getByRole('group', { name: 'Guess 1 of 20' })).toBeAttached();
});

test('My stats opens from Home (offline build) and returns', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'My stats' }).click();
  await expect(page.getByRole('heading', { name: 'My stats' })).toBeVisible();
  await expect(page.getByText('No daily wins yet.')).toBeVisible();
  await page.getByRole('button', { name: 'Home' }).click();
  await expect(page.getByRole('button', { name: /^Play daily/ })).toBeVisible();
});

test('the vibration toggle shows where navigator.vibrate exists (Android)', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Vibration' })).toBeVisible();
});

test('no vibration toggle without navigator.vibrate (iPhone / iOS)', async ({ page }) => {
  await page.addInitScript(() => {
    delete (Navigator.prototype as { vibrate?: unknown }).vibrate;
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: /^Play daily/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Vibration' })).toHaveCount(0);
  // the streak/points pill keeps its place on the right
  const pill = (await page.getByLabel(/points$/).boundingBox())!;
  expect(pill.x + pill.width).toBeGreaterThan((page.viewportSize()!.width * 2) / 3);
});
