import { useSyncExternalStore } from "react";
import { subscribe, getStale } from "../lib/freshness";
import { labelList } from "../lib/keyLabels";

// "This page is out of date." Shown when another tab or another brewer has
// changed data this page is displaying — see lib/freshness.js for how that's
// detected and why the fix is a banner rather than a silent refetch.
//
// Amber, not red: nothing is broken and nothing is lost. What's on screen is
// simply old, and the next save from this page will be refused rather than
// allowed to overwrite the newer data (migration 0014).

const wrap = {
  background: "#fffbeb",
  border: "1px solid #fcd34d",
  borderRadius: 8,
  padding: "10px 14px",
  marginBottom: 16,
  fontSize: 13,
  color: "#92400e",
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const reloadBtn = {
  padding: "5px 12px",
  fontSize: 12,
  fontWeight: 600,
  border: "1px solid #f59e0b",
  borderRadius: 6,
  background: "#fff",
  color: "#92400e",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

export default function StaleDataBanner({ onReload = () => window.location.reload() }) {
  const stale = useSyncExternalStore(subscribe, getStale, getStale);
  if (!stale.length) return null;

  return (
    <div style={wrap} role="status">
      <div style={{ flex: 1 }}>
        <strong>This page is out of date.</strong>{" "}
        {labelList(stale)} changed somewhere else — another tab, or another brewer — after
        this page loaded. Reload to see the latest.
      </div>
      <button style={reloadBtn} onClick={onReload}>Reload</button>
    </div>
  );
}
