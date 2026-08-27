import { useSyncExternalStore, useState } from "react";
import { subscribe, getFailures } from "../lib/saveStatus";
import { isStaleWrite } from "../lib/staleWrite";
import { labelFor } from "../lib/keyLabels";

// One banner for every failed write, wherever it came from. See lib/saveStatus
// for why failures need to reach the screen at all.
//
// Two kinds of failure, opposite responses. A write that failed (network,
// database error) offers Retry. A write REFUSED because this page is out of
// date must never offer it: retrying is precisely the act of overwriting
// somebody else's newer data, which is what migration 0014 exists to stop. That
// one offers Reload, and says plainly that the change on screen goes with it —
// an unsaved edit that can't be merged is worth losing, and worth being told
// about, next to two recipes that aren't.

const wrap = {
  background: "#fef2f2",
  border: "1px solid #fecaca",
  borderRadius: 8,
  padding: "10px 14px",
  marginBottom: 16,
  fontSize: 13,
  color: "#7f1d1d",
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const retryBtn = {
  padding: "5px 12px",
  fontSize: 12,
  fontWeight: 600,
  border: "1px solid #ef4444",
  borderRadius: 6,
  background: "#fff",
  color: "#b91c1c",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

function Row({ failure, onReload }) {
  const reload = onReload ?? (() => window.location.reload());
  const [busy, setBusy] = useState(false);
  const label = labelFor(failure.key);
  const stale = isStaleWrite(failure.error);

  const onRetry = async () => {
    setBusy(true);
    // The store clears this row itself if the retry succeeds, and re-reports
    // if it fails again — so there's nothing to do with the result here.
    try {
      await failure.retry();
    } finally {
      setBusy(false);
    }
  };

  if (stale) {
    return (
      <div style={wrap} role="alert">
        <div style={{ flex: 1 }}>
          <strong>{label} wasn&rsquo;t saved &mdash; this page is out of date.</strong>{" "}
          Somebody else changed {label.toLowerCase()} after this page loaded, so your change
          was not written over theirs. Reload to get the latest; the edit you just made will
          be lost, and you can redo it on top.
        </div>
        <button style={retryBtn} onClick={reload}>Reload</button>
      </div>
    );
  }

  return (
    <div style={wrap} role="alert">
      <div style={{ flex: 1 }}>
        <strong>{label} didn&rsquo;t save.</strong>{" "}
        Your change is still on screen but will be lost if you reload.
        {failure.error?.message && (
          <div style={{ marginTop: 2, fontSize: 12, color: "#b91c1c", opacity: 0.85 }}>
            {failure.error.message}
          </div>
        )}
      </div>
      <button style={retryBtn} onClick={onRetry} disabled={busy}>
        {busy ? "Retrying…" : "Retry"}
      </button>
    </div>
  );
}

export default function SaveErrorBanner({ onReload }) {
  const failures = useSyncExternalStore(subscribe, getFailures, getFailures);
  if (!failures.length) return null;
  return failures.map((f) => <Row key={f.key} failure={f} onReload={onReload} />);
}
