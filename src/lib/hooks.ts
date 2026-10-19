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
 * How far to lift the input bar so it sits right on top of the on-screen keyboard: the app's bottom
 * edge minus the visual viewport's bottom (offsetTop + height); 0 when the keyboard is closed. Only
 * the input bar uses this: the layout never reads the visual viewport, so nothing else moves or
 * resizes. On every visual-viewport resize and every blur the page is scrolled back to the top, so iOS
 * can't leave it shifted.
 */
export function useKeyboardLift(): number {
  const [lift, setLift] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    const top = () => window.scrollTo(0, 0);
    const on = () => {
      top();
      if (!vv) return;
      const bottom = document.getElementById('root')?.getBoundingClientRect().bottom ?? window.innerHeight;
      const covered = Math.round(bottom - (vv.offsetTop + vv.height));
      setLift(covered > 60 ? covered : 0); // small toolbar changes are not a keyboard
    };
    const blur = () => {
      top();
      requestAnimationFrame(top); // again after iOS has finished closing the keyboard
    };
    on();
    vv?.addEventListener('resize', on);
    vv?.addEventListener('scroll', on);
    document.addEventListener('focusout', blur);
    return () => {
      vv?.removeEventListener('resize', on);
      vv?.removeEventListener('scroll', on);
      document.removeEventListener('focusout', blur);
    };
  }, []);
  return lift;
}
