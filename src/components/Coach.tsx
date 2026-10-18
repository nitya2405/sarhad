import { useEffect, useRef, useState } from 'react';

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

const svg = { width: 96, height: 72, viewBox: '0 0 96 72', fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;
const INK = 'var(--color-ink)';
const RED = 'var(--color-red)';

const FRAMES = [
  {
    title: 'Two states light up.',
    line: 'Join them by land.',
    icon: (
      <svg {...svg}>
        <path d="M10 22 L26 12 L38 20 L34 36 L18 38 Z" fill={RED} stroke={INK} strokeWidth="3" />
        <path d="M58 40 L76 34 L88 46 L80 60 L62 58 Z" fill={RED} stroke={INK} strokeWidth="3" />
        <path d="M34 30 L62 48" stroke="#fff" strokeWidth="7" />
        <path d="M34 30 L62 48" stroke={INK} strokeWidth="3" strokeDasharray="5 5" />
      </svg>
    ),
  },
  {
    title: 'Type a state in between.',
    line: 'Any order. Any path.',
    icon: (
      <svg {...svg}>
        <rect x="6" y="22" width="84" height="28" rx="10" fill="#fff" stroke={INK} strokeWidth="3" />
        <path d="M18 36h34" stroke={INK} strokeWidth="3" strokeDasharray="4 4" />
        <path d="M60 29v14" stroke={RED} strokeWidth="3.5" />
      </svg>
    ),
  },
  {
    title: 'Be fast. More points.',
    line: '20 tries.',
    icon: (
      <svg {...svg}>
        <circle cx="36" cy="40" r="22" fill="#fff" stroke={INK} strokeWidth="3" />
        <path d="M36 40V27M29 12h14M36 12v6" stroke={INK} strokeWidth="3" />
        <path d="M36 40l9 6" stroke={RED} strokeWidth="3.5" />
        <path d="M68 30h22M72 40h18M76 50h14" stroke={RED} strokeWidth="3.5" />
      </svg>
    ),
  },
];

/** How to play: three frames, one Next button, Skip at the top right. The '?' on Home reopens it. */
export function Coach({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => card.current?.focus(), []); // once, on open
  const last = i === FRAMES.length - 1;
  const close = () => {
    markSeen();
    onClose();
  };
  const f = FRAMES[i];
  return (
    <div role="dialog" aria-modal="true" aria-label="How to play" className="absolute inset-0 z-50 flex items-center justify-center bg-ink/60 p-6">
      {/* focus lands on the card (not the Next button), so no focus ring shows until the keyboard is used */}
      <div ref={card} tabIndex={-1} className="panel fade-in relative flex w-full max-w-xs flex-col items-center gap-4 px-6 pt-10 pb-5 text-center outline-none">
        <button className="absolute top-2 right-2 min-h-11 px-3 font-display text-base uppercase tracking-wide text-muted" onClick={close}>
          Skip
        </button>
        <span key={i} className="fade-in">
          {f.icon}
        </span>
        <p key={`t${i}`} className="fade-in flex flex-col gap-1" aria-live="polite">
          <span className="font-display text-3xl leading-tight text-balance">{f.title}</span>
          <span className="font-display text-xl leading-tight text-muted">{f.line}</span>
        </p>
        <span className="flex gap-2" aria-hidden="true">
          {FRAMES.map((_, j) => (
            <span key={j} className={`h-2.5 w-2.5 ${j === i ? 'bg-red outline-2 outline-ink' : 'bg-border'}`} />
          ))}
        </span>
        <button className="btn mt-1 w-full" onClick={last ? close : () => setI(i + 1)}>
          {last ? 'Play' : 'Next'}
        </button>
      </div>
    </div>
  );
}
