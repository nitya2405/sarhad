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
 * --app-h = the tallest window.innerHeight seen at this width (starts over on rotation). Never the
 * visual viewport: the keyboard must not shrink the layout (the game slides up instead, useKeyboardInset).
 */
export function useAppHeight(): void {
  useEffect(() => {
    let width = window.innerWidth;
    let tallest = 0;
    const set = () => {
      if (window.innerWidth !== width) {
        width = window.innerWidth;
        tallest = 0;
      }
      tallest = Math.max(tallest, window.innerHeight);
      document.documentElement.style.setProperty('--app-h', `${tallest}px`);
    };
    set();
    window.addEventListener('resize', set);
    return () => window.removeEventListener('resize', set);
  }, []);
}

/**
 * How far the on-screen keyboard covers the app column: the column's bottom minus the bottom of the
 * visual viewport. 0 when closed (small toolbar changes are ignored).
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const on = () => {
      const bottom = document.getElementById('root')?.getBoundingClientRect().bottom ?? window.innerHeight;
      const covered = Math.round(bottom - (vv.offsetTop + vv.height));
      setInset(covered > 80 ? covered : 0);
      if (window.scrollY !== 0) window.scrollTo(0, 0); // iOS may scroll the page to the input
    };
    on();
    vv.addEventListener('resize', on);
    vv.addEventListener('scroll', on);
    return () => {
      vv.removeEventListener('resize', on);
      vv.removeEventListener('scroll', on);
    };
  }, []);
  return inset;
}
