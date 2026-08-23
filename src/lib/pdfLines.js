// PDF text items → lines of text.
//
// pdf.js hands back a flat bag of positioned text fragments, not lines: every
// table cell is its own item with an (x, y). Rebuilding rows is pure geometry,
// so it lives here — away from pdf.js itself — and can be unit-tested on plain
// objects.
//
// Column spacing matters, not just the words: the vendor list separates a
// description from its unit label ("price / lb") by column position alone, so a
// wide gap is re-emitted as a double space. Collapsing everything to single
// spaces would merge the two into one unreadable string.

// Items within this many units of each other vertically are the same row. PDF
// text coordinates are in points; a table row is ~10pt tall, so 3 is comfortably
// inside one row and outside the next.
const ROW_TOLERANCE = 3;

// A horizontal gap wider than this (in points) reads as a column break rather
// than a word space.
const COLUMN_GAP = 4;

// Group positioned text items into lines, top to bottom, left to right.
// Items: {str, x, y, width}. y is PDF-style (increasing upward), which is why
// rows sort descending.
export function groupIntoLines(items, { rowTolerance = ROW_TOLERANCE, columnGap = COLUMN_GAP } = {}) {
  const usable = (items || []).filter((it) => it && typeof it.str === "string" && it.str.trim() !== "");
  if (usable.length === 0) return [];

  const rows = [];
  for (const item of [...usable].sort((a, b) => b.y - a.y)) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(row.y - item.y) <= rowTolerance) row.items.push(item);
    else rows.push({ y: item.y, items: [item] });
  }

  return rows.map((row) => {
    const sorted = row.items.sort((a, b) => a.x - b.x);
    let line = "";
    let cursor = null; // x where the previous item ended
    for (const item of sorted) {
      if (cursor != null) {
        const gap = item.x - cursor;
        // Two spaces for a column break, one for an ordinary word gap, none when
        // the fragments abut (pdf.js splits words mid-run surprisingly often).
        line += gap >= columnGap ? "  " : gap > 0.5 ? " " : "";
      }
      line += item.str;
      cursor = item.x + (item.width || 0);
    }
    return line;
  });
}
