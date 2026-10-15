// Small shared pieces of the visual language.

export const iconBtn = 'inline-flex min-h-[48px] min-w-[48px] items-center justify-center rounded-card text-ink';

export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className={`${iconBtn} -ml-3`} aria-label="Home">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </button>
  );
}

/** The pair, joined by a dotted thread: 'Assam ⋯⋯ Punjab', or '? ⋯⋯ ?' while hidden. */
export function Pair({ a, b, className = '' }: { a: string; b: string; className?: string }) {
  return (
    <span className={`font-display font-extrabold ${className}`}>
      {a} <span className="font-semibold text-marigold-deep" aria-label="to">⋯⋯</span> {b}
    </span>
  );
}
