import { useState, useEffect, useRef } from "react";
import { load, save } from "../lib/repo";

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
      ? { val: fbVal(), loading: true, error: null, pending: result }
      : { val: result, loading: false, error: null, pending: null };
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
  const skipSave = useRef(true);
  useEffect(() => {
    if (state.loading || state.error) return;
    if (skipSave.current) { skipSave.current = false; return; }
    save(key, state.val);
  }, [key, state.val, state.loading, state.error]);

  const setVal = (updater) =>
    setState((s) => ({
      ...s,
      val: typeof updater === "function" ? updater(s.val) : updater,
    }));

  return [state.val, setVal, { loading: state.loading, error: state.error }];
}
