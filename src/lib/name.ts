// The player's display name: chosen on first open, kept locally, sent with set_display_name once signed in.
import { serverEnabled, setDisplayName } from './server.ts';

const NAME = 'sarhad:name';
/** the name last confirmed by the server (server builds) */
const SYNCED = 'sarhad:name-synced';

function get(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function set(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* blocked storage: the name lives for this visit only */
  }
}

/** A friendly default the player can keep, e.g. "Player 3FA2". */
export function randomName(rand: () => number = Math.random): string {
  const hex = Math.floor(rand() * 0x10000).toString(16).toUpperCase().padStart(4, '0');
  return `Player ${hex}`;
}

/** Collapses spaces; 3–20 letters, digits or spaces (the server allows the same length). */
export function cleanName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}
export function nameError(raw: string): string | null {
  const n = cleanName(raw);
  if (n.length < 3 || n.length > 20) return 'Use 3–20 letters.';
  if (!/^[\p{L}\p{M}\p{N} ]+$/u.test(n)) return 'Letters, numbers and spaces only.';
  return null;
}

export function localName(): string | null {
  return get(NAME);
}

/** Saves locally, then (server builds) sends it in the background. */
export function chooseName(raw: string): void {
  set(NAME, cleanName(raw));
  void syncName();
}

let inFlight: Promise<void> | null = null;
/** Sends the local name if the server hasn't confirmed it yet. Signs in if needed; never throws. */
export function syncName(): Promise<void> {
  if (!serverEnabled) return Promise.resolve();
  inFlight ??= (async () => {
    try {
      const name = localName();
      if (!name || get(SYNCED) === name) return;
      if ((await setDisplayName(name)) === null) set(SYNCED, name);
    } catch {
      /* retried on the next open */
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}
