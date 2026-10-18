// Small shared pieces of the visual language.

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

/** The pair, joined by a dotted red thread: 'Assam ⋯⋯ Punjab', or '? ⋯⋯ ?' while hidden. Names stay in normal case. */
export function Pair({ a, b, className = '' }: { a: string; b: string; className?: string }) {
  return (
    <span className={`font-display ${className}`}>
      {a} <span className="text-red" aria-label="to">⋯⋯</span> {b}
    </span>
  );
}
