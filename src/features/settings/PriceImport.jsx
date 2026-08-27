import { useState } from "react";
import { readPriceFile, skuFor } from "../../lib/applyPrices";
import { priceChanges } from "../../lib/priceChanges";
import { parsePriceList } from "../../lib/parsePriceList";
import { buildCatalog } from "../../lib/catalog";
import { catalogChanges } from "../../lib/catalogChanges";
import { defaultProductMap } from "../../lib/products";
import { load as loadKey, save as saveKey } from "../../lib/repo";
import { parseSpotHopPages, parseSpotHopDate, matchSpotHopPrices, ourHops } from "../../lib/spotHops";
import { buildHopCatalog, newVarieties } from "../../lib/hopCatalog";
import PriceReview from "./PriceReview";
import HopPriceReview from "./HopPriceReview";
import { card, hdr, btn } from "../../styles";

// Settings ▸ Ingredient Prices: load vendor pricing onto inventory.
//
// Several sources, one path. A hand-built JSON file ({sku: price}), the vendor's
// PDF price list, and the spot hop list all reduce to the same {sku: {price}}
// map, which priceChanges() turns into a change set, which the brewer confirms
// before anything is written. The catalog in lib/products.js supplies the rest —
// each ingredient's product, pack size and unit conversion — so an import only
// ever has to supply numbers.
//
// A dropped PDF is identified by its CONTENT, not its file name or its file
// type: parsePriceList() claims it if it holds vendor SKU rows, the spot hop
// parser claims it if it holds a variety x crop-year table, and a PDF with no
// text layer at all is that same hop table as page images, read by OCR.
//
// pdf.js is imported dynamically, on the first PDF only: it is far larger than
// the whole app, and nobody should download a PDF parser to edit their inventory.
//
// The same parse feeds two things. Pricing only ever asked the file about the
// ~30 SKUs Slackers buys; the other five hundred rows were parsed and dropped.
// They are now kept as the vendor CATALOG — what the brewery *could* buy — so a
// recipe can call for a malt that has never been in the building. The catalog
// rides along with the price import rather than being its own upload, because
// it is the same file: asking for it twice would be asking the brewer to do
// bookkeeping the parser already did.

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
  const [hopPending, setHopPending] = useState(null); // spot hop list awaiting confirmation

  const inventory = { malts, hops, yeast, adj };

  // The SKUs the brewery actually buys: what inventory points at, falling back
  // to the curated default map. Only these are worth a "no longer on the list"
  // alarm — the vendor drops products constantly and almost none are ours.
  const mappedSkus = () => {
    // ⚠️ An ingredient the brewery has ARCHIVED is one it stopped buying, so its
    // absence from a list is not news — reporting it would put a red "no longer
    // on this list" line against every hop Derek archived, every single import.
    // Archiving already means "we don't stock this"; the alarm is for a product
    // we depend on quietly disappearing.
    const archived = new Set();
    for (const rows of Object.values(inventory)) {
      for (const r of rows ?? []) if (r?.archived) archived.add(r.n);
    }
    const skus = new Set();
    for (const map of Object.values(defaultProductMap)) {
      for (const [name, sku] of Object.entries(map)) if (sku && !archived.has(name)) skus.add(sku);
    }
    for (const rows of Object.values(inventory)) {
      for (const r of rows ?? []) if (r?.sku && !r.archived) skus.add(r.sku);
    }
    return [...skus];
  };

  // Which hops the spot-hop review asks the list about.
  //
  // ⚠️ Inventory, not the built-in map. `ourHops()` reads defaultProductMap,
  // which knows the fourteen hops the brewery started with and nothing else —
  // so a hop ADOPTED from this very list would never appear on the next
  // month's review and its price would freeze at the day it was adopted. Same
  // failure the malt path had before `skuFor()`, in the one place that couldn't
  // reuse it, because this review is built from a list of hops rather than by
  // walking inventory.
  //
  // Archived hops are left out: "we stopped buying it" is already the answer to
  // "why isn't this priced".
  const hopTargets = () => {
    const rows = (hops ?? [])
      .filter((h) => !h.archived)
      .map((h) => ({ name: h.n, sku: skuFor("hop", h) }))
      .filter((h) => h.sku);
    return rows.length ? rows : ourHops();
  };

  // The spot hop list as catalog entries. Same diff, same storage, different
  // key: the hop list carries no SKUs, so hopCatalog.js merges on the VARIETY
  // and synthesises the SKU (see that module). Fails soft for the same reason
  // the malt path does — pricing is what the brewer came here to do.
  const proposeHopCatalog = async (rows, label, effective) => {
    try {
      const { entries, counts } = buildHopCatalog(rows, { source: label ?? null, effective: effective ?? null });
      const stored = await loadKey("catalog", []);
      return {
        ...catalogChanges(stored, entries, mappedSkus()),
        counts: { ...counts, unfamiliar: newVarieties(entries).length },
      };
    } catch {
      return null;
    }
  };

  // The product lookup priceChanges() needs for ingredients products.js has
  // never heard of — every one adopted from the vendor catalog. Their pack size
  // lives in the catalog, and without it their price would not move on an
  // import at all. Stored rows cover an ingredient this file doesn't mention;
  // freshly parsed rows win, because a pack quoted today is newer than one
  // stored last month.
  const bySku = (entries = []) => Object.fromEntries((entries ?? []).map((e) => [e.sku, e]));
  const storedCatalog = async () => { try { return await loadKey("catalog", []); } catch { return []; } };

  // Ingest the whole parsed list as the catalog, alongside the price change set.
  //
  // Failing softly on purpose: pricing is what the brewer came here to do, and
  // a catalog that can't be read is no reason to refuse to show them what their
  // ingredients now cost. A null catalog simply isn't offered.
  const proposeCatalog = async (parsed, label) => {
    try {
      const { entries, counts } = buildCatalog(parsed.rows, {
        source: label ?? null,
        effective: parsed.effective ?? null,
      });
      const stored = await loadKey("catalog", []);
      return { ...catalogChanges(stored, entries, mappedSkus()), counts };
    } catch {
      return null;
    }
  };

  const fail = (msg) => { setBusy(null); setPending(null); setHopPending(null); setStatus({ ok: false, msg }); };

  // A parsed {sku: {price}} map → the change set the review screen shows.
  const propose = (priceBySku, source, catalog = null, products = {}) => {
    const count = Object.keys(priceBySku).length;
    if (!count) {
      fail("No prices found in that file.");
      return;
    }
    setBusy(null);
    setStatus(null);
    setPending({ source, result: priceChanges(inventory, priceBySku, products), catalog });
  };

  const readJson = (file) => {
    const reader = new FileReader();
    reader.onload = async () => {
      let parsed;
      try {
        parsed = JSON.parse(String(reader.result));
      } catch {
        fail("That file isn't valid JSON.");
        return;
      }
      // A bare price file carries no pack sizes, so adopted ingredients are
      // costed against the packs already in the stored catalog.
      propose(readPriceFile(parsed), { label: file.name }, null, bySku(await storedCatalog()));
    };
    reader.onerror = () => fail("Couldn't read that file.");
    reader.readAsText(file);
  };

  // The image-only path: render each page, OCR it, and match the varieties we
  // buy against the crop-year columns. Nothing here is trusted — it all lands in
  // HopPriceReview for a human to check against the page it came from.
  const readHopList = async (data, pageCount, label) => {
    // The engine and language model download on first use (then the browser
    // caches them), so name the wait rather than hanging silently.
    setBusy("Loading the text reader…");
    const [{ renderPdfPages }, { createReader }] = await Promise.all([
      import("../../lib/pdfText"),
      import("../../lib/ocr"),
    ]);
    const reader = await createReader();

    const pageWords = [];
    let previews;
    try {
      // Rendered and read one page at a time: a page at OCR resolution is ~30MB
      // of canvas, and renderPdfPages frees each before building the next.
      previews = await renderPdfPages(data, {
        onPage: async ({ pageNumber, canvas }) => {
          setBusy(`Reading page ${pageNumber} of ${pageCount}…`);
          pageWords.push(await reader.read(canvas));
        },
      });
    } finally {
      await reader.close();
    }

    const { rows } = parseSpotHopPages(pageWords);
    if (rows.length === 0) {
      fail("Couldn't read any prices off that PDF. Is it the BSG spot hop list?");
      return;
    }
    const listDate = parseSpotHopDate(pageWords);
    const catalog = await proposeHopCatalog(rows, label, listDate);

    setBusy(null);
    setStatus(null);
    setHopPending({
      source: "ocr",
      catalog,
      hops: matchSpotHopPrices(rows, hopTargets()),
      effective: dateLabel(listDate),
      rawEffective: listDate,
      pages: previews,
      currentByName: Object.fromEntries((hops || []).map((h) => [h.n, h.cpu ?? null])),
    });
  };

  // The spot hop list with a real text layer. Same table, same parser, exact
  // numbers instead of OCR guesses — so this path reads it directly and never
  // starts the OCR engine. Returns whether it recognised the document.
  const readHopText = async (data, pageCount, label) => {
    const { extractPdfWords, renderPdfPages } = await import("../../lib/pdfText");
    const { pages: pageWords } = await extractPdfWords(data);
    const { rows } = parseSpotHopPages(pageWords);
    if (rows.length === 0) return false;

    // The page images are still worth having: the review screen's job is letting
    // a brewer check a price against the page it came from, and that is just as
    // useful when the number is exact. Rendered at preview resolution only —
    // there is no OCR to feed here, so none of the OCR_SCALE cost applies.
    setBusy(`Rendering ${pageCount} page${pageCount === 1 ? "" : "s"}…`);
    const previews = await renderPdfPages(data, { scale: 2 });

    const listDate = parseSpotHopDate(pageWords);
    const catalog = await proposeHopCatalog(rows, label, listDate);
    setBusy(null);
    setStatus(null);
    setHopPending({
      source: "text",
      catalog,
      hops: matchSpotHopPrices(rows, hopTargets()),
      effective: dateLabel(listDate),
      rawEffective: listDate,
      pages: previews,
      currentByName: Object.fromEntries((hops || []).map((h) => [h.n, h.cpu ?? null])),
    });
    return true;
  };

  const readPdf = async (file) => {
    setBusy("Reading the PDF…");
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      const { extractPdfLines } = await import("../../lib/pdfText");
      const { lines, hasText, pageCount } = await extractPdfLines(data);

      // A PDF printed from a screenshot has no text to extract — every price is
      // just pixels — so it goes to OCR. Only the spot hop list has ever arrived
      // that way.
      if (!hasText) {
        await readHopList(data, pageCount, file.name);
        return;
      }

      // Two different documents have a text layer, and WHICH parser a file wants
      // is decided by what its words say, not by whether it has any. Try the SKU
      // price list first, then the hop table.
      //
      // ⚠️ This used to route on `hasText` alone, which was fine only while the
      // hop list was image-only. The April 2026 list came as an Excel export —
      // real text, no SKUs anywhere in it — so it went to the SKU parser, found
      // nothing, and was reported unreadable. Both parsers now get a look before
      // anything is called unrecognised.
      const parsed = parsePriceList(lines);
      if (parsed.count) {
        const catalog = await proposeCatalog(parsed, file.name);
        propose(parsed.prices, {
          label: file.name,
          effective: dateLabel(parsed.effective),
          count: parsed.count,
          conflicts: parsed.conflicts,
        }, catalog, bySku(catalog?.next ?? await storedCatalog()));
        return;
      }

      if (await readHopText(data, pageCount, file.name)) return;

      fail("Couldn't find any prices in that PDF. Is it a BSG/Rahr price list or spot hop list?");
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
    setHopPending(null);
    if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") readPdf(file);
    else readJson(file);
  };

  const apply = async () => {
    const { next } = pending.result;
    const n = pending.result.changes.length;
    const catalog = pending.catalog;
    setMalts(next.malts);
    setHops(next.hops);
    setYeast(next.yeast);
    setAdj(next.adj);
    setPending(null);
    const priced = `Applied ${n} price change${n === 1 ? "" : "s"}.`;

    // Prices are already in state and saving themselves through the usual hook;
    // the catalog is written here because it is not App state (it is hundreds of
    // rows nothing else needs at mount). Reported separately for the same
    // reason the change set reports three outcomes: a catalog that failed to
    // save must not hide inside a message about prices that succeeded.
    if (!catalog) { setStatus({ ok: true, msg: priced }); return; }
    try {
      await saveKey("catalog", catalog.next);
      const added = catalog.added.length;
      setStatus({ ok: true, msg: `${priced} Catalog now lists ${catalog.next.length} products${added ? ` (${added} new)` : ""}.` });
    } catch (err) {
      setStatus({ ok: false, msg: `${priced} But the product catalog couldn't be saved: ${err?.message || "unknown error"}. Reload and import again to retry it.` });
    }
  };

  // Confirmed hop prices → the same {sku: {price}} map every other import
  // produces, so they take the identical path into inventory.
  const applyHops = async (confirmed) => {
    const priceBySku = Object.fromEntries(
      confirmed.filter((r) => Number.isFinite(r.perLb) && r.perLb > 0)
        .map((r) => [r.sku, { price: r.perLb, effective: hopPending.rawEffective }]),
    );
    const catalog = hopPending.catalog;
    const { next, changes } = priceChanges(inventory, priceBySku, bySku(catalog?.next));
    setMalts(next.malts);
    setHops(next.hops);
    setYeast(next.yeast);
    setAdj(next.adj);
    setHopPending(null);
    const priced = `Applied ${changes.length} hop price${changes.length === 1 ? "" : "s"}.`;

    // Reported separately for the same reason the malt path does it: a catalog
    // that failed to save must not hide inside a message about prices that
    // succeeded.
    if (!catalog) { setStatus({ ok: true, msg: priced }); return; }
    try {
      await saveKey("catalog", catalog.next);
      const added = catalog.added.length;
      setStatus({ ok: true, msg: `${priced} Catalog now lists ${catalog.next.length} products${added ? ` (${added} new)` : ""}.` });
    } catch (err) {
      setStatus({ ok: false, msg: `${priced} But the product catalog couldn't be saved: ${err?.message || "unknown error"}. Reload and import again to retry it.` });
    }
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
          <PriceReview source={pending.source} result={pending.result} catalog={pending.catalog}
            onApply={apply} onCancel={() => setPending(null)} />
        )}

        {hopPending && (
          <HopPriceReview {...hopPending} onApply={applyHops} onCancel={() => setHopPending(null)} />
        )}
      </div>
    </div>
  );
}
