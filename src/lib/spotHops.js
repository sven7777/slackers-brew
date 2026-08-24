// BSG spot hop list (positioned words) → a price per hop we buy.
//
// This list is the only source for hop pricing — the Houston price list carries
// no hops at all — and it arrives in TWO forms. The July 2025 list was four page
// IMAGES with no text layer, so its words came from OCR and every number was a
// guess. The April 2026 list is an Excel export with a real text layer, so its
// words are exact. This module takes either: the input is positioned words
// ({text, x0, x1, y0, y1}, y counting DOWN the page), and the parse is geometry
// on top of that, so the source only changes how much the result can be trusted
// — `confidence` is present on an OCR word and absent on an exact one.
//
// What does not change is that a brewer confirms every price before it is
// written. The module reports what it found, where it found it, and how sure it
// was, and never decides anything a brewer can't check on the page.
//
// The table is variety × crop year:
//
//   HOP VARIETY            ORIGIN     2022        2023        2024
//   Cascade Pellet - 11lb  American   $7.99/lb                $8.99/lb
//   Citra® Cryo Pellet     American                           $29.99/lb
//
// So a price means nothing without its column: the same hop at two crop years is
// two different prices, and products.js already carries the `cropYear` Slackers
// actually buys. Columns come from the year header, which repeats on every page.

import { defaultProductMap } from "./products";

// A four-digit year in the plausible range for a crop. Anything else that looks
// like a number in a header is not a column.
const YEAR_RE = /^(20[12]\d|203\d)$/;

// "$7.99/lb", "$7.99", "7.99/Ib", "$7.30/b" — the per-unit suffix comes back from
// OCR as lb / Ib / 1b / b, and the dollar sign is sometimes missed, so both are
// optional and the suffix is matched loosely.
//
// It stays ANCHORED and the suffix stays short on purpose: the page header
// carries "1.800.374.2739", and a pattern that tolerated arbitrary trailing text
// would read that phone number as a $1.80 hop.
const PRICE_RE = /^\$?(\d{1,3}(?:,\d{3})*\.\d{2})(?:\s*[/|]\s*[a-zA-Z0-9]{1,3}\.?)?$/;

// Variants of a variety we deliberately do NOT buy. Cryo and Enriched are
// concentrated products at their own (much higher) price, and a 44 lb pack is a
// different order unit than the 11 lb box products.js prices.
// "lb" comes back from OCR as "lb", "Ib" or "1b" depending on the row, so the
// pack sizes are matched with all three — a 44 lb pack read as "441b" that
// slipped through would price a batch off the wrong product.
// CO2 extract is on the list too, in its own block at the end, priced per CAN —
// a different product in a different unit, and the pack maths in pricing.js is
// per pound. Shortest-label-wins already prefers "Cascade Pellet - 11lb" over
// "Cascade - CO2 Hop Extract (150GMA)", but only while BOTH are on the list; a
// month where a variety shows up as extract only would otherwise price a batch
// off a $44 can as though it were $44/lb.
const NOT_OURS = /\b(cryo|enriched)\b|\b(44|22)\s?[l1I]b\b|\bco2\b|\bextract\b/i;

