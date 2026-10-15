/** IST is UTC+5:30 all year (no daylight saving). */
export const IST_OFFSET_MS = 330 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

function ymd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 'YYYY-MM-DD' in Asia/Kolkata for an epoch-ms instant, independent of the device time zone. */
export function istDate(epochMs: number): string {
  return ymd(new Date(epochMs + IST_OFFSET_MS));
}

/** Epoch ms of the next IST midnight after epochMs (for the countdown to the next daily). */
export function nextIstMidnight(epochMs: number): number {
  const local = epochMs + IST_OFFSET_MS;
  return Math.floor(local / DAY_MS) * DAY_MS + DAY_MS - IST_OFFSET_MS;
}

/** Adds n days to a date string 'YYYY-MM-DD' (pure calendar arithmetic, no time zone). */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return ymd(new Date(Date.UTC(y, m - 1, d) + n * DAY_MS));
}
