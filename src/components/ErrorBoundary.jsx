import { Component } from "react";
import { btn } from "../styles";

// Catches render crashes so a bad value degrades into a message instead of a
// blank page. Three white screens have shipped so far (a missing recipe array,
// a column the prod DB didn't have yet, a stale selR indexing past the end of
// the list) and each one was a *different* unguarded read — so the guard has
// to be generic rather than another targeted null check.
//
// Must be a class: React exposes error catching only through the class
// lifecycle, with no hook equivalent.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Unhandled UI error", error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        role="alert"
        style={{
          background: "#fff",
          border: "1px solid #fecaca",
          borderRadius: 8,
          padding: 20,
          textAlign: "center",
          color: "#1e293b",
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
          Something went wrong here.
        </div>
        <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 4px" }}>
          {this.props.hint ?? "The rest of the app still works — try another tab."}
        </p>
        <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 14px" }}>
          Your saved data hasn&rsquo;t been touched.
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <button style={btn} onClick={() => this.setState({ error: null })}>
            Try again
          </button>
          <button style={btn} onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
        <details style={{ marginTop: 14, fontSize: 12, color: "#94a3b8" }}>
          <summary style={{ cursor: "pointer" }}>Error details</summary>
          <pre
            style={{
              textAlign: "left",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              margin: "8px 0 0",
              fontSize: 11,
            }}
          >
            {String(error?.stack || error)}
          </pre>
        </details>
      </div>
    );
  }
}
