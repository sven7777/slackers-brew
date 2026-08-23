// BSG spot hop list (OCR'd words) → a price per hop we buy.
//
// This list is the only source for hop pricing — the Houston price list carries
// no hops at all — and it arrives as four page IMAGES with no text layer, so the
// words come from OCR and every number is a guess until a human confirms it.
// That shapes the whole module: it reports what it found, where it found it, and
// how sure it was, and never decides anything a brewer can't check on the page.
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

import { defaultProductMap, productsBySku } from "./products";

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
const NOT_OURS = /\b(cryo|enriched)\b|\b(44|22)\s?[l1I]b\b/i;

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

// OCR words → { rows }, each row carrying its label text and the prices it holds,
// tagged with the crop year of the column each price fell in.
export function parseSpotHops(words) {
  const grouped = groupWordsIntoRows(words);
  const rows = [];
  let columns = null;
  let originX = null; // left edge of the ORIGIN column, from the header

  for (const row of grouped) {
    const priced = row.words
      .map((w) => ({ word: w, price: priceOf(w.text) }))
      .filter((p) => p.price != null);

    // ⚠️ Only the printed HEADER marks the origin column — matched case-sensitively
    // and only on a row carrying no prices. The list's own footnote reads
    // "*Amarillo crop origin may fluctuate between US and Germany…", and taking
    // that lowercase "origin" as the column boundary truncated every label below
    // it: 40 varieties a page collapsed to 15 rows, most of them a single word.
    const origin = priced.length === 0 && row.words.find((w) => String(w.text).trim() === "ORIGIN");
    if (origin) originX = origin.x0;

    const header = readYearHeader(row);
    if (header) { columns = header; continue; }

    if (priced.length === 0) continue;

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

// The hops Slackers buys, as {name, sku, cropYear} — the inventory name is what
// the list is searched for, and the crop year is which column to read.
export function ourHops() {
  return Object.entries(defaultProductMap.hop || {})
    .map(([name, sku]) => ({ name, sku, cropYear: productsBySku[sku]?.cropYear ?? null }))
    .filter((h) => h.sku);
}

// Pair each hop we buy with a row on the list.
//
// A row matches when it STARTS with the variety name, which is what separates
// "Cascade Pellet - 11lb" from "Cryo Cascade Hops®" without a special case, and
// the Cryo/Enriched/44 lb variants are excluded outright: they're different
// products at their own prices, and quietly costing a batch at Cryo money would
// be a large silent error.
//
// `price` is filled ONLY from the exact crop year the brewery buys. When the
// list has that variety at other years instead (Cascade is priced for 2022 and
// 2024, and Slackers' box is 2023), the alternatives come back in `available`
// for a human to choose from — guessing an adjacent year's price would be
// inventing a quote.
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
    const variety = hop.name;
    const candidates = (rows || []).filter(
      (r) => startsWithVariety(r.variety, variety) && !NOT_OURS.test(r.label),
    );
    // Prefer the shortest label: "Cascade Pellet - 11lb" over any longer variant
    // that happens to share the prefix.
    const match = candidates.sort((a, b) => a.label.length - b.label.length)[0] || null;
    const available = match ? [...match.prices].sort((a, b) => a.year - b.year) : [];
    // A row whose columns didn't add up never pre-fills a price, whatever year
    // it seems to carry; it shows on the review screen for a human to read off
    // the page instead.
    const exact = hop.cropYear && !match?.ambiguous ? available.find((p) => p.year === hop.cropYear) : null;
    // A hop with no crop year on file (a blend bought once) takes the newest
    // price on the list, flagged by the year shown beside it.
    const chosen = exact ?? (hop.cropYear || match?.ambiguous ? null : available[available.length - 1] ?? null);

    return {
      ...hop,
      matchedLabel: match?.label ?? null,
      ambiguous: Boolean(match?.ambiguous),
      available,
      price: chosen?.price ?? null,
      year: chosen?.year ?? null,
      confidence: chosen?.confidence ?? null,
    };
  });
}
