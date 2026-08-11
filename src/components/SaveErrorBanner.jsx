import { useSyncExternalStore, useState } from "react";
import { subscribe, getFailures } from "../lib/saveStatus";

// One banner for every failed write, wherever it came from. See lib/saveStatus
// for why failures need to reach the screen at all.

// Persistence keys are internal names; say what the brewer would call it.
const LABELS = {
  malts: "Malt inventory",
  hops: "Hop inventory",
  yeast: "Yeast inventory",
  adj: "Adjunct inventory",
  recipes: "Recipes",
  orders: "Order selection",
  settings: "Settings",
  selR: "Selected recipe",
  tab: "Selected tab",
};

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

function Row({ failure }) {
  const [busy, setBusy] = useState(false);
  const label = LABELS[failure.key] ?? failure.key;

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

export default function SaveErrorBanner() {
  const failures = useSyncExternalStore(subscribe, getFailures, getFailures);
  if (!failures.length) return null;
  return failures.map((f) => <Row key={f.key} failure={f} />);
}
