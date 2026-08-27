import { useEffect, useMemo, useState } from "react";
import { load as loadKey } from "../lib/repo";
import { searchCatalog, catalogCounts, bucketOf } from "../lib/catalogSearch";
import { ADOPT_CATEGORIES, categoryLabels, packLabel, packSiblings } from "../lib/adopt";
import AdoptDialog from "./AdoptDialog";
import { btn, inp } from "../styles";

// Enough rows to browse, few enough to stay a list rather than a document. The
// catalog is 563 products; scrolling all of them is not how anyone finds one,
// so past this the panel says how many more there are and asks for a better
// search. (It also keeps the DOM small — one button per row is not free.)
const LIMIT = 60;

const overlay = {
  position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", zIndex: 50,
  display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "6vh 16px",
};
const panel = {
  background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", width: "100%", maxWidth: 620,
  maxHeight: "84vh", display: "flex", flexDirection: "column", overflow: "hidden",
  boxShadow: "0 20px 50px rgba(15,23,42,0.25)",
};
const head = {
  padding: "12px 14px", borderBottom: "1px solid #e2e8f0", background: "#f1f5f9",
  display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
};
const body = { padding: 14, overflowY: "auto" };
const chip = (on) => ({
  padding: "3px 10px", fontSize: 12, borderRadius: 12, cursor: "pointer", fontWeight: 600,
  border: `1px solid ${on ? "#f59e0b" : "#e2e8f0"}`, background: on ? "#fef3c7" : "#fff",
  color: on ? "#92400e" : "#64748b",
});
const resultRow = {
  display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
  padding: "7px 2px", borderBottom: "1px solid #f1f5f9",
};

const bucketLabels = { ...categoryLabels, unsorted: "Unsorted", other: "Other" };

// Browse everything the vendor sells, and adopt one of them onto the shelf.
//
// The catalog is loaded HERE rather than in App.jsx state: it is hundreds of
// rows that only this panel and the price import ever need, and a list that
// changes about once a month is not worth a query on every page load. It still
// goes through repo.load, so it is the same stored key with the same staleness
// guard as everything else.
//
// `category` locks the browser to one kind of ingredient — the recipe Edit
// tables open it that way, since "add a malt" is already an answer to the
// category question.
// Mounted only while open, so every state below starts fresh — a search left
// behind from last time is not a state to restore, it is a stale one to clear.
export default function CatalogBrowser({ open, ...props }) {
  return open ? <Browser {...props} /> : null;
}

function Browser({ category = null, inventory = {}, addLabel, onAdopt, onClose }) {
  const [entries, setEntries] = useState(null);   // null = still loading
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [bucket, setBucket] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [picked, setPicked] = useState(null);

  // The catalog is fetched on open, not held in App state: hundreds of rows
  // that only this panel and the price import ever need. repo.load is
  // synchronous on localStorage and a network call on Supabase, hence the
  // Promise.resolve.
  useEffect(() => {
    let alive = true;
    Promise.resolve(loadKey("catalog", []))
      .then((v) => { if (alive) setEntries(Array.isArray(v) ? v : []); })
      .catch((e) => { if (alive) { setEntries([]); setError(e?.message || "couldn't be loaded"); } });
    return () => { alive = false; };
  }, []);

  const counts = useMemo(() => catalogCounts(entries ?? []), [entries]);
  const results = useMemo(
    () => searchCatalog(entries ?? [], { query, category: bucket, lockedTo: category, showAll }),
    [entries, query, bucket, category, showAll],
  );

  const shown = results.slice(0, LIMIT);
  // Locked to one table: that bucket and the unsorted pile, which is where
  // every hop and adjunct on a BSG list actually lives.
  const buckets = category ? [category, "unsorted"] : [...ADOPT_CATEGORIES, "unsorted", ...(showAll ? ["other"] : [])];

  return (
    <div style={overlay} role="dialog" aria-modal="true" aria-label="Vendor catalog"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={panel}>
        <div style={head}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            {picked ? "Add to your ingredients" : "Vendor catalog"}
            {!picked && category && <span style={{ fontWeight: 400, color: "#64748b" }}> · {categoryLabels[category]}s</span>}
          </div>
          <button type="button" style={btn} onClick={onClose} aria-label="Close">Close</button>
        </div>

        <div style={body}>
          {picked ? (
            <>
              <button type="button" style={{ ...btn, marginBottom: 12 }} onClick={() => setPicked(null)}>← Back to search</button>
              <AdoptDialog
                entry={picked}
                siblings={packSiblings(entries ?? [], picked)}
                inventory={inventory}
                lockedCategory={category}
                addLabel={addLabel}
                onAdopt={onAdopt}
                onCancel={() => setPicked(null)}
              />
            </>
          ) : entries === null ? (
            <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>Loading the catalog…</p>
          ) : entries.length === 0 ? (
            <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
              {error
                ? `The catalog ${error}.`
                : "No vendor catalog yet. Upload a price list under Settings ▸ Ingredient Prices and it's ingested along with the prices."}
            </p>
          ) : (
            <>
              <input value={query} onChange={(e) => setQuery(e.target.value)} autoFocus
                placeholder="Search by name, vendor or SKU" aria-label="Search the catalog"
                style={{ ...inp, width: "100%", textAlign: "left", padding: "6px 8px" }} />

              {/* ⚠️ Above the list, not below it. The results scroll and the
                  first sixty of them are a long way down, so a toggle at the
                  bottom is a toggle nobody finds. */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, margin: "10px 0 6px", fontSize: 12, color: "#64748b" }}>
                <span>
                  {results.length > LIMIT
                    ? `Showing ${LIMIT} of ${results.length} — narrow the search.`
                    : `${results.length} of ${counts.total} products.`}
                </span>
                {!category && (
                  <button type="button" style={btn}
                    onClick={() => { if (showAll && bucket === "other") setBucket(null); setShowAll((v) => !v); }}>
                    {showAll ? "Ingredients only" : `Show everything (+${counts.other ?? 0})`}
                  </button>
                )}
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "0 0 10px" }}>
                <button type="button" style={chip(bucket === null)} onClick={() => setBucket(null)}>All</button>
                {buckets.map((b) => (
                  <button key={b} type="button" style={chip(bucket === b)} onClick={() => setBucket(bucket === b ? null : b)}>
                    {bucketLabels[b]} {counts[b] ?? 0}
                  </button>
                ))}
              </div>

              <div>
                {shown.map((e) => (
                  <div key={e.sku} style={resultRow}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13 }}>{e.name}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>
                        {e.vendor ? `${e.vendor} · ` : ""}{e.sku} · {packLabel(e)}
                        {(!category || bucketOf(e) === "unsorted") && ` · ${bucketLabels[bucketOf(e)]}`}
                      </div>
                    </div>
                    <button type="button" style={btn} onClick={() => setPicked(e)}>Add…</button>
                  </div>
                ))}
                {/* Three different nothings, and blaming the wrong one sends a
                    brewer looking in the wrong place: this list carries no hops
                    at all (they are priced off the spot hop list), which is not
                    the same as a search that matched nothing. */}
                {results.length === 0 && (
                  <p style={{ fontSize: 13, color: "#64748b" }}>
                    {query
                      ? <>Nothing matches “{query}”{showAll || bucket ? "" : " — equipment and merchandise are hidden"}.</>
                      : `This catalog has no ${bucketLabels[bucket] ?? "matching"} products. A price list covers one vendor range at a time.`}
                  </p>
                )}
              </div>

            </>
          )}
        </div>
      </div>
    </div>
  );
}
