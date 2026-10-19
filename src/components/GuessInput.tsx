import { useMemo, useRef, useState, type FormEvent } from 'react';
import { liveSuggestion, normalize, resolveInput, type RegionId, type RejectReason } from '@engine/index.ts';
import { aliasIndex, regionName } from '../lib/data.ts';
import { play } from '../lib/sound.ts';

interface Props {
  start: RegionId;
  end: RegionId;
  guesses: RegionId[];
  onAccept: (id: RegionId) => void;
  /** a duplicate was typed: the game pulses that state's chip */
  onDuplicate: (id: RegionId) => void;
  /** first game only: a short hint in the message line */
  hint?: string;
}

/**
 * Contexto-style input. While typing, nothing is suggested until the text nearly names exactly one
 * region (one completion chip). Enter accepts exact names/aliases, or the chip. A misspelling
 * gets one "Did you mean …?" chip that the next Enter accepts. Rejections spend no guess.
 */
export function GuessInput({ start, end, guesses, onAccept, onDuplicate, hint }: Props) {
  const [text, setText] = useState('');
  const [message, setMessage] = useState('');
  const [msgKey, setMsgKey] = useState(0);
  /** "Did you mean" chip, valid while the text stays the same */
  const [didYouMean, setDidYouMean] = useState<{ id: RegionId; text: string }>();
  const inputRef = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const ctx = useMemo(() => ({ start, end, guesses, index: aliasIndex() }), [start, end, guesses]);

  const live = useMemo(() => liveSuggestion(text, ctx), [text, ctx]);
  const chip = didYouMean?.text === text ? didYouMean.id : live;

  function say(msg: string) {
    setMessage(msg);
    setMsgKey((k) => k + 1);
  }

  function accept(id: RegionId) {
    setText('');
    setMessage('');
    setDidYouMean(undefined);
    onAccept(id);
    inputRef.current?.focus();
  }

  /** Restart the shake without remounting the input (keeps text and focus). */
  function shake() {
    const el = rowRef.current;
    if (!el) return;
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
  }

  function reject(reason: RejectReason) {
    shake();
    play('rejected');
    say(rejectMessage(reason));
    if (reason === 'duplicate') {
      const r = resolveInput(text, { ...ctx, guesses: [] });
      const id = r.type === 'accept' ? r.id : r.type === 'suggest' ? r.highlight : undefined;
      if (id) onDuplicate(id);
    }
  }

  function rejectMessage(reason: RejectReason): string {
    switch (reason) {
      case 'empty':
        return 'Type a state name';
      case 'unknown':
        return 'Not a state name';
      case 'duplicate':
        return 'Already guessed';
      case 'unplayable':
        return 'No land border — not playable';
      case 'endpoint': {
        // Resolve again without endpoints to tell which one was meant.
        const r = resolveInput(text, { ...ctx, start: '', end: '', guesses: [] });
        const id = r.type === 'accept' ? r.id : r.type === 'suggest' ? (r.highlight ?? r.ids[0]) : undefined;
        return id === end ? "That's your end" : "That's your start";
      }
    }
  }

  /** A partial name that only fits the start or end state (e.g. "Arun" when Arunachal Pradesh is the start). */
  function partOfEndpoint(): boolean {
    const r = resolveInput(text, { ...ctx, start: '', end: '', guesses: [] });
    const ids = r.type === 'accept' ? [r.id] : r.type === 'suggest' ? r.ids : [];
    return ids.length > 0 && ids.every((id) => id === start || id === end);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (chip) return accept(chip);
    if (!normalize(text)) return reject('empty');
    const r = resolveInput(text, ctx);
    if (r.type === 'accept') return accept(r.id);
    if (r.type === 'reject') return reject(r.reason === 'unknown' && partOfEndpoint() ? 'endpoint' : r.reason);
    if (r.highlight) {
      // misspelling: offer one chip, never auto-accept
      setDidYouMean({ id: r.highlight, text });
      say(`Did you mean ${regionName(r.highlight)}?`);
      return;
    }
    // a partial name: listing its matches would reveal names, so ask for the whole name
    shake();
    play('rejected');
    say('Type the full name');
  }

  const line = message || hint || '';
  return (
    <form onSubmit={submit} className="relative">
      {/* sits on top of whatever is above the input bar (guess chips, the map), so the bar's height never changes */}
      <div className={chip || line ? 'absolute inset-x-0 bottom-full flex min-h-11 items-center gap-2 bg-white pb-1.5' : 'hidden'}>
        {chip && (
          <button
            type="button"
            onClick={() => accept(chip)}
            className="fade-in inline-flex min-h-11 items-center gap-1 rounded-full border-2 border-ink bg-red px-4 font-display text-base text-white"
          >
            {didYouMean?.id === chip ? `Did you mean ${regionName(chip)}?` : regionName(chip)}
            <span aria-hidden="true"> ↵</span>
            <span className="sr-only"> — press Enter to add</span>
          </button>
        )}
        <p
          key={msgKey}
          role="status"
          aria-live="polite"
          className={`min-w-0 text-sm ${message ? 'err-pill slide-in' : 'flex-1 text-muted'} ${chip ? 'sr-only' : ''}`}
        >
          {line}
        </p>
      </div>
      <div ref={rowRef} className="flex gap-2" onAnimationEnd={(e) => e.currentTarget.classList.remove('shake')}>
        <label htmlFor="guess" className="sr-only">
          Name a state or union territory
        </label>
        <input
          id="guess"
          ref={inputRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setMessage('');
          }}
          // no autoFocus: the keyboard opens only on a tap. These attributes also keep iOS from
          // offering contact AutoFill above the keyboard.
          name="sarhad-guess"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="words"
          spellCheck={false}
          enterKeyHint="go"
          maxLength={80}
          placeholder="Type a state…"
          className="min-h-[52px] min-w-0 flex-1 rounded-card border-[3px] border-ink bg-white px-4 text-base text-ink placeholder:text-muted shadow-[0_3px_0_var(--color-border)] focus:outline-none focus-visible:outline-none focus:shadow-[0_4px_0_var(--color-ink)]"
        />
        <button type="submit" aria-label="Enter" className="btn btn-icon btn-red mb-0 min-h-[52px] w-[56px] text-2xl">
          ↵
        </button>
      </div>
    </form>
  );
}
