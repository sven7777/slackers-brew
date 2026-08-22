import { useState } from "react";
import { styleNames, stylesByCategory } from "../lib/beerStyles";
import { inp, sel } from "../styles";

// Beer style picker: the 148 BJCP styles exported from BeerSmith, grouped into
// <optgroup>s by category so a 148-item list stays navigable.
//
// A recipe's style is still just a string, and this deliberately does not
// constrain it to the catalog:
//
//   - A style already on a recipe that isn't in the guide — Slackers' own
//     shorthand ("NEIPA", "Belgian Blond"), or anything a .bsmx import brings
//     in — is offered as its own option and kept verbatim. A picker that
//     silently dropped a value it didn't recognize would rewrite recipe data
//     just by being rendered.
//   - "Custom…" swaps in a text box, so a house style that no guideline lists
//     can still be typed. That was the only thing free text could do that a
//     dropdown can't, and losing it would be a step back.

const CUSTOM = "__custom__";
const NONE = "";

export default function StyleSelect({ value, onChange, id }) {
  const [typing, setTyping] = useState(false);
  const current = value ?? "";
  const offCatalog = current !== "" && !styleNames.includes(current);

  if (typing) {
    return (
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input
          id={id} type="text" autoFocus value={current} placeholder="House style"
          onChange={(e) => onChange(e.target.value)}
          style={{ ...inp, flex: 1, boxSizing: "border-box", textAlign: "left" }} />
        <button type="button" onClick={() => setTyping(false)}
          style={{ fontSize: 12, padding: "4px 8px", cursor: "pointer", background: "#fff", border: "1px solid #cbd5e1", borderRadius: 4, color: "#475569" }}>
          Use list
        </button>
      </div>
    );
  }

  return (
    <select
      id={id} value={current}
      onChange={(e) => {
        if (e.target.value === CUSTOM) setTyping(true);
        else onChange(e.target.value);
      }}
      style={{ ...sel, width: "100%", boxSizing: "border-box" }}>
      <option value={NONE}>— none —</option>
      {/* The recipe's own value first, so a style the guide doesn't list is
          visibly kept rather than quietly replaced. */}
      {offCatalog && (
        <optgroup label="On this recipe">
          <option value={current}>{current}</option>
        </optgroup>
      )}
      {stylesByCategory.map(({ category, names }) => (
        <optgroup key={category} label={category}>
          {names.map((n) => <option key={n} value={n}>{n}</option>)}
        </optgroup>
      ))}
      <option value={CUSTOM}>Custom…</option>
    </select>
  );
}
