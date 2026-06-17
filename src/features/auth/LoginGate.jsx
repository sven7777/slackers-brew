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
        <form onSubmit={send} style={{ ...card, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
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
          {status === "error" && (
            <p style={{ color: "#ef4444", fontSize: 12, margin: 0 }}>{message}</p>
          )}
          <p style={{ color: "#94a3b8", fontSize: 11, margin: 0, textAlign: "center" }}>
            Access is invite-only. If your email isn't on the list, the link won't grant entry.
          </p>
        </form>
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

const FONT = "-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif";
