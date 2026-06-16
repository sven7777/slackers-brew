// localStorage persistence. All keys are namespaced with SK and JSON-encoded.
// Reads fall back to a default; writes silently ignore failures (quota,
// private-mode) so the UI never breaks on a storage error.

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
