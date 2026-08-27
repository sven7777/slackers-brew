// localStorage persistence. All keys are namespaced with SK and JSON-encoded.
// Reads fall back to a default; writes silently ignore failures (quota,
// private-mode) so the UI never breaks on a storage error.
//
// These are the *localStorage* primitives. The rest of the app talks to
// persistence through ./repo (the swappable data-access layer), not directly
// to these — so the localStorage→Supabase swap happens in one place.

export const SK = "slackers_brew_";

export function load(k, fb) {
  try {
    const r = localStorage.getItem(SK + k);
    return r ? JSON.parse(r) : fb;
  } catch {
    return fb;
  }
}

export function save(k, v) {
  try {
    localStorage.setItem(SK + k, JSON.stringify(v));
  } catch {
    /* ignore write failures (quota, private mode) */
  }
}

// What this tab last read or wrote for each key, as the raw stored string.
// Two tabs on the same origin share one localStorage, so the stale-tab problem
// exists here too — it's just cheaper to detect: the stored string IS the
// version. Reads are of a few KB from memory-backed storage, on tab focus only.
const seen = new Map();

const raw = (k) => {
  try {
    return localStorage.getItem(SK + k);
  } catch {
    return null;
  }
};

// Tests only — drops this "tab's" memory of what it last read, so one case's
// reads can't make the next case's keys look stale. repo.resetBackend() calls
// it, since restoring the default backend is exactly when that memory should go.
export function resetSeen() {
  seen.clear();
}

// The localStorage implementation of the persistence backend contract
// (see ./repo). This is the default backend.
export const localStorageBackend = {
  load(k, fb) {
    seen.set(k, raw(k));
    return load(k, fb);
  },
  save(k, v) {
    save(k, v);
    seen.set(k, raw(k));
  },
  // Keys another tab has written since this one read them. There is no
  // compare-and-swap on this path: a local save can't fail, and the whole
  // point of the localStorage backend is that it stays synchronous.
  staleKeys() {
    return [...seen.entries()].filter(([k, v]) => raw(k) !== v).map(([k]) => k);
  },
};
