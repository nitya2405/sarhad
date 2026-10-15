import { useState } from 'react';

const KEY = 'sarhad:coach';

export function coachSeen(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return true; // storage blocked: don't nag on every open
  }
}

function markSeen() {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* ignore */
  }
}

const svg = { width: 72, height: 72, viewBox: '0 0 72 72', fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;

const FRAMES = [
  {
    text: 'Two states. Join them by land.',
    icon: (
      <svg {...svg}>
        <circle cx="16" cy="20" r="9" fill="var(--color-marigold)" stroke="var(--color-marigold-deep)" strokeWidth="2" />
        <circle cx="56" cy="52" r="9" fill="var(--color-marigold)" stroke="var(--color-marigold-deep)" strokeWidth="2" />
        <path d="M23 25 L49 47" stroke="var(--color-marigold-deep)" strokeWidth="3" strokeDasharray="6 5" />
      </svg>
    ),
  },
  {
    text: 'Type the states between. Any order.',
    icon: (
      <svg {...svg}>
        <rect x="6" y="24" width="60" height="24" rx="8" stroke="var(--color-ink)" strokeWidth="3" />
        <path d="M16 36h22" stroke="var(--color-ink)" strokeWidth="3" />
        <path d="M46 30v12" stroke="var(--color-marigold-deep)" strokeWidth="3" />
      </svg>
    ),
  },
  {
    text: 'Faster = more points.',
    icon: (
      <svg {...svg}>
        <circle cx="36" cy="40" r="22" stroke="var(--color-ink)" strokeWidth="3" />
        <path d="M36 40V27M30 12h12" stroke="var(--color-ink)" strokeWidth="3" />
        <path d="M36 40l9 6" stroke="var(--color-marigold-deep)" strokeWidth="3" />
      </svg>
    ),
  },
];

/** First-open coach: three frames, tap to advance. The '?' on Home reopens it. */
export function Coach({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const last = i === FRAMES.length - 1;
  const next = () => {
    if (!last) return setI(i + 1);
    markSeen();
    onClose();
  };
  return (
    <div role="dialog" aria-modal="true" aria-label="How to play" className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-6">
      <button
        autoFocus
        onClick={next}
        className="fade-in flex w-full max-w-xs flex-col items-center gap-5 rounded-card bg-paper px-6 py-8 text-center"
        aria-label={`${FRAMES[i].text} ${last ? 'Tap to start.' : 'Tap for next.'}`}
      >
        <span key={i} className="fade-in">
          {FRAMES[i].icon}
        </span>
        <span className="font-display text-2xl font-extrabold leading-tight">{FRAMES[i].text}</span>
        <span className="flex gap-2" aria-hidden="true">
          {FRAMES.map((_, j) => (
            <span key={j} className={`h-2 w-2 rounded-full ${j === i ? 'bg-ink' : 'bg-border'}`} />
          ))}
        </span>
        <span className="text-sm text-ink-soft">{last ? 'Tap to start' : 'Tap'}</span>
      </button>
    </div>
  );
}