// Fold OCR punctuation noise: trademark marks, en/em dashes, doubled spaces.
export function normalizeVariety(text) {
  return String(text ?? "")
    .replace(/[®™©|]/g, " ")
    .replace(/[‐-―]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const priceOf = (token) => {
  const m = PRICE_RE.exec(String(token ?? "").trim());
  return m ? Number(m[1].replace(/,/g, "")) : null;
};

// Words → rows, by vertical overlap. OCR gives each word a box; two words are on
// the same row when their vertical centres sit inside each other's height, which
// survives the baseline wobble a scan introduces.
export function groupWordsIntoRows(words) {
  const usable = (words || []).filter((w) => w && String(w.text ?? "").trim() !== "");
  const rows = [];
  for (const w of [...usable].sort((a, b) => (a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2)) {
    const centre = (w.y0 + w.y1) / 2;
    const row = rows[rows.length - 1];
    const height = Math.max(1, w.y1 - w.y0);
    if (row && Math.abs(row.centre - centre) <= height * 0.6) {
      row.words.push(w);
      row.centre = (row.centre * (row.words.length - 1) + centre) / row.words.length;
    } else {
      rows.push({ centre, words: [w] });
    }
  }
  return rows.map((r) => ({ ...r, words: r.words.sort((a, b) => a.x0 - b.x0) }));
}

// A row of year tokens defines the price columns beneath it, until the next such
// row. Each column owns the x-range halfway to its neighbours.
function readYearHeader(row) {
  const years = row.words
    .map((w) => ({ year: Number(String(w.text).trim()), centre: (w.x0 + w.x1) / 2 }))
    .filter((y) => YEAR_RE.test(String(y.year)));
  if (years.length < 2) return null;
  years.sort((a, b) => a.centre - b.centre);
  return years.map((y, i) => {
    const prev = years[i - 1];
    const next = years[i + 1];
    return {
      year: y.year,
      from: prev ? (prev.centre + y.centre) / 2 : -Infinity,
      to: next ? (y.centre + next.centre) / 2 : Infinity,
    };
  });
}

// Positioned words → { rows }, each row carrying its label text and the prices
// it holds, tagged with the crop year of the column each price fell in. The
// words may come from OCR or from a real text layer; the geometry is the same.
//
// The page's HEADER ROW is read first, in a pass of its own, and then applies to
// the whole page — including rows ABOVE it.
//
// ⚠️ That is not a nicety. This is a spreadsheet print-out, and Excel repeats
// the header row wherever the page break happens to leave it: on the April 2026
// list page 2 opens straight into Mosaic and doesn't print "HOP VARIETY | ORIGIN
// | 2023 | 2024 | 2025" until two thirds of the way down. Walking top-to-bottom
// and only trusting a header once it had been passed left the first thirteen
// rows of that page with no columns, so every price on them landed in no crop
// year and the rows were dropped whole — Mosaic among them, which Slackers buys.
//
// Carrying the header upward is safe because the columns are a property of the
// PAGE, not of where the header was printed: a spreadsheet prints one column
// layout per sheet, and the x positions bear that out (2023 at x=291.5 on both
// pages of that list). Multiple headers on a page still work as before — a row
// takes the nearest header at or above it — so a genuine mid-page layout change
// would still be honoured.
function readPageHeaders(grouped) {
  const headers = [];
  let originX = null;
  for (const row of grouped) {
    const hasPrice = row.words.some((w) => priceOf(w.text) != null);
    // ⚠️ Only the printed HEADER marks the origin column — matched case-sensitively
    // and only on a row carrying no prices. The list's own footnote reads
    // "*Amarillo crop origin may fluctuate between US and Germany…", and taking
    // that lowercase "origin" as the column boundary truncated every label below
    // it: 40 varieties a page collapsed to 15 rows, most of them a single word.
    if (!hasPrice) {
      const origin = row.words.find((w) => String(w.text).trim() === "ORIGIN");
      if (origin && originX == null) originX = origin.x0;
    }
    const columns = readYearHeader(row);
    if (columns) headers.push({ row, centre: row.centre, columns });
  }
  return { headers, originX };
}

export function parseSpotHops(words) {
  const grouped = groupWordsIntoRows(words);
  const { headers, originX } = readPageHeaders(grouped);
  const headerRows = new Set(headers.map((h) => h.row));

  // The nearest header at or above this row; failing that, the page's first —
  // which is what rescues the rows printed above a mid-page header.
  const columnsFor = (centre) => {
    let found = null;
    for (const h of headers) {
      if (h.centre <= centre) found = h;
      else break;
    }
    return (found ?? headers[0])?.columns ?? null;
  };

  const rows = [];
  for (const row of grouped) {
    if (headerRows.has(row)) continue;

    const priced = row.words
      .map((w) => ({ word: w, price: priceOf(w.text) }))
      .filter((p) => p.price != null);
    if (priced.length === 0) continue;

    const columns = columnsFor(row.centre);

    // Label = the variety cell only. The ORIGIN column sits between the variety
    // and the prices, so the header's own "ORIGIN" tells us where to stop —
    // without it every label would read "Cascade Pellet - 11lb American", which
    // is what a brewer would be checking the match against.
    const firstPriceX = priced[0].word.x0;
    const limit = Math.min(firstPriceX, originX ?? Infinity);
    // A word belongs to the variety cell if it STARTS there. Requiring it to end
    // there too silently dropped the rows OCR ran together — "Mandarina Bavaria
    // Pellet - 11lb" can come back as one wide token whose box overhangs the
    // column edge, and discarding it left the row with no label at all, which
    // dropped the row. Two thirds of a page went missing that way.
    const label = row.words.filter((w) => w.x0 < limit).map((w) => w.text).join(" ").trim();
    if (!label) continue;

    // The FEATURED block has no year columns — it prints the crop year in the
    // row itself, next to a single price.
    const inlineYear = row.words
      .map((w) => Number(String(w.text).trim()))
      .find((n) => YEAR_RE.test(String(n)));

    const prices = priced.map(({ word, price }) => {
      const centre = (word.x0 + word.x1) / 2;
      const column = columns?.find((c) => centre >= c.from && centre < c.to);
      return {
        price,
        year: column?.year ?? (priced.length === 1 ? inlineYear ?? null : null),
        confidence: word.confidence ?? null,
      };
    }).filter((p) => p.year != null);

    // ⚠️ Two prices in one row can't share a crop year — the row has one cell per
    // column. When it happens, the year header was misread (a missed "2022"
    // shifts every column boundary), so the years on this row are not to be
    // trusted. The row is kept and FLAGGED rather than silently offering a price
    // under the wrong year, which is the one mistake this whole screen exists to
    // prevent.
    const years = prices.map((p) => p.year);
    const ambiguous = new Set(years).size !== years.length;
    if (prices.length > 0) rows.push({ label, variety: normalizeVariety(label), prices, ambiguous });
  }

  return { rows };
}

// The list prints its own date ("Updated on: July 1, 2025") in the page header,
// which becomes each price's `effective` — a hop quote is a spot price and goes
// stale, so when it was quoted matters as much as what it was.
const MONTHS = ["january","february","march","april","may","june","july","august","september","october","november","december"];
const DATE_RE = new RegExp(`\\b(${MONTHS.join("|")})\\s+(\\d{1,2}),?\\s+(20\\d{2})\\b`, "i");

export function parseSpotHopDate(pages) {
  for (const words of pages || []) {
    const text = (words || []).map((w) => w.text).join(" ");
    const m = DATE_RE.exec(text);
    if (!m) continue;
    const month = MONTHS.indexOf(m[1].toLowerCase()) + 1;
    return `${m[3]}-${String(month).padStart(2, "0")}-${String(Number(m[2])).padStart(2, "0")}`;
  }
  return null;
}

// Several pages of OCR words → one row list.
//
// Pages are parsed SEPARATELY and only their rows combined: word coordinates are
// page-relative, so pooling the words first would interleave page 2's rows with
// page 1's at the same heights and scatter prices into the wrong varieties.
export function parseSpotHopPages(pages) {
  return { rows: (pages || []).flatMap((words) => parseSpotHops(words).rows) };
}

// The hops Slackers buys, as {name, sku} — the inventory name is what the list
// is searched for. There is deliberately no crop year here: Slackers buys the
// most recent crop, so which column to read is a property of the LIST in front
// of you, not of the catalog (see matchSpotHopPrices).
export function ourHops() {
  return Object.entries(defaultProductMap.hop || {})
    .map(([name, sku]) => ({ name, sku }))
    .filter((h) => h.sku);
}

// Pair each hop we buy with a price on the list.
//
// A row matches when it STARTS with the variety name, which is what separates
// "Cascade Pellet - 11lb" from "Cryo Cascade Hops®" without a special case, and
// the Cryo/Enriched/44 lb/extract variants are excluded outright: they're
// different products at their own prices, and quietly costing a batch at Cryo
// money would be a large silent error.
//
// **The price taken is the NEWEST crop year on the list**, because that is what
// the brewery buys. This used to come from a `cropYear` stored per product and
// only prefilled on an exact match, which was wrong in the way stored snapshots
// are always wrong: the catalog said 2022-2024, the April 2026 list quoted
// 2023-2025, and five hops that were sitting right there on the page prefilled
// nothing. The crop year Slackers buys is a property of the list in front of
// you, so it is read off the list.
//
// ⚠️ Prices are pooled across EVERY matching row, not taken from one. The list
// carries two Amarillo pellet rows — a starred American/German one priced
// 2023-2025, and a German one priced 2023 only, at a third of the money — and
// picking a single row by shortest label landed on the German one, whose newest
// year is two crops stale. Pooling asks the right question ("what is the newest
// Amarillo on this page?") instead of the wrong one ("what does this one row
// say?").
//
// Nothing is prefilled where the answer isn't clean: if two rows quote DIFFERENT
// prices for the newest year, or the row it came from had unreadable columns,
// the price is left blank and every candidate is offered in `available` for a
// human to pick off the page. Guessing between two live quotes is exactly the
// confident lie this screen exists to prevent.

// Does this row name this variety? The striped separator bars between rows come
// back from OCR as a stray "EE" or "FF" glued to the front of the next label, so
// one short leading token is allowed before the variety. Nothing longer, and the
// Cryo/Enriched exclusion still runs either way — "Cryo Cascade" must never
// answer to "Cascade".
// Fold the letters OCR confuses most on this list — l / I / 1 / | all render as
// near-identical strokes in the table's bold face, and "Idaho 7" comes back as
// "ldaho 7". Both sides of the comparison get the same folding, so this can only
// join spellings, never change which hop a row is about.
const matchKey = (text) => normalizeVariety(text).replace(/[il1|!]/g, "i");

function startsWithVariety(rowVariety, variety) {
  const row = matchKey(rowVariety);
  const want = matchKey(variety);
  if (row.startsWith(want)) return true;
  const [first, ...rest] = row.split(" ");
  return first.length <= 2 && rest.join(" ").startsWith(want);
}

export function matchSpotHopPrices(rows, hops = ourHops()) {
  return hops.map((hop) => {
    const candidates = (rows || []).filter(
      (r) => startsWithVariety(r.variety, hop.name) && !NOT_OURS.test(r.label),
    );

    // Every (year, price) this variety is quoted at anywhere on the list, each
    // remembering the row it came from so a brewer can tell two rows apart.
    // Deduped on year+price: a repeated block quoting the same number twice is
    // agreement, not a conflict.
    const seen = new Set();
    const available = [];
    for (const row of candidates) {
      for (const p of row.prices) {
        const key = `${p.year}:${p.price}`;
        if (seen.has(key)) continue;
        seen.add(key);
        available.push({ ...p, label: row.label, ambiguous: Boolean(row.ambiguous) });
      }
    }
    available.sort((a, b) => a.year - b.year || a.price - b.price);

    const newestYear = available.length ? available[available.length - 1].year : null;
    const atNewest = available.filter((p) => p.year === newestYear);
    // Two different prices for the same crop year, or a row whose columns didn't
    // add up: prefill nothing and say so.
    const conflict = atNewest.length > 1;
    const ambiguous = atNewest.some((p) => p.ambiguous);
    const chosen = conflict || ambiguous ? null : atNewest[0] ?? null;

    // "Read from" still names a row even when nothing was prefilled — the
    // shortest candidate, which is the plain pellet line.
    const fallbackLabel = [...candidates].sort((a, b) => a.label.length - b.label.length)[0]?.label ?? null;

    return {
      ...hop,
      matchedLabel: chosen?.label ?? fallbackLabel,
      ambiguous,
      conflict,
      available,
      price: chosen?.price ?? null,
      year: chosen?.year ?? null,
      confidence: chosen?.confidence ?? null,
    };
  });
}
