import { useState } from "react";
import { inp } from "../styles";

// A cost-per-unit field, shared by the Inventory tab and the Recipes ▸ Cost
// view — the two places that edit the one price stored on an inventory row.
//
// It exists because a plain controlled input CANNOT be used here. Prices are
// stored rounded to the cent, so the displayed value is `cpu.toFixed(2)` — and
// re-rendering that on every keystroke rewrites what's being typed mid-word:
// type "1.09" and after "1" the field becomes "1.00", the caret sits at the
// end, and the remaining ".09" appends to give "1.0009" → $1.01. Every price
// with a non-zero second decimal was silently mistyped.
//
// So the keystrokes own the field while it has focus (`draft`), and the stored
// value owns it the rest of the time. Blur drops the draft, which is also what
// normalizes "1.5" to "1.50" and "" to blank.
export default function PriceInput({ value, onCommit, style, ...rest }) {
  const [draft, setDraft] = useState(null);
  const text = draft ?? (Number.isFinite(value) ? value.toFixed(2) : "");

  return (
    <input
      type="number" step="0.01" min="0"
      value={text}
      placeholder="—"
      style={{ ...inp, ...style }}
      onChange={(e) => { setDraft(e.target.value); onCommit(e.target.value); }}
      onBlur={() => setDraft(null)}
      {...rest}
    />
  );
}
