// The Supabase client, built from the frontend env vars (see .env.example).
//
// The anon key is safe to ship in the bundle — row-level security (see
// supabase/schema.sql) is what actually protects the data. If the env vars are
// absent (e.g. a local checkout with no .env), `supabase` is null and the app
// stays on the default localStorage backend; nothing here throws at import.

import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured ? createClient(url, anonKey) : null;
