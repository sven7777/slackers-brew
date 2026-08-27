import { useState } from "react";
import { productsBySku } from "../../lib/products";
import { costPerUnit } from "../../lib/pricing";
import { btn } from "../../styles";

// Confirmation screen for the spot hop list.
//
// The list arrives two ways and the screen says which: an Excel export is read
// EXACTLY from its text layer, while a scanned one is read off an image by
// tesseract and every digit is a guess. Either way nothing is trusted until a
// person says so, because the risk that matters is not a misread digit — it is a
// price matched to the wrong ROW or the wrong CROP YEAR, and exact text does
// nothing to rule that out.
//
// So the screen is built for checking rather than for accepting: each hop shows
// the row it was matched to, the price found, and — underneath — the actual page
// it came from, so a doubtful number can be compared against the source without
// leaving the app. Every price is editable, and on the scanned path a
// low-confidence read is flagged rather than quietly used.
//
// Prices are entered the way the list quotes them ($/lb) and shown converted to
// what inventory stores ($/oz), because a brewer reading the sheet should never
// have to do that division in their head to check a number.

// Below this, tesseract itself is unsure; the row gets flagged for a look.
const LOW_CONFIDENCE = 80;

const th = { textAlign: "left", fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", padding: "4px 8px", borderBottom: "1px solid #e2e8f0" };
const td = { fontSize: 13, padding: "6px 8px", borderBottom: "1px solid #f1f5f9", color: "#1e293b", verticalAlign: "middle" };
const numTd = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };
const priceInp = { width: 78, textAlign: "right", padding: "4px 6px", fontSize: 13, borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", color: "#1e293b", fontVariantNumeric: "tabular-nums" };
const chip = { fontSize: 11, fontWeight: 700, padding: "1px 6px", borderRadius: 999, border: "1px solid #cbd5e1", background: "#fff", color: "#475569", cursor: "pointer", marginRight: 4 };
const note = { fontSize: 11, color: "#94a3b8" };

const money = (n) => (n == null ? "—" : `$${n.toFixed(2)}`);

// $/lb as typed → $/oz as stored, through the same conversion the rest of the
// app uses, so what this screen previews is exactly what gets saved.
//
// ⚠️ A hop ADOPTED from this list has no row in products.js — its SKU was
// synthesised from the variety (hopCatalog.js) — and looking it up there and
// giving up left the New column blank for exactly the hops this feature exists
// to add. Every row on a spot hop list is quoted per pound, so that is the
// fallback pack: it is what the catalog entry says too, and it is the one thing
// the document guarantees.
const PER_POUND = { packQty: 1, packUnit: "lb" };
const perOunce = (sku, perLb) => {
  if (!Number.isFinite(perLb)) return null;
  const raw = costPerUnit({ ...(productsBySku[sku] ?? PER_POUND), price: perLb }, "oz");
  return raw == null ? null : Math.round(raw * 100) / 100;
};

// What ingesting the rest of the list would do to the vendor catalog.
//
// The table above is the fourteen hops Slackers buys. This is the other
// fifty-odd varieties on the same page — the ones it *could* buy — and it is
// the whole reason the hop list feeds the catalog at all: without it, a hop the
// brewery has never bought can never reach a recipe.
function HopCatalogSummary({ catalog }) {
  const { added, discontinued, counts, next } = catalog;

  return (
    <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #e2e8f0" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
        Hop catalog
      </div>
      <p style={{ margin: "0 0 6px", fontSize: 13, color: "#475569" }}>
        {added.length === 0
          ? `No new varieties — the catalog already lists all ${counts.varieties} on this list.`
          : `${added.length} variet${added.length === 1 ? "y" : "ies"} would be added, for ${next.length} products in total. These are what you can pick from when building a recipe.`}
      </p>

      {discontinued.length > 0 && (
        <p style={{ margin: "0 0 6px", fontSize: 12, color: "#b91c1c", fontWeight: 600 }}>
          ⚠️ {discontinued.length} hop{discontinued.length === 1 ? "" : "s"} you buy{" "}
          {discontinued.length === 1 ? "is" : "are"} not on this list:{" "}
          {discontinued.map((d) => d.name).join(", ")}.{" "}
          {discontinued.length === 1 ? "Its price" : "Their prices"} will stay at the last quote.
        </p>
      )}

      {/* The same honesty the price table keeps: say what was left out and why,
          rather than folding it into a success count. Cryo, Enriched and CO2
          extract are different products at their own money — extract is not even
          quoted per pound — so they are read and then deliberately dropped. */}
      <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
        {counts.varieties} varieties read from {counts.rows} rows
        {counts.unfamiliar > 0 && ` · ${counts.unfamiliar} you don't stock`}
        {counts.unpriced > 0 && ` · ${counts.unpriced} without a clean price`}
        {counts.skippedVariants > 0 && ` · ${counts.skippedVariants} Cryo/extract rows skipped`}
      </p>
    </div>
  );
}

export default function HopPriceReview({ hops, pages, currentByName, effective, source = "ocr", catalog, onApply, onCancel }) {
  const scanned = source !== "text";
  // One editable $/lb per hop, seeded from OCR (blank where it found nothing).
  const [entered, setEntered] = useState(() =>
    Object.fromEntries(hops.map((h) => [h.name, h.price != null ? String(h.price) : ""])));
  const [showPages, setShowPages] = useState(false);

  const set = (name, value) => setEntered((p) => ({ ...p, [name]: value }));

  const rows = hops.map((h) => {
    const perLb = Number(entered[h.name]);
    const to = Number.isFinite(perLb) && perLb > 0 ? perOunce(h.sku, perLb) : null;
    const from = currentByName?.[h.name] ?? null;
    return { ...h, perLb, to, from, changed: to != null && to !== from };
  });
  const changes = rows.filter((r) => r.changed);

  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 14, marginTop: 12, background: "#f8fafc" }}>
      <div style={{ marginBottom: 6 }}>
        <strong style={{ fontSize: 14 }}>Spot hop list</strong>
        {effective && <span style={{ ...note, marginLeft: 8 }}>dated {effective}</span>}
      </div>
      <p style={{ margin: "0 0 10px", fontSize: 13, color: "#475569" }}>
        {scanned ? (
          <>
            This list is a scan, so every price below was <strong>read off the image</strong> — check them
            against the page before applying.
          </>
        ) : (
          <>
            Prices below were read <strong>exactly</strong> from the list's own text. Still worth a look at
            the <em>Read from</em> column: it shows which row and crop year each price came from.
          </>
        )}{" "}
        Prices are per pound, as the list quotes them, and each is the{" "}
        <strong>newest crop year</strong> the list carries for that hop — the older ones are one click away.
      </p>

      <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 6 }}>
        <thead><tr>
          <th style={th}>Hop</th>
          <th style={th}>Crop yr</th>
          <th style={{ ...th, textAlign: "right" }}>$ / lb</th>
          <th style={{ ...th, textAlign: "right" }}>Now / oz</th>
          <th style={{ ...th, textAlign: "right" }}>New / oz</th>
          <th style={th}>Read from</th>
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td style={{ ...td, fontWeight: 600 }}>{r.name}</td>
              <td style={{ ...td, color: "#64748b" }}>{r.year ?? "—"}</td>
              <td style={numTd}>
                <input style={priceInp} inputMode="decimal" value={entered[r.name]}
                  onChange={(e) => set(r.name, e.target.value)} placeholder="—" />
              </td>
              <td style={{ ...numTd, color: "#94a3b8" }}>{money(r.from)}</td>
              <td style={{ ...numTd, fontWeight: 700, color: r.changed ? "#92400e" : "#94a3b8" }}>{money(r.to)}</td>
              <td style={td}>
                {r.matchedLabel
                  ? (
                    <span style={note}>
                      {r.matchedLabel}
                      {r.ambiguous && (
                        <strong style={{ color: "#b45309" }}> · crop years unclear, read them off the page</strong>
                      )}
                      {r.conflict && !r.ambiguous && (
                        <strong style={{ color: "#b45309" }}> · two prices for that crop, pick one</strong>
                      )}
                      {scanned && !r.ambiguous && r.confidence != null && r.confidence < LOW_CONFIDENCE && (
                        <strong style={{ color: "#b45309" }}> · unsure, check this one</strong>
                      )}
                    </span>
                  )
                  : <span style={{ ...note, fontStyle: "italic" }}>not found on this list</span>}
                {/* Every quote found for this variety, offered rather than
                    substituted. Shown when nothing could be prefilled, and also
                    alongside a prefill so an older crop is one click away. */}
                {r.available?.length > (r.price == null ? 0 : 1) && (
                  <div style={{ marginTop: 3 }}>
                    {r.available.map((p) => (
                      <button key={`${p.year}:${p.price}`} type="button" style={chip}
                        title={p.label ?? undefined}
                        onClick={() => set(r.name, String(p.price))}>
                        use {p.year}: {money(p.price)}
                      </button>
                    ))}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {catalog && <HopCatalogSummary catalog={catalog} />}

      <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center", flexWrap: "wrap" }}>
        {/* The catalog can have work to do when no price moved at all — a list
            carrying new varieties and no change to what we stock. So the button
            is enabled on either. */}
        <button type="button" onClick={() => onApply(rows.filter((r) => r.to != null))}
          disabled={changes.length === 0 && !catalog?.added.length}
          style={{ ...btn, borderColor: "#f59e0b", background: changes.length || catalog?.added.length ? "#fef3c7" : "#f1f5f9",
                   color: changes.length || catalog?.added.length ? "#92400e" : "#94a3b8", fontWeight: 700,
                   cursor: changes.length || catalog?.added.length ? "pointer" : "not-allowed" }}>
          Apply {changes.length || "no"} hop price{changes.length === 1 ? "" : "s"}
          {catalog?.added.length ? ` + ${catalog.added.length} varieties` : ""}
        </button>
        <button type="button" onClick={onCancel} style={btn}>Cancel</button>
        {pages?.length > 0 && (
          <button type="button" onClick={() => setShowPages((v) => !v)} style={btn}>
            {showPages ? "Hide" : "Show"} the list ({pages.length} page{pages.length === 1 ? "" : "s"})
          </button>
        )}
      </div>

      {/* The source, right here: checking a suspect number shouldn't mean digging
          the PDF out of a downloads folder. */}
      {showPages && (
        <div style={{ marginTop: 12, maxHeight: 520, overflow: "auto", border: "1px solid #e2e8f0", borderRadius: 6, background: "#fff" }}>
          {pages.map((src, i) => (
            <img key={i} src={src} alt={`Spot hop list page ${i + 1}`} style={{ display: "block", width: "100%" }} />
          ))}
        </div>
      )}
    </div>
  );
}
