// Data-access layer: the single seam between the app and wherever data lives.
//
// The app (via usePersistentState) reads and writes through repo.load/save and
// never imports the storage backend directly. Today the backend is
// localStorage; when we move to Supabase, only this module changes — call
// setBackend(supabaseBackend) once and every persisted value follows.
//
// A backend is any object implementing the persistence contract:
//   load(key, fallback) -> value   // return fallback if absent/unreadable
//   save(key, value)     -> void    // persist, swallowing recoverable failures
//
// NOTE: this contract is synchronous because localStorage is. The Supabase
// backend will be async (network), which is a behavior change — that's the
// point at which usePersistentState gains loading/error state. Keeping the
// seam here means that change stays contained to the hook + this module.

import { localStorageBackend } from "./storage";

let backend = localStorageBackend;

// Swap the active backend (Supabase later; a fake in tests).
export function setBackend(b) {
  backend = b;
}

// Restore the default localStorage backend (used by tests for isolation).
export function resetBackend() {
  backend = localStorageBackend;
}

// The active backend, for callers that need to inspect or wrap it.
export function getBackend() {
  return backend;
}

export function load(key, fallback) {
  return backend.load(key, fallback);
}

export function save(key, value) {
  return backend.save(key, value);
}
