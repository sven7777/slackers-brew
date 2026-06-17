import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";

// Tracks the Supabase auth session and keeps it live.
//   undefined -> still checking (initial load / magic-link round-trip)
//   null      -> signed out
//   object    -> signed in
export function useSession() {
  // undefined while checking; null immediately if there's no client to check.
  const [session, setSession] = useState(supabase ? undefined : null);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session ?? null);
    });
    // Fires on sign-in (incl. returning from the magic link), sign-out, and
    // token refresh.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return session;
}
