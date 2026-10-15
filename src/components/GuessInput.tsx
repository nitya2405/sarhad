import { useMemo, useRef, useState, type FormEvent } from 'react';
import { normalize, resolveInput, type RegionId, type RejectReason } from '@engine/index.ts';
import { aliasIndex, regionName } from '../lib/data.ts';

interface Props {
  start: RegionId;
  end: RegionId;
  guesses: RegionId[];
  onAccept: (id: RegionId) => void;
}

/** Contexto-style input: text box + Enter, up to 4 chips, one-line message. Rejections spend no guess. */
export function GuessInput({ start, end, guesses, onAccept }: Props) {
  const [text, setText] = useState('');
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const ctx = useMemo(() => ({ start, end, guesses, index: aliasIndex() }), [start, end, guesses]);

  const live = useMemo(() => (normalize(text).length >= 2 ? resolveInput(text, ctx) : null), [text, ctx]);
  const chips: RegionId[] = live?.type === 'suggest' ? live.ids : live?.type === 'accept' ? [live.id] : [];
  const highlight = live?.type === 'suggest' ? live.highlight : live?.type === 'accept' ? live.id : undefined;

  function accept(id: RegionId) {
    setText('');
    setMessage('');
    onAccept(id);
    inputRef.current?.focus();
  }

  function rejectMessage(reason: RejectReason): string {
    switch (reason) {
      case 'empty':
        return 'Type a state or union territory.';
      case 'unknown':
        return 'Not a state name';
      case 'duplicate':
        return 'Already guessed';
      case 'unplayable':
        return 'No land border — not playable';
      case 'endpoint': {
        // Resolve again without endpoints to tell which one was meant.
        const r = resolveInput(text, { ...ctx, start: '', end: '' });
        const id = r.type === 'accept' ? r.id : r.type === 'suggest' ? r.highlight : undefined;
        return id === end ? "That's your end" : "That's your start";
      }
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const r = resolveInput(text, ctx);
    if (r.type === 'accept') return accept(r.id);
    if (r.type === 'suggest') {
      if (r.highlight) return accept(r.highlight);
      setMessage(`Did you mean ${r.ids.map(regionName).join(' or ')}?`);
      return;
    }
    setMessage(rejectMessage(r.reason));
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="Suggestions">
          {chips.map((id) => (
            <button
              type="button"
              key={id}
              onClick={() => accept(id)}
              className={`min-h-9 rounded-full border px-3 py-1 text-sm ${
                id === highlight ? 'border-teal-700 bg-teal-700 text-white' : 'border-slate-300 bg-white text-slate-800'
              }`}
            >
              {regionName(id)}
              {id === highlight && <span aria-label=" — press Enter"> ↵</span>}
            </button>
          ))}
        </div>
      )}
      <p role="status" aria-live="polite" className="min-h-5 text-sm text-rose-700">
        {message}
      </p>
      <div className="flex gap-2">
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
          autoFocus
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="go"
          maxLength={80}
          placeholder="Type a state…"
          className="min-w-0 flex-1 rounded-lg border border-slate-400 bg-white px-3 py-2 text-base"
        />
        <button type="submit" className="rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white">
          Enter
        </button>
      </div>
    </form>
  );
}
