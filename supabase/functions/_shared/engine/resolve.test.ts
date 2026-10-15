import { describe, expect, it } from 'vitest';
import { normalize } from './normalize.ts';
import { buildAliasIndex, damerauLevenshtein, liveSuggestion, resolveInput } from './resolve.ts';
import type { ResolveCtx } from './resolve.ts';
import { index, regions } from './fixtures/data.ts';

const ctx = (guesses: string[] = []): ResolveCtx => ({ start: 'GJ', end: 'KL', guesses, index });
const r = (raw: string, guesses: string[] = []) => resolveInput(raw, ctx(guesses));

describe('normalize', () => {
  it('canonicalises punctuation, case, ampersand and Latin diacritics', () => {
    expect(normalize('  M.P. ')).toBe('mp');
    expect(normalize('J&K')).toBe('j and k');
    expect(normalize('Dādra and Nagar Haveli')).toBe('dadra and nagar haveli');
    expect(normalize('Tamil-Nadu')).toBe('tamil nadu');
    expect(normalize('  West   Bengal ')).toBe('west bengal');
  });
  it('keeps Indic combining marks and removes ZWJ/ZWNJ', () => {
    expect(normalize('मध्य प्रदेश')).toBe('मध्य प्रदेश'.normalize('NFKC'));
    expect(normalize('मिज़ोरम')).toContain('़'); // nukta kept
    expect(normalize('क्‍ष')).toBe('क्ष');
  });
  it('index builds without alias collisions', () => {
    expect(() => buildAliasIndex(regions)).not.toThrow();
    expect(() => buildAliasIndex([...regions, { ...regions[0], id: 'XX' }])).toThrow(/maps to both/);
  });
});

describe('invalid input (I1–I4)', () => {
  it('I1: empty, spaces, emoji → empty; 200 chars trimmed to 40, no guess', () => {
    expect(r('')).toEqual({ type: 'reject', reason: 'empty' });
    expect(r('     ')).toEqual({ type: 'reject', reason: 'empty' });
    expect(r('😀')).toEqual({ type: 'reject', reason: 'empty' });
    expect(normalize('a'.repeat(200))).toHaveLength(40);
    expect(r('a'.repeat(200)).type).not.toBe('accept');
  });
  it("I2: 'Paris', 'xyz' → unknown", () => {
    expect(r('Paris')).toEqual({ type: 'reject', reason: 'unknown' });
    expect(r('xyz')).toEqual({ type: 'reject', reason: 'unknown' });
  });
  it('I3: Puducherry, Andaman, Lakshadweep → unplayable', () => {
    for (const s of ['Puducherry', 'Andaman', 'Lakshadweep']) expect(r(s)).toEqual({ type: 'reject', reason: 'unplayable' });
  });
  it('I4: start or end typed → endpoint', () => {
    expect(r('Gujarat')).toEqual({ type: 'reject', reason: 'endpoint' });
    expect(r('kl')).toEqual({ type: 'reject', reason: 'endpoint' });
  });
});

