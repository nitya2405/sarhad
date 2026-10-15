import { defineConfig } from 'vitest/config';
import { loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/** Today in IST as 'YYYY-MM-DD' (UTC+5:30, no daylight saving). */
function istToday(): string {
  return new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
}

/**
 * Server builds must not leak future dailies: fail if any emitted file contains a date after today (IST).
 * Bundled-schedule builds (offline/dev fallback) ship the schedule on purpose and are only reported.
 */
function noFutureDates(enforce: boolean): Plugin {
  return {
    name: 'sarhad:no-future-dates',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const today = istToday();
      const leaks: string[] = [];
      for (const file of Object.values(bundle)) {
        const text = file.type === 'chunk' ? file.code : typeof file.source === 'string' ? file.source : '';
        const future = new Set([...text.matchAll(/\b(20\d\d-[01]\d-[0-3]\d)\b/g)].map((m) => m[1]).filter((d) => d > today));
        if (future.size) leaks.push(`${file.fileName}: ${future.size} date(s) after ${today}, e.g. ${[...future].sort()[0]}`);
      }
      if (!leaks.length) return;
      if (enforce) this.error(`Future schedule dates in a server build:\n  ${leaks.join('\n  ')}`);
      this.warn(`Bundled schedule (offline build): ${leaks.join('; ')}`);
    },
  };
}

export default defineConfig(({ mode }) => {
  // `--mode offline` ignores VITE_* env entirely: no server, bundled schedule.
  const offline = mode === 'offline';
  const env = offline ? {} : loadEnv(mode, process.cwd(), 'VITE_');
  const serverOn = Boolean(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY);
  // Tests always get the bundled schedule (they mock the server).
  const bundleSchedule = !serverOn || mode === 'test';
  if (process.env.VERCEL_ENV === 'production' && !serverOn) {
    throw new Error('Production deploy without VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY would ship the daily schedule.');
  }

  return {
    envPrefix: offline ? 'SARHAD_OFFLINE_DISABLED_' : 'VITE_',
    // One dep-optimizer cache per mode: dev, dev:offline and vitest must not clobber each other's
    // pre-bundled deps (a running server then answers 504 "Outdated Optimize Dep" → blank page).
    cacheDir: `node_modules/.vite/${mode}`,
    optimizeDeps: { include: ['react', 'react-dom/client', 'react/jsx-dev-runtime', 'react/jsx-runtime'] },
    resolve: {
      alias: {
        '@engine': here('./supabase/functions/_shared/engine'),
        '@schedule': here(bundleSchedule ? './src/lib/schedule.bundled.ts' : './src/lib/schedule.server.ts'),
      },
    },
    plugins: [
      react(),
      tailwindcss(),
      noFutureDates(!bundleSchedule),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg'],
        manifest: {
          name: 'Sarhad',
          short_name: 'Sarhad',
          description: 'Connect two Indian states by naming the regions between them.',
          theme_color: '#0f766e',
          background_color: '#ffffff',
          display: 'standalone',
          start_url: '/',
          icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,json,webmanifest}'],
          navigateFallback: '/index.html',
        },
      }),
    ],
    test: {
      include: ['supabase/functions/_shared/engine/**/*.test.ts', 'supabase/functions/finish-daily/**/*.test.ts', 'src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
      environment: 'node',
    },
  };
});
