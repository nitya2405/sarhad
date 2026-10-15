/** Max characters of user input considered (after trim). */
export const INPUT_MAX = 40;

/**
 * Canonical form used for both user input and stored aliases.
 * Steps: NFKC; trim; cap to INPUT_MAX chars; lowercase Latin; strip Latin diacritics only
 * (never strip Indic combining marks such as nukta, matras, virama); remove ZWJ/ZWNJ;
 * '&' → ' and '; remove '.' and apostrophes; other punctuation/symbols → space; collapse spaces.
 * @example normalize('  M.P. ') === 'mp'; normalize('J&K') === 'j and k'; normalize('Dādra') === 'dadra'
 */
export function normalize(s: string): string {
  let t = s.normalize('NFKC').trim();
  t = Array.from(t).slice(0, INPUT_MAX).join('');
  t = t.toLowerCase();
  // Strip combining diacritics only when they sit on a Latin base letter.
  t = t.normalize('NFD').replace(/(\p{Script=Latin})[̀-ͯ]+/gu, '$1').normalize('NFC');
  t = t
    .replace(/[‌‍︎️]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[.'‘’`]/g, '')
    .replace(/[\p{P}\p{S}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return t;
}

/** True if the normalised string contains only Latin letters, digits and spaces (fuzzy matching applies only to these). */
export function isLatin(normalized: string): boolean {
  return /^[a-z0-9 ]+$/.test(normalized);
}
