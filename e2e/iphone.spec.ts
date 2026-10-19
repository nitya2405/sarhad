// iOS Safari behaviour, in WebKit with the iPhone 13 profile (touch, mobile viewport), at 390×844 and 320×640:
// the page never scrolls, the app is 100svh tall, the keyboard lifts only the input bar (the map never
// moves, resizes or re-zooms), Start doesn't focus the input, the give-up pop-up pauses practice time,
// the how-to-play card keeps one size. The keyboard here is simulated: the real check is on a phone.
import { expect, test, type Page } from '@playwright/test';

/**
 * Stand-in for the on-screen keyboard: a visualViewport whose height the test can shrink, as iOS does
 * when the keyboard opens (window.innerHeight stays the same with interactive-widget=resizes-visual).
 */
function fakeVisualViewport(page: Page) {
  return page.addInitScript(() => {
    const vv = new EventTarget() as EventTarget & { height: number; width: number; offsetTop: number; offsetLeft: number; scale: number };
    vv.height = window.innerHeight;
    vv.width = window.innerWidth;
    vv.offsetTop = 0;
    vv.offsetLeft = 0;
    vv.scale = 1;
    Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => vv });
    (window as unknown as { keyboard: (px: number) => void }).keyboard = (px: number) => {
      vv.height = window.innerHeight - px;
      vv.dispatchEvent(new Event('resize'));
    };
  });
}

const seen = (page: Page) =>
  page.addInitScript(() => {
    localStorage.setItem('sarhad:coach', '1');
    localStorage.setItem('sarhad:name', 'Asha');
  });

/** Every way the page itself could scroll: none may move it. */
async function pageScroll(page: Page) {
  return page.evaluate(() => {
    const el = document.scrollingElement!;
    window.scrollTo(0, 500);
    el.scrollTop = 500;
    return { overflow: el.scrollHeight - el.clientHeight, scrollY: window.scrollY, top: el.scrollTop, body: getComputedStyle(document.body).overflow };
  });
}

