import { useState, useEffect, useRef } from "react";
import { load, save } from "../lib/repo";
import { reportFailure, clearFailure } from "../lib/saveStatus";

// Run one save attempt at the end of the key's chain. Retries go through here
// too, so a retry can never run alongside a queued save — that overlap is the
// exact shape of the 2026-07-14 incident described below. Always writes
// `q.next` (the newest value), so a retry after further edits stores the
// current state rather than resurrecting the value that failed.
const flush = (key, q) => {
  q.chain = q.chain.then(async () => {
    if (!q.dirty) return; // a later link already saved a newer value
    q.dirty = false;
    try {
      await save(key, q.next);
      clearFailure(key);
    } catch (e) {
      console.error(`Failed to save "${key}"`, e);
      reportFailure(key, e, () => {
        q.dirty = true;
        return flush(key, q);
      });
    }
  });
  return q.chain;
};

// How long a burst of typing is allowed to settle before it is written, and the
// longest a pending edit may sit unwritten however fast the keys keep coming.
//
// A save on the async backend is a whole-list delete-then-insert, and between
// the two the table is EMPTY — so every keystroke firing one is not just
// wasteful, it is a loss window. Typing "4250" into a hop weight rewrote all 18
// recipes four times, each with a moment where the catalog did not exist. Every
// input in the app is onChange, and coalescing only happens while a save is
// already in flight, so nothing collapsed those four.
//
// The idle wait is what removes the per-keystroke writes; the cap is what stops
// continuous typing from deferring a write indefinitely. Both are bounded by
// the flush-on-hide/unmount below, which is what keeps a debounce from simply
// trading one loss window for another.
export const SAVE_DEBOUNCE_MS = 500;
export const SAVE_MAX_WAIT_MS = 2000;

const cancel = (q) => {
  if (q.timer == null) return;
  clearTimeout(q.timer);
  q.timer = null;
};

// Write whatever is pending right now, cancelling the debounce. Used wherever
// waiting is no longer safe: unmount, and the page going away.
const flushNow = (key, q) => {
  cancel(q);
  q.since = null;
  return flush(key, q);
};

// Restart the idle timer, but never push the write past SAVE_MAX_WAIT_MS from
// the first edit of this burst.
const schedule = (key, q) => {
  if (q.since == null) q.since = Date.now();
  cancel(q);
  const wait = Math.max(0, Math.min(SAVE_DEBOUNCE_MS, q.since + SAVE_MAX_WAIT_MS - Date.now()));
  q.timer = setTimeout(() => {
    q.timer = null;
    q.since = null;
    flush(key, q);
  }, wait);
};

// useState that hydrates from the data-access layer and persists on every
// change. `fallback` may be a value or a factory function (use a factory for
// defaults that must be freshly cloned per load, e.g. preset recipes).
//
// The backend may be synchronous (localStorage) or asynchronous (Supabase):
//   - Sync: load returns the value directly. We hydrate in the initializer, so
//     there is no loading flash — behavior identical to before.
//   - Async: load returns a Promise. We start from the fallback with
//     loading=true and fill in when it resolves; a failed load sets `error` and
//     suppresses persistence so we never write the fallback over real data.
//     Its saves are also DEBOUNCED (see SAVE_DEBOUNCE_MS) — the sync path's are
//     not.
//
// Returns [value, setValue, { loading, error }]. The third element is optional
// for callers that don't need it.
export function usePersistentState(key, fallback) {
  const fbVal = () => (typeof fallback === "function" ? fallback() : fallback);

  // Read once. A Promise means an async backend; we stash it in state (not a
  // ref — refs can't be written during render) and resolve it in the effect.
  const [state, setState] = useState(() => {
    const result = load(key, fbVal());
    return result instanceof Promise
      ? { val: fbVal(), loading: true, error: null, pending: result, async: true }
      : { val: result, loading: false, error: null, pending: null, async: false };
  });

  // Resolve an async initial load. No-op on the sync path (pending is null).
  useEffect(() => {
    if (!state.pending) return;
    let cancelled = false;
    state.pending.then(
      (v) => !cancelled && setState((s) => ({ ...s, val: v, loading: false, pending: null })),
      (e) => !cancelled && setState((s) => ({ ...s, loading: false, error: e, pending: null }))
    );
    return () => { cancelled = true; };
  }, [state.pending]);

  // Persist on change. Skip while a load is still in flight or errored (don't
  // clobber stored data with the fallback), and skip the first settled run so
  // the freshly-hydrated value isn't written straight back.
  //
  // Saves are chained, never concurrent: an async backend save is a
  // delete-then-insert, so two overlapping saves can interleave their phases
  // and duplicate every row (2026-07-14 incident: two saves 17 ms apart
  // doubled the recipe catalog). Each save waits for the previous one, and
  // queued-up changes coalesce so only the newest value is written. A failed
  // save is reported to lib/saveStatus (and surfaced by SaveErrorBanner) —
  // silently dropping it would leave an unsaved edit looking saved on screen.
  //
  // Only the ASYNC path is debounced, and the load's own return type is what
  // says which one this is — the same signal the hydration branch above reads.
  // A localStorage save is one synchronous setItem that cannot half-write and
  // cannot fail, so delaying it would buy nothing and cost the guarantee that
  // the local path stays synchronous.
  const skipSave = useRef(true);
  const queue = useRef({ chain: Promise.resolve(), next: null, dirty: false, timer: null, since: null });
  useEffect(() => {
    if (state.loading || state.error) return;
    if (skipSave.current) { skipSave.current = false; return; }
    const q = queue.current;
    q.next = state.val;
    q.dirty = true;
    if (state.async) schedule(key, q); else flush(key, q);
  }, [key, state.async, state.val, state.loading, state.error]);

  // A debounced write that is never written is just a slower way to lose the
  // edit, so anything that ends this component's life writes what is pending
  // first: unmount, and the page being hidden or closed.
  //
  // ⚠️ Be honest about what this can and can't do. On a tab SWITCH the page
  // keeps running and the write finishes normally. On an actual close the
  // handler can only START the request — no handler can await one — so up to
  // SAVE_DEBOUNCE_MS of typing can still be lost if the browser kills it. That
  // is the debounce's one cost, and it is worth paying: the write it might lose
  // is one the database now either applies whole or not at all (migration
  // 0018), where the un-debounced version being interrupted could leave the
  // table EMPTY. Losing half a second of typing beats losing the catalog.
  useEffect(() => {
    const q = queue.current;
    const flushPending = () => { if (q.dirty) flushNow(key, q); };
    const onHidden = () => { if (document.visibilityState === "hidden") flushPending(); };
    window.addEventListener("pagehide", flushPending);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("pagehide", flushPending);
      document.removeEventListener("visibilitychange", onHidden);
      flushPending();
    };
  }, [key]);

  const setVal = (updater) =>
    setState((s) => ({
      ...s,
      val: typeof updater === "function" ? updater(s.val) : updater,
    }));

  return [state.val, setVal, { loading: state.loading, error: state.error }];
}
