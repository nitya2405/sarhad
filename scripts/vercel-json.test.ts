// vercel.json must be strict JSON (Vercel rejects the whole import otherwise) with the SPA fallback.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('vercel.json', () => {
  it('parses as JSON and keeps the Vite build + SPA rewrite', () => {
    const cfg = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
    expect(cfg).toMatchObject({ framework: 'vite', buildCommand: 'npm run build', outputDirectory: 'dist' });
    expect(cfg.rewrites).toEqual([{ source: '/(.*)', destination: '/index.html' }]);
    expect(cfg.routes).toBeUndefined(); // "routes" cannot be mixed with rewrites/headers
  });
});
