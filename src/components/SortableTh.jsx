import { th } from "../styles";

// A sortable column heading that can be sorted without a mouse.
//
// The obvious version puts `onClick` straight on the `<th>`, which works with a
// pointer and is unreachable from a keyboard — a `<th>` is not focusable and
// takes no key events. That is what shipped in BeersPanel and what CodeRabbit
// flagged on #97; it was deferred there because that PR only relocated the code.
// Fixed once here rather than twice in two panels.
//
// The split of responsibilities matters both ways round:
//
//   * `aria-sort` stays on the `<th>`, because the sort state is a property of
//     the COLUMN. Moving it onto the button would announce it against the
//     control instead of against the header it describes.
//   * The `<button>` takes the click, the focus and the Enter/Space handling,
//     which the browser gives for free the moment the element is a real button.
//
// ⚠️ A nested control normally spends table width, and these tables have none to
// spend (CLAUDE.md's 442px budget). This one spends nothing: the button carries
// `padding: 0` and inherits the font, so the `<th>`'s own padding is still the
// only padding in the cell, and `width: 100%` makes the whole heading clickable
// rather than just its text.
const btn = {
  display: "block",
  width: "100%",
  padding: 0,
  margin: 0,
  border: "none",
  background: "none",
  font: "inherit",
  color: "inherit",
  letterSpacing: "inherit",
  textTransform: "inherit",
  textAlign: "inherit",
  cursor: "pointer",
};

export default function SortableTh({ label, sortKey, sort, onSort, align = "left", title, style }) {
  const active = sort?.key === sortKey;
  const dir = active ? (sort.dir === "asc" ? "ascending" : "descending") : "none";

  return (
    <th style={{ ...th, textAlign: align, userSelect: "none", ...style }} aria-sort={dir}>
      <button type="button" style={btn} onClick={() => onSort(sortKey)}
        title={title || `Sort by ${label}`}>
        {label}{active ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}
      </button>
    </th>
  );
}
