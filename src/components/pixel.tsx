// Small pixel-art accents: inline SVG on a pixel grid, crisp edges, no images or fonts.
import { GUESS_CAP } from '@engine/index.ts';

const PALETTE: Record<string, string> = {
  k: 'var(--color-ink)',
  r: 'var(--color-red)',
  h: 'var(--color-red-hi)',
  l: 'var(--color-red-lip)',
  w: '#fff',
};

/** One rect per horizontal run of a sprite, in grid units (for placing inside a larger SVG). */
export function SpriteRects({ rows }: { rows: string[] }) {
  const rects: { x: number; y: number; n: number; c: string }[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; ) {
      const c = row[x];
      let n = 1;
      while (row[x + n] === c) n++;
      if (c !== '.') rects.push({ x, y, n, c });
      x += n;
    }
  });
  return (
    <>
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.n} height={1} fill={PALETTE[r.c]} />
      ))}
    </>
  );
}

/** Map pin, 9×11: white teardrop, ink outline, solid red dot; the tip is the bottom-centre pixel. */
export const PIN = [
  '..kkkkk..',
  '.kwwwwwk.',
  'kwwwwwwwk',
  'kwwrrrwwk',
  'kwwrrrwwk',
  'kwwrrrwwk',
  '.kwwwwwk.',
  '.kwwwwwk.',
  '..kwwwk..',
  '...kwk...',
  '....k....',
];

/** Draws a sprite from rows of palette letters ('.' = empty), one rect per horizontal run. */
function Sprite({ rows, px, className = '' }: { rows: string[]; px: number; className?: string }) {
  const w = Math.max(...rows.map((r) => r.length));
  const rects: { x: number; y: number; n: number; c: string }[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; ) {
      const c = row[x];
      let n = 1;
      while (row[x + n] === c) n++;
      if (c !== '.') rects.push({ x, y, n, c });
      x += n;
    }
  });
  return (
    <svg width={w * px} height={rows.length * px} viewBox={`0 0 ${w} ${rows.length}`} className={`pixel inline-block shrink-0 ${className}`} aria-hidden="true">
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.n} height={1} fill={PALETTE[r.c]} />
      ))}
    </svg>
  );
}

const FLAME = [
  '...k...',
  '..krk..',
  '..krk.k',
  '.krrrkk',
  '.krhrrk',
  'krrhwrk',
  'krhwwrk',
  'krhwwrk',
  '.krrrk.',
  '..kkk..',
];

const COIN = [
  '..kkkk..',
  '.khhhhk.',
  'khwhhrrk',
  'khwhrrlk',
  'khhrrrlk',
  'khrrrllk',
  '.krllll.',
  '..kkkk..',
];

export const Flame = ({ px = 3 }: { px?: number }) => <Sprite rows={FLAME} px={px} />;
export const Coin = ({ px = 3 }: { px?: number }) => <Sprite rows={COIN} px={px} />;

/** Pixel bar of guesses left: ink frame, 20 red cells draining from the right as guesses are spent. */
export function PixelBar({ left }: { left: number }) {
  const cell = 3; // grid units per cell
  const w = GUESS_CAP * (cell + 1) + 3;
  return (
    <svg viewBox={`0 0 ${w} 7`} preserveAspectRatio="none" className="pixel block h-3.5 w-full" aria-hidden="true">
      <rect x={0} y={0} width={w} height={7} fill="var(--color-ink)" />
      <rect x={1} y={1} width={w - 2} height={5} fill="var(--color-land)" />
      {Array.from({ length: GUESS_CAP }, (_, i) =>
        i < left ? (
          <g key={i}>
            <rect x={2 + i * (cell + 1)} y={2} width={cell} height={3} fill="var(--color-red)" />
            <rect x={2 + i * (cell + 1)} y={2} width={cell} height={1} fill="var(--color-red-hi)" />
          </g>
        ) : null,
      )}
    </svg>
  );
}
