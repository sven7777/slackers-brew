// Where failed writes go so they can reach the screen.
//
// A save that fails is invisible from the brewer's side: the edit stays in
// React state, so the row still shows the new value and everything looks
// stored — until a refresh, when it's gone. That's worse than an error. It's
// also a live risk rather than a theoretical one: migration 0006 put a unique
// index on `recipes.ord` specifically so a cross-client save race would fail
// instead of silently duplicating the catalog, which means the app now has a
// real way to reject a write.
//
// Module-level rather than context: the producer is a hook used in eight
// places and the consumer is one banner, so a store keeps that wiring flat
// instead of threading state through every tab.

let failures = []; // [{ key, error, retry }] — at most one entry per key
const listeners = new Set();

const emit = () => listeners.forEach((l) => l());

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Identity only changes when the contents change, so useSyncExternalStore
// doesn't re-render on every save.
export function getFailures() {
  return failures;
}

// Newest failure per key wins — a key with a pending failure that fails again
// should report the latest error, not stack up duplicates.
export function reportFailure(key, error, retry) {
  failures = [...failures.filter((f) => f.key !== key), { key, error, retry }];
  emit();
}

export function clearFailure(key) {
  if (!failures.some((f) => f.key === key)) return; // keep identity stable
  failures = failures.filter((f) => f.key !== key);
  emit();
}

// Tests only — resets module state between cases.
export function resetFailures() {
  failures = [];
  emit();
}
