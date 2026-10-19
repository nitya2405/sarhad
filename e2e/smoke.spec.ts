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

test('first open asks for a name, then shows the 3-frame coach; tapping through closes it', async ({ page }) => {
  // a genuinely first open: clear the flag on the first load only, not on the reload below
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('opened')) localStorage.removeItem('sarhad:coach');
    sessionStorage.setItem('opened', '1');
  });
  await page.goto('/');
  const naming = page.getByRole('dialog', { name: 'What should we call you?' });
  await expect(naming.getByLabel('Your name')).toHaveValue(/^Player [0-9A-F]{4}$/);
  await expect(page.getByRole('dialog', { name: 'How to play' })).toHaveCount(0);
  await naming.getByLabel('Your name').fill('Asha');
  await naming.getByRole('button', { name: "That's me" }).click();
  await expect(naming).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('sarhad:name'))).toBe('Asha'); // offline build: kept locally
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

/** Counts the notes the page plays: every oscillator started through Web Audio. */
async function countNotes(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { notes: number };
    w.notes = 0;
    const orig = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function (this: AudioContext) {
      w.notes++;
      return orig.call(this);
    };
  });
  return () => page.evaluate(() => (window as unknown as { notes: number }).notes);
}

test('the sound toggle sits top-left, on by default; off is saved and plays nothing', async ({ page }) => {
  const notes = await countNotes(page);
  await page.goto('/');
  const toggle = page.getByRole('button', { name: 'Sound' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  expect(await page.getByRole('button', { name: 'Vibration' }).count()).toBe(0);
  const box = (await toggle.boundingBox())!;
  expect(box.x).toBeLessThan(page.viewportSize()!.width / 3);

  // on: Start plays a sound, a rejected guess plays one more
  await page.getByRole('button', { name: 'Practice', exact: true }).click();
  await page.getByRole('button', { name: 'Start' }).click();
  await expect.poll(notes).toBeGreaterThan(0);
  const afterStart = await notes();
  const input = page.getByLabel('Name a state or union territory');
  await input.fill('zzzz');
  await input.press('Enter');
  await expect.poll(notes).toBeGreaterThan(afterStart);

  // off: saved across a reload, and nothing plays
  await page.getByRole('button', { name: 'Home' }).click();
  await page.getByRole('button', { name: 'Sound' }).click();
  await expect(page.getByRole('button', { name: 'Sound' })).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => localStorage.getItem('sarhad:sound'))).toBe('0');
  await page.getByRole('button', { name: 'Continue practice' }).click();
  await page.reload(); // reopens the game in progress
  await input.fill('zzzz');
  await input.press('Enter');
  await page.getByRole('button', { name: 'Give up' }).click();
  await page.getByRole('button', { name: 'Yes, give up' }).click();
  await expect(page.getByRole('heading', { name: 'Game over' })).toBeVisible();
  expect(await notes()).toBe(0);
  await page.getByRole('button', { name: 'Home' }).click();
  await expect(page.getByRole('button', { name: 'Sound' })).toHaveAttribute('aria-pressed', 'false');
});
