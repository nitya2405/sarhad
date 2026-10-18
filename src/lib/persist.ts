// Keeping a player's data: ask for persistent storage once, and tell iPhone players to install.

const ASKED = 'sarhad:persist-asked';
const TIP = 'sarhad:install-tip';

/** After the first finished game: navigator.storage.persist(), once per device. Failures are ignored. */
export function requestPersistOnce(): void {
  try {
    if (localStorage.getItem(ASKED)) return;
    localStorage.setItem(ASKED, '1');
  } catch {
    return; // storage blocked: nothing to keep anyway
  }
  try {
    void navigator.storage?.persist?.().catch(() => false);
  } catch {
    /* not supported */
  }
}

/**
 * iOS Safari, not installed: Safari deletes a site's storage after 7 days without a visit unless it
 * runs from the Home Screen, so the streak would be lost.
 */
export function showInstallTip(): boolean {
  if (typeof navigator === 'undefined') return false;
  try {
    if (localStorage.getItem(TIP) === 'dismissed') return false;
  } catch {
    /* show it */
  }
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const safari = !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  const standalone =
    (navigator as { standalone?: boolean }).standalone === true ||
    (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches);
  return ios && safari && !standalone;
}

export function dismissInstallTip(): void {
  try {
    localStorage.setItem(TIP, 'dismissed');
  } catch {
    /* hides for this visit only */
  }
}