for (const size of [
  { width: 390, height: 844 },
  { width: 320, height: 640 },
]) {
  const tag = `${size.width}x${size.height}`;
  test.describe(`iPhone (WebKit) ${tag}`, () => {
    test.use({ viewport: size });

    test('Home never scrolls; the page is locked; My stats scrolls inside its own container', async ({ page }) => {
      await seen(page);
      await page.addInitScript(() => {
        // enough history for a long My stats screen
        const now = Date.now();
        const attempts = Array.from({ length: 5 }, (_, i) => ({
          attemptId: `d${i}`, mode: 'daily', date: `2026-10-1${i}`, puzzleId: 'GJ-KL', startedAt: now - 1e6 + i, finishedAt: now - 1e6 + i + 40_000,
          status: 'won', points: 400, guesses: [{ id: 'MH', at: now - 1e6 + 1 }, { id: 'KA', at: now - 1e6 + 2 }],
        }));
        localStorage.setItem('sarhad:v1', JSON.stringify({ schemaVersion: 1, player: { playerId: 'i', streak: 0, best: 3, totalPoints: 2000, prunedWins: 0, attempts } }));
      });
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Sarhad' })).toBeVisible();
      expect(await pageScroll(page)).toEqual({ overflow: 0, scrollY: 0, top: 0, body: 'hidden' });
      const root = await page.evaluate(() => {
        const s = getComputedStyle(document.getElementById('root')!);
        // Playwright's WebKit on Windows lacks overscroll-behavior (iOS Safari 16+ has it): then check
        // that the page's CSS declares it for html, body
        const computed = getComputedStyle(document.documentElement).getPropertyValue('overscroll-behavior-y');
        const declared = [...document.querySelectorAll('style')].some((st) => /html,\s*body\s*\{[^}]*overscroll-behavior:\s*none/.test(st.textContent ?? ''));
        return [s.position, s.overflow, computed || (declared ? 'none' : 'missing')];
      });
      expect(root).toEqual(['fixed', 'hidden', 'none']);
      await page.screenshot({ path: `test-results/screens/iphone-home-${tag}.png` });

      await page.getByRole('button', { name: 'My stats' }).click();
      await expect(page.getByRole('region', { name: 'Best times' })).toBeVisible();
      const board = page.locator('[data-scroll="board"]');
      const inner = await board.evaluate((el) => {
        el.scrollTop = 10_000;
        return { scrolls: el.scrollHeight > el.clientHeight, moved: el.scrollTop > 0 };
      });
      if (size.height === 640) expect(inner).toEqual({ scrolls: true, moved: true }); // too long for 640: scrolls inside
      expect(await pageScroll(page)).toEqual({ overflow: 0, scrollY: 0, top: 0, body: 'hidden' });
    });

    test('Start does not focus the input; the keyboard lifts only the input bar; the map never moves, resizes or re-zooms', async ({ page }) => {
      await fakeVisualViewport(page);
      await seen(page);
      await page.goto('/');
      await page.getByRole('button', { name: 'Practice', exact: true }).click();
      await page.getByRole('button', { name: 'Start' }).click();
      const input = page.getByLabel('Name a state or union territory');
      await expect(input).toBeVisible();
      await page.waitForTimeout(300);
      expect(await input.evaluate((el) => document.activeElement === el)).toBe(false);
      expect(await input.evaluate((el) => [el.getAttribute('autocomplete'), el.getAttribute('autocorrect'), el.getAttribute('autocapitalize'), el.getAttribute('spellcheck'), el.getAttribute('name'), el.getAttribute('enterkeyhint')]))
        .toEqual(['off', 'off', 'words', 'false', 'sarhad-guess', 'go']);

      // the app is exactly 100svh tall, set by CSS
      expect(await page.evaluate(() => {
        const probe = document.createElement('div');
        probe.style.height = '100svh';
        document.body.append(probe);
        const svh = probe.getBoundingClientRect().height;
        probe.remove();
        return Math.round(document.getElementById('root')!.getBoundingClientRect().height - svh);
      })).toBe(0);

      const panel = page.locator('[data-map-panel]');
      const svg = panel.locator('svg[role="img"]').first();
      const before = await panel.boundingBox();
      const viewBox = await svg.getAttribute('viewBox');
      const restInput = await input.boundingBox();
      const kb = Math.round(size.height * 0.4);
      await input.tap();
      await page.evaluate((px) => (window as unknown as { keyboard: (px: number) => void }).keyboard(px), kb);
      await page.waitForTimeout(350);
      expect(await panel.boundingBox()).toEqual(before); // the map neither moves nor resizes
      expect(await svg.getAttribute('viewBox')).toBe(viewBox); // nor re-zooms
      const inputBox = await input.boundingBox();
      const above = size.height - kb - (inputBox!.y + inputBox!.height);
      expect(above).toBeGreaterThanOrEqual(0); // the input sits just above the keyboard
      expect(above).toBeLessThan(24);
      expect(inputBox!.y).toBeGreaterThan(before!.y); // over the lower part of the map
      await page.screenshot({ path: `test-results/screens/iphone-keyboard-${tag}.png` });

      await page.evaluate(() => (window as unknown as { keyboard: (px: number) => void }).keyboard(0));
      await input.blur();
      await page.waitForTimeout(350);
      expect(await panel.boundingBox()).toEqual(before);
      expect(await svg.getAttribute('viewBox')).toBe(viewBox);
      expect(await input.boundingBox()).toEqual(restInput); // back at the bottom
      expect(await pageScroll(page)).toEqual({ overflow: 0, scrollY: 0, top: 0, body: 'hidden' });
    });

    test('the map panel keeps one size through the game: guesses, messages and blur change nothing', async ({ page }) => {
      await seen(page);
      await page.addInitScript(() => {
        const p = { attemptId: 'p', mode: 'practice', puzzleId: 'GJ-KL', startedAt: Date.now(), guesses: [], status: 'playing' };
        localStorage.setItem('sarhad:v1', JSON.stringify({ schemaVersion: 1, player: { playerId: 'i', streak: 0, best: 0, totalPoints: 0, prunedWins: 0, attempts: [p] } }));
      });
      await page.goto('/');
      const panel = page.locator('[data-map-panel]');
      const input = page.getByLabel('Name a state or union territory');
      await expect(input).toBeVisible();
      await page.waitForTimeout(300);
      const before = await panel.boundingBox();
      for (const name of ['Punjab', 'Haryana', 'Assam', 'Bihar', 'Odisha', 'zzzz']) {
        await input.fill(name);
        await input.press('Enter'); // the last one is rejected: a message line appears
      }
      await input.blur();
      await page.waitForTimeout(400);
      expect(await panel.boundingBox()).toEqual(before);
    });

    test('?debug=1 shows the layout numbers; without it there is no overlay', async ({ page }) => {
      await seen(page);
      await page.goto('/');
      await page.getByRole('button', { name: 'Practice', exact: true }).click();
      await page.getByRole('button', { name: 'Start' }).click();
      await expect(page.getByLabel('Name a state or union territory')).toBeVisible();
      await expect(page.locator('[data-debug]')).toHaveCount(0);
      await page.goto('/?debug=1');
      const debug = page.locator('[data-debug]');
      await expect(debug).toContainText(`svh ${size.height}`);
      await expect(debug).toContainText(`innerHeight ${size.height}`);
      await expect(debug).toContainText('vv height');
      await expect(debug).toContainText('offsetTop');
      await expect(debug).toContainText(/map \d+×\d+/);
      await expect(debug).toContainText(/viewBox -?\d+ -?\d+ \d+ \d+/);
      await page.screenshot({ path: `test-results/screens/iphone-debug-${tag}.png` });
    });

    test('give up opens a pop-up; in practice the clock pauses while it is open', async ({ page }) => {
      await seen(page);
      await page.goto('/');
      await page.getByRole('button', { name: 'Practice', exact: true }).click();
      await page.getByRole('button', { name: 'Start' }).click();
      const time = page.getByLabel('Time');
      await page.waitForTimeout(1200);
      await page.getByRole('button', { name: 'Give up' }).click();
      const dialog = page.getByRole('dialog', { name: 'Give up?' });
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText('The clock is paused.');
      const paused = await time.textContent();
      await page.waitForTimeout(2200);
      expect(await time.textContent()).toBe(paused);
      await page.screenshot({ path: `test-results/screens/iphone-giveup-${tag}.png` });
      await dialog.getByRole('button', { name: 'Keep playing' }).click();
      await expect(dialog).toHaveCount(0);
      expect(await time.textContent()).toBe(paused); // resumes from where it stopped, the pause left out
      await page.waitForTimeout(1100);
      expect(await time.textContent()).not.toBe(paused); // and runs again

      await page.getByRole('button', { name: 'Give up' }).click();
      await page.getByRole('button', { name: 'Yes, give up' }).click();
      await expect(page.getByRole('heading', { name: 'Game over' })).toBeVisible();
      // practice result: the Route tile instead of points
      await expect(page.getByText('Route', { exact: true })).toBeVisible();
      await expect(page.getByText("Practice doesn't earn points.")).toBeVisible();
    });

    test('the daily give-up pop-up says the clock keeps running', async ({ page }) => {
      await page.clock.setFixedTime(new Date('2026-10-15T06:00:00Z'));
      await seen(page);
      await page.goto('/');
      await page.getByRole('button', { name: /^Play daily/ }).click();
      await page.getByRole('button', { name: 'Start' }).click();
      await page.getByRole('button', { name: 'Give up' }).click();
      await expect(page.getByRole('dialog', { name: 'Give up?' })).toContainText('The clock keeps running.');
    });

    test('how to play: the card and the Next button keep one size across the 3 frames', async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem('sarhad:name', 'Asha'));
      await page.goto('/');
      const coach = page.getByRole('dialog', { name: 'How to play' });
      const boxes = [];
      for (let i = 0; i < 3; i++) {
        await page.waitForTimeout(250);
        const next = coach.getByRole('button', { name: i < 2 ? 'Next' : 'Play' });
        boxes.push({ card: await coach.locator('.panel').boundingBox(), button: await next.boundingBox() });
        if (i < 2) await next.click();
      }
      for (const b of boxes.slice(1)) {
        expect(b.card).toEqual(boxes[0].card);
        expect(b.button).toEqual(boxes[0].button);
      }
    });

    test('game header: the pair on its own row in 22px Lilita, inside the screen', async ({ page }) => {
      await seen(page);
      await page.addInitScript(() => {
        const now = Date.now();
        const p = { attemptId: 'p', mode: 'practice', puzzleId: 'AR-MH', startedAt: now, guesses: [], status: 'playing' };
        localStorage.setItem('sarhad:v1', JSON.stringify({ schemaVersion: 1, player: { playerId: 'i', streak: 0, best: 0, totalPoints: 0, prunedWins: 0, attempts: [p] } }));
      });
      await page.goto('/');
      const h1 = page.getByRole('heading', { level: 1 });
      await expect(h1).toBeVisible();
      const font = await h1.locator('span').first().evaluate((el) => [getComputedStyle(el).fontFamily.split(',')[0].replace(/"/g, ''), getComputedStyle(el).fontSize]);
      expect(font).toEqual(['Lilita One', '22px']);
      const [bar, title] = [await page.getByRole('button', { name: 'Give up' }).boundingBox(), await h1.boundingBox()];
      expect(title!.y).toBeGreaterThanOrEqual(bar!.y + bar!.height - 1); // its own row, under the bar
      expect(title!.x).toBeGreaterThanOrEqual(0);
      expect(title!.x + title!.width).toBeLessThanOrEqual(size.width);
      await page.screenshot({ path: `test-results/screens/iphone-header-${tag}.png` });
    });
  });
}
