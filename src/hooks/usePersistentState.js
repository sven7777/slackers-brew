import { useState, useEffect } from "react";
import { load, save } from "../lib/repo";

// useState that hydrates from localStorage and persists on every change.
// `fallback` may be a value or a factory function (use a factory for defaults
// that must be freshly cloned per load, e.g. preset recipes).
export function usePersistentState(key, fallback) {
  const [val, setVal] = useState(() => {
    const fb = typeof fallback === "function" ? fallback() : fallback;
    return load(key, fb);
  });
  useEffect(() => { save(key, val); }, [key, val]);
  return [val, setVal];
}
