import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
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
    {/* Outer net for anything above the tab panel — login, the header, a
        failed backend init. App has its own per-tab boundary inside this. */}
    <ErrorBoundary hint="Reload the page to start over.">
      <LoginGate>
        <App />
      </LoginGate>
    </ErrorBoundary>
  </React.StrictMode>,
)
