// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { play, resetAudioForTests, setSoundOn, soundOn, type Sound } from './sound.ts';

/** A stand-in AudioContext that records each oscillator's start and stop time. */
class FakeContext {
  static notes: { start: number; stop: number }[] = [];
  currentTime = 10;
  state = 'running';
  destination = {};
  resume = () => Promise.resolve();
  createGain() {
    return { gain: { value: 1, setValueAtTime(v: number) { this.value = v; }, exponentialRampToValueAtTime() {} }, connect() {} };
  }
  createOscillator() {
    const note = { start: 0, stop: 0 };
    return {
      type: 'sine',
      frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() {},
      start: (t: number) => { note.start = t; },
      stop: (t: number) => { note.stop = t; FakeContext.notes.push(note); },
    };
  }
}

const ALL: Sound[] = ['start', 'connected', 'notLinked', 'rejected', 'win', 'shortest', 'lose'];

describe('sound', () => {
  beforeEach(() => {
    localStorage.clear();
    resetAudioForTests();
    FakeContext.notes = [];
    (window as unknown as { AudioContext: unknown }).AudioContext = FakeContext;
  });
  afterEach(() => {
    delete (window as unknown as { AudioContext?: unknown }).AudioContext;
  });

  it('is on by default and the toggle is saved', () => {
    expect(soundOn()).toBe(true);
    setSoundOn(false);
    expect(localStorage.getItem('sarhad:sound')).toBe('0');
    expect(soundOn()).toBe(false);
  });

  it('every sound is at most 300 ms long', () => {
    for (const s of ALL) {
      FakeContext.notes = [];
      play(s);
      expect(FakeContext.notes.length, s).toBeGreaterThan(0);
      expect(Math.max(...FakeContext.notes.map((n) => n.stop)) - 10, s).toBeLessThanOrEqual(0.3);
    }
  });

  it('plays nothing with the toggle off, straight away', () => {
    play('connected');
    expect(FakeContext.notes.length).toBe(1);
    setSoundOn(false);
    for (const s of ALL) play(s);
    expect(FakeContext.notes.length).toBe(1);
  });

  it('is silent without Web Audio', () => {
    delete (window as unknown as { AudioContext?: unknown }).AudioContext;
    expect(() => play('win')).not.toThrow();
  });
});
