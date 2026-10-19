// Sound effects, synthesised with the Web Audio API: no audio files. On by default; the setting is per
// device. iOS lets audio start only inside a tap, so the context is created and resumed on the first
// pointerdown / touchend / keydown (unlockAudio). Every sound is short (≤ 300 ms) and quiet.
const KEY = 'sarhad:sound';
const VOLUME = 0.16;

export type Sound = 'start' | 'connected' | 'notLinked' | 'rejected' | 'win' | 'shortest' | 'lose';

type Ctx = AudioContext;
let ctx: Ctx | null = null;
let master: GainNode | null = null;

export function soundOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== '0';
  } catch {
    return true;
  }
}

export function setSoundOn(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    /* storage blocked: setting lasts for this session only */
  }
  // muting also silences a sound that is still playing
  if (master && ctx) master.gain.setValueAtTime(on ? VOLUME : 0, ctx.currentTime);
}

function context(): Ctx | null {
  if (ctx) return ctx;
  const AC = typeof window === 'undefined' ? undefined : (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  if (!AC) return null;
  try {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = soundOn() ? VOLUME : 0;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

/** Listens for the first tap or key press and unlocks audio inside it (iOS). Call once at startup. */
export function unlockAudio(): void {
  if (typeof document === 'undefined') return;
  const events = ['pointerdown', 'touchend', 'keydown'] as const;
  const unlock = () => {
    const c = context();
    if (!c) return done();
    try {
      // a one-sample silent buffer: older iOS needs a sound started inside the gesture
      const src = c.createBufferSource();
      src.buffer = c.createBuffer(1, 1, 22050);
      src.connect(c.destination);
      src.start(0);
    } catch {
      /* ignore */
    }
    void c.resume?.().then(() => c.state === 'running' && done(), () => {});
  };
  const done = () => events.forEach((e) => document.removeEventListener(e, unlock, true));
  events.forEach((e) => document.addEventListener(e, unlock, true));
}

/** One note: a quick attack and an exponential fade, `dur` seconds from `at` (seconds after now). */
function tone(c: Ctx, at: number, freq: number, dur: number, gain: number, type: OscillatorType = 'sine', to?: number) {
  const t = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(master!);
  o.start(t);
  o.stop(t + dur);
}

const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5, G4 = 392, D4 = 293.66;

export function play(s: Sound): void {
  if (!soundOn()) return;
  const c = context();
  if (!c || !master) return;
  if (c.state === 'suspended') void c.resume?.().catch(() => {});
  try {
    switch (s) {
      case 'start': // two notes up
        tone(c, 0, C5, 0.09, 0.5, 'triangle');
        tone(c, 0.08, G5, 0.14, 0.5, 'triangle');
        break;
      case 'connected': // bright blip
        tone(c, 0, C6, 0.1, 0.55, 'triangle', 1568);
        break;
      case 'notLinked': // soft neutral tick
        tone(c, 0, 660, 0.05, 0.25);
        break;
      case 'rejected': // low muted thud
        tone(c, 0, 150, 0.14, 0.8, 'sine', 80);
        break;
      case 'win': // rising arpeggio
        [C5, E5, G5, C6].forEach((f, i) => tone(c, i * 0.06, f, 0.1, 0.5, 'triangle'));
        break;
      case 'shortest': // sparkle on top of the win
        tone(c, 0.16, 2093, 0.08, 0.22);
        tone(c, 0.2, 2637, 0.09, 0.22);
        break;
      case 'lose': // gentle falling two notes
        tone(c, 0, G4, 0.13, 0.45);
        tone(c, 0.13, D4, 0.16, 0.45);
        break;
    }
  } catch {
    /* audio failed: the game goes on silently */
  }
}

/** Tests only: forget the context so a fake AudioContext can be installed. */
export function resetAudioForTests(): void {
  ctx = null;
  master = null;
}
