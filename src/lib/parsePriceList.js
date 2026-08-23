// Vendor price list (text) → {sku: {price, effective}}.
//
// This is the parser that sits in front of applyPrices(), which applyPrices.js
// has always been written to expect. It takes plain text LINES, not a PDF, so
// the vendor's format is testable without pdf.js anywhere near it — pdfText.js
// turns a PDF into lines, and this turns lines into prices.
//
// The BSG/Rahr list is an Excel export, so every row is the same shape:
//
//   MRAH1102 Rahr Standard 2-Row          price / lb   $0.724   $0.714   $0.694
//   AZZ8074B Kerry Pink Lemonade - 1 gal  *    each   $199.99
//   BZZZ1984 Fermentis SafAle BE-134      each   $79.99   $1,519.80
//
// SKU, description, an optional "*" (ships from another site), a unit label,
// then one or more prices. We take the FIRST price: the later columns are
// quantity breaks (40+, 200+, 480+ bags; a case of 20 yeast) that Slackers
// never hits, which is the same assumption products.js documents.

// A vendor SKU: three or four letters, three or four digits, sometimes a
// trailing letter (MRAH1102, AZZZ1416, XZZZ0200, BZZ9804Z, AZZ8074B). Requiring
// the digits is what keeps it from matching shouty words in a description.
const SKU_RE = /^[A-Z]{3,4}\d{3,4}[A-Z]?$/;

// "$0.724", "$1,519.80", "$ 199.99".
const PRICE_RE = /\$\s?(\d[\d,]*(?:\.\d+)?)/;

// The list stamps its own date in the page header ("UPDATED: 6/19/2025"), which
// becomes each price's `effective` so the Cost view can say how old a number is.
const UPDATED_RE = /UPDATED:\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i;

const toNumber = (s) => Number(String(s).replace(/,/g, ""));

// Header date → ISO, or null. Two-digit years are 2000s: these lists are current
// vendor documents, not archives.
export function parseEffectiveDate(lines) {
  for (const line of lines) {
    const m = UPDATED_RE.exec(line);
    if (!m) continue;
    const [, mm, dd, yy] = m;
    const year = yy.length === 2 ? 2000 + Number(yy) : Number(yy);
    const iso = `${year}-${String(Number(mm)).padStart(2, "0")}-${String(Number(dd)).padStart(2, "0")}`;
    return iso;
  }
  return null;
}

// One line → {sku, name, unit, price} or null when it isn't a product row.
// A line only counts if it STARTS with a SKU: the list is full of prose that
// mentions money ("Pallet fee: $12.50 each", "Milling is available for an
// additional $0.10 per lb") and none of it is a product.
export function parsePriceLine(line) {
  const trimmed = String(line ?? "").trim();
  if (!trimmed) return null;

  const firstSpace = trimmed.search(/\s/);
  if (firstSpace === -1) return null;
  const sku = trimmed.slice(0, firstSpace);
  if (!SKU_RE.test(sku)) return null;

  const rest = trimmed.slice(firstSpace + 1);
  const priceMatch = PRICE_RE.exec(rest);
  if (!priceMatch) return null;
  const price = toNumber(priceMatch[1]);
  // A zero or negative price is a parse artifact, not a quote.
  if (!Number.isFinite(price) || price <= 0) return null;

  // Everything before the price is the description plus a unit label
  // ("price / lb", "each"). Split them: the label is the tail after the last
  // run of two-or-more spaces, which is how the columns are laid out.
  const before = rest.slice(0, priceMatch.index).replace(/\*/g, "").trimEnd();
  const parts = before.split(/\s{2,}/).filter(Boolean);
  const unit = parts.length > 1 ? parts[parts.length - 1].trim() : null;
  const name = (parts.length > 1 ? parts.slice(0, -1).join(" ") : before).trim();

  return { sku, name, unit, price };
}

// Parse a whole list.
//
// A SKU can legitimately appear twice (the "New and Notable" block repeats rows
// from the section below it). Same price → fine, first wins. DIFFERENT price →
// reported as a conflict rather than silently resolved, because guessing which
// one the brewery pays is exactly the kind of quiet wrongness costing must not
// have.
export function parsePriceList(lines) {
  const rows = [];
  const prices = {};
  const conflicts = [];
  const effective = parseEffectiveDate(lines || []);

  for (const line of lines || []) {
    const row = parsePriceLine(line);
    if (!row) continue;
    const existing = prices[row.sku];
    if (existing) {
      if (existing.price !== row.price) conflicts.push({ sku: row.sku, prices: [existing.price, row.price] });
      continue;
    }
    prices[row.sku] = { price: row.price, effective };
    rows.push(row);
  }

  return { prices, rows, conflicts, effective, count: rows.length };
}
