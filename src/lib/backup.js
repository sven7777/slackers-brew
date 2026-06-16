// Backup export/import: serialize all persisted app state to a portable JSON
// object and restore from one. Keeps the download/upload UI thin (DataBackup.jsx)
// and the logic here pure and testable. This also becomes the migration tool
// when we move to a hosted backend.

import { SK } from "./storage";

export const BACKUP_VERSION = 1;
const APP_ID = "slackers-brew";

// List the localStorage keys this app owns (the SK-prefixed ones).
function appKeys() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(SK)) keys.push(k);
  }
  return keys;
}

// Build a backup object from current localStorage. Values are parsed to real
// JSON so the file is human-readable; unparseable values are kept as-is.
export function buildBackup(now = new Date()) {
  const data = {};
  for (const k of appKeys()) {
    const raw = localStorage.getItem(k);
    const short = k.slice(SK.length);
    try {
      data[short] = JSON.parse(raw);
    } catch {
      data[short] = raw;
    }
  }
  return { app: APP_ID, version: BACKUP_VERSION, exportedAt: now.toISOString(), data };
}

// Throw a user-friendly Error if `obj` isn't a backup this app can restore.
export function validateBackup(obj) {
  if (!obj || typeof obj !== "object") throw new Error("This file isn't valid JSON.");
  if (obj.app !== APP_ID) throw new Error("This doesn't look like a Slackers Brew backup file.");
  if (obj.version > BACKUP_VERSION) throw new Error("This backup was made by a newer version of the app. Please update first.");
  if (!obj.data || typeof obj.data !== "object") throw new Error("This backup file is missing its data.");
  return true;
}

// Restore a validated backup: clear the app's existing keys, then write the
// backup's values back (re-stringified to match how the app stores them).
export function applyBackup(obj) {
  validateBackup(obj);
  appKeys().forEach(k => localStorage.removeItem(k));
  for (const [short, val] of Object.entries(obj.data)) {
    localStorage.setItem(SK + short, JSON.stringify(val));
  }
}
