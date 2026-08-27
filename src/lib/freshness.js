// Is what's on screen still what's in the database?
//
// The app reads each key once, on mount, and never looks again — no polling, no
// realtime subscription. That's fine for a page you open and use, and wrong for
// a tab left open since yesterday: on 2026-08-27 a tab predating an import was
// still offering the old recipe list, and the two imported recipes looked lost.
//
// So: when the tab comes back to the foreground, ask the backend which keys have
// moved (repo.staleKeys) and let a banner say so. Checking on FOCUS rather than
// on a timer is deliberate — a background tab nobody is reading doesn't need to
// know, and the moment someone turns back to it is exactly when a wrong list
// starts being dangerous.
//
// It reports; it does not refetch. Silently swapping the data under an open
// editor would throw away whatever is half-typed, and a brewer who just entered
// a schedule would watch it vanish "because the app updated". Reloading is the
// user's call.
//
// Module-level store, same shape as saveStatus.js and for the same reason: many
// producers, one banner, no context threading.

import { staleKeys } from "./repo";

let stale = [];
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Stable identity while the contents are unchanged, so useSyncExternalStore
// doesn't re-render on every check.
export function getStale() {
  return stale;
}

const setStale = (next) => {
  if (next.length === stale.length && next.every((k, i) => k === stale[i])) return;
  stale = next;
  emit();
};

let checking = false;

// One check. Concurrent calls collapse (focus and visibilitychange both fire on
// the same tab switch), and a failed check is ignored rather than surfaced —
// this is a nicety running in the background, and an error banner about the
// freshness check itself would be noise on top of whatever really broke.
export async function checkFreshness() {
  if (checking) return stale;
  checking = true;
  try {
    setStale(await staleKeys());
  } catch {
    /* offline, or the backend has no version table yet — say nothing */
  } finally {
    checking = false;
  }
  return stale;
}

// Wire the check to the tab coming back into view. Returns an unsubscribe
// function, so a caller can hand it straight to useEffect.
export function watchFreshness() {
  if (typeof document === "undefined") return () => {};
  // Two different signals, and only one of them needs the visibility test.
  // `visibilitychange` fires on the way OUT as well as the way in, so it has to
  // ask which way; a window `focus` already means the person is here, and
  // gating it on document.hidden only manages to skip the check in contexts
  // that report hidden regardless (an automated tab does).
  const check = () => { checkFreshness(); };
  const onVisible = () => { if (!document.hidden) check(); };
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", check);
  return () => {
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("focus", check);
  };
}

// Tests only — resets module state between cases.
export function resetFreshness() {
  stale = [];
  checking = false;
  emit();
}
