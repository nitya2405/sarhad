// Server builds ship no schedule: the daily pair comes only from start_daily at Start,
// so nobody can read future dailies out of the bundle.
import type { DailySchedule } from '@engine/index.ts';

export const bundledSchedule: DailySchedule | null = null;
