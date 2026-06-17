import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import LoginGate from './features/auth/LoginGate.jsx'
import { isSupabaseConfigured, supabase } from './lib/supabaseClient'
import { setBackend } from './lib/repo'
import { createSupabaseBackend } from './lib/supabaseBackend'

// When Supabase is configured, route all persistence through it. The app only
// mounts behind LoginGate (i.e. once a session exists), so the RLS-protected
// queries always run authenticated. Without config, this is a no-op and the
// app stays on the default localStorage backend.
if (isSupabaseConfigured) {
  setBackend(createSupabaseBackend(supabase))
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LoginGate>
      <App />
    </LoginGate>
  </React.StrictMode>,
)