describe('aliases and typos (I5–I7)', () => {
  it('I5: aliases accepted at once', () => {
    expect(r('mp')).toEqual({ type: 'accept', id: 'MP' });
    expect(r('M.P.')).toEqual({ type: 'accept', id: 'MP' });
    expect(r('Orissa')).toEqual({ type: 'accept', id: 'OD' });
    expect(r('Uttaranchal')).toEqual({ type: 'accept', id: 'UK' });
    expect(r('मध्य प्रदेश')).toEqual({ type: 'accept', id: 'MP' });
    expect(r('J&K')).toEqual({ type: 'accept', id: 'JK' });
  });
  it('I6: typos → one highlighted chip, never auto-accepted', () => {
    for (const [typo, id] of [['Maharastra', 'MH'], ['Chattisgarh', 'CG'], ['Telengana', 'TG']]) {
      const res = r(typo);
      expect(res.type).toBe('suggest');
      if (res.type === 'suggest') {
        expect(res.highlight).toBe(id);
        expect(res.ids[0]).toBe(id);
      }
    }
  });
  it("I7: abbreviations exact only; no fuzzy under 4 chars; 'Mani' gives a chip, not an accept", () => {
    expect(r('up')).toEqual({ type: 'accept', id: 'UP' });
    expect(r('uk')).toEqual({ type: 'accept', id: 'UK' });
    for (const s of ['qzx', 'upx', 'mhh', 'ka1']) {
      const res = r(s);
      expect(res.type).not.toBe('accept');
      if (res.type === 'suggest') expect(res.highlight).toBeUndefined();
    }
    expect(r('Mani')).toEqual({ type: 'suggest', ids: ['MN'] });
    const ut = r('ut');
    expect(ut.type).toBe('suggest');
    if (ut.type === 'suggest') {
      expect(ut.ids).toEqual(['UP', 'UK']);
      expect(ut.highlight).toBeUndefined();
    }
  });
  it('prefix chips: at most 4, skip endpoints, guessed and unplayable', () => {
    const res = r('ma', ['MP']);
    expect(res.type).toBe('suggest');
    if (res.type === 'suggest') {
      expect(res.ids.length).toBeLessThanOrEqual(4);
      expect(res.ids).not.toContain('MP');
      expect(res.highlight).toBeUndefined();
    }
  });
  it('Damerau–Levenshtein counts a transposition as 1', () => {
    expect(damerauLevenshtein('goa', 'gao')).toBe(1);
    expect(damerauLevenshtein('kerala', 'kerala')).toBe(0);
    expect(damerauLevenshtein('maharastra', 'maharashtra')).toBe(1);
  });
});

describe('duplicates (D1)', () => {
  it("MH twice; 'Maharashtra' then 'mh' → duplicate", () => {
    expect(r('MH', ['MH'])).toEqual({ type: 'reject', reason: 'duplicate' });
    expect(r('Maharashtra')).toEqual({ type: 'accept', id: 'MH' });
    expect(r('mh', ['MH'])).toEqual({ type: 'reject', reason: 'duplicate' });
    expect(r('Maharastra', ['MH'])).toEqual({ type: 'reject', reason: 'duplicate' });
  });
});

describe('live suggestions never reveal names early (I7)', () => {
  const live = (raw: string, guesses: string[] = [], start = 'AS', end = 'PB') =>
    liveSuggestion(raw, { start, end, guesses, index });

  it('partial input shows nothing', () => {
    for (const raw of ['a', 'ar', 'arun', 'kera', 'mani', 'pradesh', 'utt']) expect(live(raw), raw).toBeNull();
  });
  it('a complete name word or ≥ 75% of a name gives exactly one chip', () => {
    expect(live('arunachal')).toBe('AR');
    expect(live('keral')).toBe('KL');
    expect(live('uttar')).toBe('UP'); // not Uttarakhand
    expect(live('west')).toBe('WB');
    expect(live('madhya')).toBe('MP');
    expect(live('tamil')).toBe('TN');
    expect(live('मध्य')).toBe('MP');
  });
  it('exact names and aliases get no chip (Enter accepts them)', () => {
    for (const raw of ['mp', 'up', 'j&k', 'orissa', 'kerala', 'Goa']) expect(live(raw), raw).toBeNull();
    expect(resolveInput('orissa', { start: 'AS', end: 'PB', guesses: [], index })).toEqual({ type: 'accept', id: 'OD' });
  });
  it('words shared by several regions give nothing', () => {
    expect(live('and')).toBeNull();
    expect(live('pradesh')).toBeNull();
  });
  it('endpoints, guesses and unplayable regions never produce a chip', () => {
    expect(live('keral', [], 'KL', 'PB')).toBeNull();
    expect(live('keral', ['KL'])).toBeNull();
    expect(live('lakshadw')).toBeNull();
  });
});
