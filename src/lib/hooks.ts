import { useEffect, useState } from 'react';
import { istDate, nextIstMidnight } from '@engine/index.ts';

/** Re-renders every `ms` and returns Date.now(). */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/** Today's IST date; flips at IST midnight without a reload. */
export function useToday(): string {
  const [today, setToday] = useState(() => istDate(Date.now()));
  useEffect(() => {
    const id = setTimeout(() => setToday(istDate(Date.now())), nextIstMidnight(Date.now()) - Date.now() + 500);
    return () => clearTimeout(id);
  }, [today]);
  return today;
}

/** navigator.onLine, kept current via online/offline events. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false);
  useEffect(() => {
    const on = () => setOnline(navigator.onLine !== false);
    window.addEventListener('online', on);
    window.addEventListener('offline', on);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', on);
    };
  }, []);
  return online;
}

export function useReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(() => typeof matchMedia === 'function' && matchMedia(query).matches);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia(query);
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

/**
 * Keeps --app-h equal to the visible viewport height, so the input stays pinned just above
 * the on-screen keyboard (iOS Safari does not resize the layout viewport).
 */
export function useAppHeight(): void {
  useEffect(() => {
    const vv = window.visualViewport;
    const set = () => {
      document.documentElement.style.setProperty('--app-h', `${vv ? vv.height : window.innerHeight}px`);
      if (vv && vv.offsetTop > 0) window.scrollTo(0, 0);
    };
    set();
    vv?.addEventListener('resize', set);
    window.addEventListener('resize', set);
    return () => {
      vv?.removeEventListener('resize', set);
      window.removeEventListener('resize', set);
    };
  }, []);
}
