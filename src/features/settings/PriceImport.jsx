import { useState } from "react";
import { readPriceFile, applyPrices } from "../../lib/applyPrices";
import { card, hdr, btn } from "../../styles";

// Settings ▸ Ingredient Prices: load a vendor price file onto inventory.
//
// The file is just {sku: price} — the catalog in lib/products.js already knows
// each ingredient's product and pack size, so the import only has to supply the
// numbers. Prices never live in the repo (vendor lists are confidential and the
// repo is public), so this is how they reach the private database in the first
// place.
//
// This is also the price-list uploader in miniature: pick a file, parse it in
// the browser, write the result to the database. A PDF parser can later be
// dropped in front of applyPrices() without changing anything downstream.

export default function PriceImport({ malts, setMalts, hops, setHops, yeast, setYeast, adj, setAdj }) {
  const [result, setResult] = useState(null);

  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let parsed;
      try {
        parsed = JSON.parse(String(reader.result));
      } catch {
        setResult({ ok: false, msg: "That file isn't valid JSON." });
        return;
      }
      const priceBySku = readPriceFile(parsed);
      const count = Object.keys(priceBySku).length;
      if (!count) {
        setResult({ ok: false, msg: "No prices found in that file. Expected {\"sku\": price} or {\"prices\": {...}}." });
        return;
      }
      const next = applyPrices({ malts, hops, yeast, adj }, priceBySku);
      setMalts(next.malts);
      setHops(next.hops);
      setYeast(next.yeast);
      setAdj(next.adj);
      setResult({
        ok: true,
        msg: `Loaded ${count} price${count === 1 ? "" : "s"}. ${next.priced} ingredient${next.priced === 1 ? "" : "s"} priced`
          + (next.skipped ? `, ${next.skipped} still unpriced.` : "."),
      });
    };
    reader.onerror = () => setResult({ ok: false, msg: "Couldn't read that file." });
    reader.readAsText(file);
  };

  return (
    <div style={card}>
      <div style={hdr}>💲 Ingredient Prices</div>
      <div style={{ padding: 16 }}>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "#64748b" }}>
          Load a price file to set what each ingredient costs. Prices are shared across the
          brewery and drive the per-batch cost on <strong>Recipes ▸ Cost</strong>, where you can
          also edit any one of them by hand. Importing a partial list only updates the
          ingredients it covers — it won't clear prices you've already set.
        </p>
        <label style={{ ...btn, borderColor: "#f59e0b", color: "#92400e", display: "inline-block" }}>
          Import prices (JSON)
          <input type="file" accept="application/json,.json" onChange={onFile} style={{ display: "none" }} />
        </label>
        {result && (
          <p style={{ margin: "12px 0 0", fontSize: 13, color: result.ok ? "#166534" : "#b91c1c" }}>
            {result.msg}
          </p>
        )}
      </div>
    </div>
  );
}
