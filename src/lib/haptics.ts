// Haptics via navigator.vibrate, feature-detected (a no-op on iOS). Setting is per device.
const KEY = 'sarhad:haptics';

export const PATTERN = {
  connected: 15,
  accepted: 10,
  rejected: [30, 40, 30],
  won: [20, 60, 20, 60, 80],
} as const;

export const hapticsSupported = (): boolean => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

export function hapticsOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== '0';
  } catch {
    return true;
  }
}

export function setHapticsOn(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    /* storage blocked: setting lasts for this session only */
  }
}

export function buzz(pattern: number | readonly number[]): void {
  if (!hapticsSupported() || !hapticsOn()) return;
  try {
    navigator.vibrate(pattern as number | number[]);
  } catch {
    /* some browsers throw without a user gesture */
  }
}
