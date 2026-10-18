import { describe, expect, it } from 'vitest';
import { cleanName, nameError, randomName } from './name.ts';

describe('display name', () => {
  it('random default looks like "Player 3FA2" and is valid', () => {
    expect(randomName(() => 0x3fa2 / 0x10000)).toBe('Player 3FA2');
    expect(randomName(() => 0)).toBe('Player 0000');
    for (let i = 0; i < 50; i++) {
      const n = randomName();
      expect(n).toMatch(/^Player [0-9A-F]{4}$/);
      expect(nameError(n)).toBeNull();
    }
  });
  it('3–20 letters, digits and spaces, spaces collapsed', () => {
    expect(cleanName('  Asha   K ')).toBe('Asha K');
    expect(nameError('Asha K')).toBeNull();
    expect(nameError('अनु')).toBeNull();
    expect(nameError('ab')).toMatch(/3–20/);
    expect(nameError('   ab   ')).toMatch(/3–20/);
    expect(nameError('x'.repeat(21))).toMatch(/3–20/);
    expect(nameError('<script>')).toMatch(/Letters/);
  });
});
