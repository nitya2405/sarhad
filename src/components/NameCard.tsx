import { useEffect, useRef, useState, type FormEvent } from 'react';
import { chooseName, localName, nameError, randomName } from '../lib/name.ts';

/**
 * "What should we call you?": a dialog on first open (before How to play); `inline` on the board (Change name).
 * Prefilled with a random friendly name the player can keep. Saving is local and instant; the
 * server copy is sent in the background once signed in.
 */
export function NameCard({ onDone, inline }: { onDone: (name: string) => void; inline?: boolean }) {
  const [name, setName] = useState(() => localName() ?? randomName());
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.select(), []);

  function save(e: FormEvent) {
    e.preventDefault();
    const err = nameError(name);
    if (err) return setError(err);
    chooseName(name);
    onDone(localName() ?? name);
  }

  const form = (
    <form onSubmit={save} className={`panel fade-in flex w-full flex-col gap-3 px-5 pt-6 pb-5 text-center ${inline ? '' : 'max-w-xs'}`}>
      <h2 id="name-title" className="font-display text-3xl leading-tight text-balance">
        What should we call you?
      </h2>
      <label htmlFor="player-name" className="sr-only">
        Your name
      </label>
      <input
        id="player-name"
        ref={input}
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setError('');
        }}
        maxLength={20}
        autoComplete="nickname"
        autoCapitalize="words"
        spellCheck={false}
        enterKeyHint="done"
        className="min-h-[52px] min-w-0 rounded-card border-[3px] border-ink bg-white px-3 text-center font-display text-xl shadow-[0_3px_0_var(--color-border)] focus:outline-none focus:shadow-[0_4px_0_var(--color-ink)]"
      />
      <p className="min-h-6 text-sm text-muted">
        {error ? (
          <span role="alert" className="err-pill">
            {error}
          </span>
        ) : (
          'Shown on the leaderboard. 3–20 letters.'
        )}
      </p>
      <button className="btn w-full">That's me</button>
    </form>
  );
  if (inline) return form;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="name-title" className="absolute inset-0 z-50 flex items-center justify-center bg-ink/60 p-6">
      {form}
    </div>
  );
}
