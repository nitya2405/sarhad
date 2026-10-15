// Bundled daily schedule — used only in builds without a server (dev/offline fallback, tests).
// vite.config.ts points the `@schedule` alias here or at schedule.server.ts.
import dailyJson from '../data/daily.json';
import type { DailySchedule } from '@engine/index.ts';

export const bundledSchedule: DailySchedule | null = dailyJson as unknown as DailySchedule;
