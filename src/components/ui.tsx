// Small shared pieces of the visual language.
import type { CSSProperties } from 'react';

/** Round chunky icon button (white face, ink outline, grey lip). */
export const iconBtn = 'btn btn-2 btn-icon';

export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className={iconBtn} aria-label="Home">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </button>
  );
}

/**
 * The '? ⋯⋯ ?' mark. `busy`: dots travel left to right and the question marks bob (loading:
 * sign-in, start_daily, the leaderboard). Otherwise it idles slowly (the Ready screen).
 */
export function Mark({ busy, label = 'Loading', className = '' }: { busy?: boolean; label?: string; className?: string }) {
  return (
    <span
      className={`mark font-display ${busy ? 'mark-busy' : ''} ${className}`}
      role={busy ? 'status' : 'img'}
      aria-label={busy ? label : 'Two hidden states'}
    >
      <span className="mark-q" aria-hidden="true">?</span>
      <span className="mark-dots" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <i key={i} style={{ '--i': i } as CSSProperties} />
        ))}
      </span>
      <span className="mark-q mark-q2" aria-hidden="true">?</span>
    </span>
  );
}

/** The pair, joined by a dotted red thread: 'Assam ⋯⋯ Punjab', or '? ⋯⋯ ?' while hidden. Names stay in normal case. */
export function Pair({ a, b, className = '' }: { a: string; b: string; className?: string }) {
  return (
    <span className={`font-display ${className}`}>
      {a} <span className="text-red" aria-label="to">⋯⋯</span> {b}
    </span>
  );
}
