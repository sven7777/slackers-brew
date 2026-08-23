import { useState } from "react";
import { readPriceFile } from "../../lib/applyPrices";
import { priceChanges } from "../../lib/priceChanges";
import { parsePriceList } from "../../lib/parsePriceList";
import PriceReview from "./PriceReview";
import { card, hdr, btn } from "../../styles";

// Settings ▸ Ingredient Prices: load vendor pricing onto inventory.
//
// Two sources, one path. A hand-built JSON file ({sku: price}) and the vendor's
// own PDF price list both reduce to the same {sku: {price}} map, which
// priceChanges() turns into a change set, which the brewer confirms before
// anything is written. The catalog in lib/products.js supplies the rest — each
// ingredient's product, pack size and unit conversion — so an import only ever
// has to supply numbers.
//
// pdf.js is imported dynamically, on the first PDF only: it is far larger than
// the whole app, and nobody should download a PDF parser to edit their inventory.

const dateLabel = (iso) => {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

export default function PriceImport({ malts, setMalts, hops, setHops, yeast, setYeast, adj, setAdj }) {
  const [status, setStatus] = useState(null);   // {ok, msg}
  const [busy, setBusy] = useState(null);       // progress text while parsing
  const [pending, setPending] = useState(null); // {source, result} awaiting confirmation

  const inventory = { malts, hops, yeast, adj };

  const fail = (msg) => { setBusy(null); setPending(null); setStatus({ ok: false, msg }); };

  // A parsed {sku: {price}} map → the change set the review screen shows.
  const propose = (priceBySku, source) => {
    const count = Object.keys(priceBySku).length;
    if (!count) {
      fail("No prices found in that file.");
      return;
    }
    setBusy(null);
    setStatus(null);
    setPending({ source, result: priceChanges(inventory, priceBySku) });
  };

  const readJson = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      let parsed;
      try {
        parsed = JSON.parse(String(reader.result));
      } catch {
        fail("That file isn't valid JSON.");
        return;
      }
      propose(readPriceFile(parsed), { label: file.name });
    };
    reader.onerror = () => fail("Couldn't read that file.");
    reader.readAsText(file);
  };

  const readPdf = async (file) => {
    setBusy("Reading the PDF…");
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      const { extractPdfLines } = await import("../../lib/pdfText");
      const { lines, hasText, pageCount } = await extractPdfLines(data);

      // A PDF printed from a screenshot has no text to extract — every price is
      // just pixels. Say so plainly rather than reporting "0 prices found",
      // which reads like the file was wrong when it's the format that differs.
      if (!hasText) {
        fail(`That PDF has no readable text — its ${pageCount} page${pageCount === 1 ? "" : "s"} are images `
          + "(the BSG spot hop list is like this). Reading those needs the hop-list importer.");
        return;
      }

      const parsed = parsePriceList(lines);
      if (!parsed.count) {
        fail("Couldn't find any priced products in that PDF. Is it a BSG/Rahr price list?");
        return;
      }
      propose(parsed.prices, {
        label: file.name,
        effective: dateLabel(parsed.effective),
        count: parsed.count,
        conflicts: parsed.conflicts,
      });
    } catch (err) {
      fail(`Couldn't read that PDF: ${err?.message || "unknown error"}`);
    }
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setStatus(null);
    setPending(null);
    if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") readPdf(file);
    else readJson(file);
  };

  const apply = () => {
    const { next } = pending.result;
    const n = pending.result.changes.length;
    setMalts(next.malts);
    setHops(next.hops);
    setYeast(next.yeast);
    setAdj(next.adj);
    setPending(null);
    setStatus({ ok: true, msg: `Applied ${n} price change${n === 1 ? "" : "s"}.` });
  };

  return (
    <div style={card}>
      <div style={hdr}>💲 Ingredient Prices</div>
      <div style={{ padding: 16 }}>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "#64748b" }}>
          Upload the vendor's <strong>PDF price list</strong> (or a prepared JSON file) to set what each
          ingredient costs. Prices are shared across the brewery and drive the per-batch cost on{" "}
          <strong>Recipes ▸ Cost</strong>, where you can also edit any one by hand. You'll see exactly what
          would change before anything is saved, and an import only updates the ingredients it covers —
          it won't clear prices you've already set.
        </p>
        <label style={{ ...btn, borderColor: "#f59e0b", color: "#92400e", display: "inline-block",
                        opacity: busy ? 0.6 : 1, cursor: busy ? "wait" : "pointer" }}>
          {busy || "Upload price list (PDF or JSON)"}
          <input type="file" accept="application/pdf,.pdf,application/json,.json"
            onChange={onFile} disabled={!!busy} style={{ display: "none" }} />
        </label>

        {status && (
          <p style={{ margin: "12px 0 0", fontSize: 13, color: status.ok ? "#166534" : "#b91c1c" }}>
            {status.msg}
          </p>
        )}

        {pending && (
          <PriceReview source={pending.source} result={pending.result}
            onApply={apply} onCancel={() => setPending(null)} />
        )}
      </div>
    </div>
  );
}
