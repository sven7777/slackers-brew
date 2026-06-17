import { useState } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabaseClient";
import { useSession } from "./useSession";
import { card, btn, addBtn } from "../../styles";

// Gates the app behind Supabase auth. With no Supabase config (a local checkout
// without .env) it's a pass-through — the app runs on localStorage as before.
// Otherwise: show a loader while the session resolves, a magic-link login when
// signed out, and the app (with a sign-out bar) when signed in.
export default function LoginGate({ children }) {
  if (!isSupabaseConfigured) return children;
  return <Gate>{children}</Gate>;
}

function Gate({ children }) {
  const session = useSession();
  if (session === undefined) return <Centered>Loading…</Centered>;
  if (!session) return <Login />;
  return <SignedIn session={session}>{children}</SignedIn>;
}

function Centered({ children }) {
  return (
    <div style={{ maxWidth: 360, margin: "80px auto", textAlign: "center", color: "#64748b", fontFamily: FONT }}>
      {children}
    </div>
  );
}

function Login() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const [message, setMessage] = useState("");

  async function send(e) {
    e.preventDefault();
    setStatus("sending");
    setMessage("");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      setStatus("error");
      setMessage(error.message);
    } else {
      setStatus("sent");
    }
  }

  async function signInWithGoogle() {
    setMessage("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    // On success the browser redirects to Google, so we only land here on error.
    if (error) {
      setStatus("error");
      setMessage(error.message);
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: "80px auto", padding: "0 16px", fontFamily: FONT }}>
      <h1 style={{ textAlign: "center", color: "#f59e0b", fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
        🍺 Slackers Brewing
      </h1>
      <p style={{ textAlign: "center", color: "#64748b", fontSize: 13, marginTop: 0, marginBottom: 20 }}>
        Sign in to the shared brewery
      </p>

      {status === "sent" ? (
        <div style={{ ...card, padding: 16, textAlign: "center", fontSize: 14, color: "#1e293b" }}>
          Check <strong>{email}</strong> for a login link.
          <div style={{ marginTop: 10 }}>
            <button style={btn} onClick={() => setStatus("idle")}>Use a different email</button>
          </div>
        </div>
      ) : (
        <div style={{ ...card, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            type="button"
            onClick={signInWithGoogle}
            style={{ ...btn, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "8px 12px", fontSize: 14, fontWeight: 600 }}
          >
            <GoogleG />
            Continue with Google
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#94a3b8", fontSize: 11 }}>
            <span style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
            or
            <span style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
          </div>
          <form onSubmit={send} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            type="email"
            required
            autoFocus
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 14, background: "#fff", color: "#1e293b" }}
          />
          <button type="submit" disabled={status === "sending"} style={{ ...addBtn, padding: "8px 12px", fontSize: 14 }}>
            {status === "sending" ? "Sending…" : "Send magic link"}
          </button>
          </form>
          {status === "error" && (
            <p style={{ color: "#ef4444", fontSize: 12, margin: 0 }}>{message}</p>
          )}
          <p style={{ color: "#94a3b8", fontSize: 11, margin: 0, textAlign: "center" }}>
            Access is invite-only. If your email isn't on the list, the link won't grant entry.
          </p>
        </div>
      )}
    </div>
  );
}

function SignedIn({ session, children }) {
  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, padding: "6px 16px", fontSize: 12, color: "#64748b", fontFamily: FONT }}>
        <span>{session.user.email}</span>
        <button style={btn} onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
      {children}
    </>
  );
}

// Google "G" mark, official four-color logo as inline SVG (no asset dependency).
function GoogleG() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

const FONT = "-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif";
