// App icon + favicon: the pixel sticker with a pixel "S", drawn on a 16×16 grid so it is exact at 16 px
// and scales up crisply. Writes public/icon.svg and renders the PWA PNGs with Playwright's Chromium.
// Run: npm run icons
import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const C: Record<string, string> = { k: '#1e1b2e', r: '#dc2626', h: '#f25a4a', l: '#991b1b', w: '#ffffff' };

const S = ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'];

function grid(): string[][] {
  const g = Array.from({ length: 16 }, () => Array<string>(16).fill('.'));
  for (let x = 2; x <= 13; x++) g[1][x] = g[14][x] = 'k';
  for (let y = 2; y <= 13; y++) {
    g[y][1] = g[y][14] = 'k';
    for (let x = 2; x <= 13; x++) g[y][x] = y === 13 ? 'l' : y <= 5 ? 'h' : 'r'; // band = top 40% of the face, lip at the bottom
  }
  const [ox, oy] = [5, 3];
  S.forEach((row, y) => [...row].forEach((c, x) => c === '#' && (g[oy + y + 1][ox + x + 1] = 'k'))); // hard ink shadow
  S.forEach((row, y) => [...row].forEach((c, x) => c === '#' && (g[oy + y][ox + x] = 'w')));
  return g;
}

/** SVG of the 16×16 sprite; `pad` grid units of `bg` around it (maskable safe zone). */
function svg(pad = 0, bg?: string): string {
  const n = 16 + pad * 2;
  const rects: string[] = [];
  grid().forEach((row, y) => {
    for (let x = 0; x < 16; ) {
      const c = row[x];
      let w = 1;
      while (row[x + w] === c) w++;
      if (c !== '.') rects.push(`<rect x="${x + pad}" y="${y + pad}" width="${w}" height="1" fill="${C[c]}"/>`);
      x += w;
    }
  });
  const back = bg ? `<rect width="${n}" height="${n}" fill="${bg}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges">${back}${rects.join('')}</svg>\n`;
}

writeFileSync('public/icon.svg', svg());

const browser = await chromium.launch();
const page = await browser.newPage();
async function png(file: string, size: number, markup: string) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${markup.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: file, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}
await png('public/icon-192.png', 192, svg());
await png('public/icon-512.png', 512, svg());
await png('public/icon-maskable-512.png', 512, svg(4, '#ffffff')); // sprite inside the 80% safe zone
await png('public/apple-touch-icon.png', 180, svg(2, '#ffffff'));
await png('public/favicon-32.png', 32, svg());
await browser.close();
console.log('icons written');
