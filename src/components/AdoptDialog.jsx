import { useMemo, useState } from "react";
import {
  ADJ_UNITS, ADOPT_CATEGORIES, adoptedRow, categoryLabels, costGaps,
  derivedCost, findDuplicate, linkFields, packLabel, suggestName, suggestUnit,
} from "../lib/adopt";
import { inp, sel, addBtn, btn } from "../styles";

const money = (n) => `$${n.toFixed(2)}`;

const field = { display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 };
const row = { marginBottom: 12 };
const note = { fontSize: 12, color: "#64748b", marginTop: 4 };

// Adopting one vendor product onto the shelf — or LINKING one to a row that is
// already there.
//
// Four questions, and each one is here because the catalog genuinely cannot
// answer it (see lib/adopt.js): what we call it, which recipe table it joins,
// which pack size we buy, and — for an adjunct — what we count it in. The
// derived price is shown, not asked: it is the consequence of the pack answer,
// and showing it before anything is stored is what turns an unconvertible unit
// into a sentence on screen instead of a silent null discovered later in a COGS
// total.
//
// `linkTo` is an existing inventory row, and it answers the first two questions
// on its own — it already has a name and a category. What it still needs is the
// pack and, for an adjunct, the unit: prod's "Candi Sugar, Dark" was counted in
// `each` against a product sold by the 25 kg pack, which is unpriceable no
// matter which product it points at. So the unit stays editable here, the cost
// updates as it changes, and the change is stated rather than made quietly.
export default function AdoptDialog({ entry, siblings = [], inventory = {}, lockedCategory = null, linkTo = null, addLabel, onAdopt, onLink, onCancel }) {
  const [sku, setSku] = useState(entry?.sku);
  const chosen = useMemo(() => siblings.find((e) => e.sku === sku) ?? entry, [siblings, sku, entry]);

  // Seeded once, then owned by the brewer. The suggestion strips the vendor
  // prefix, the trademarks and the pack size; everything past that is judgement
  // (this sack is what we have always called "2-Row"), so re-deriving it as the
  // pack changes would overwrite an answer with a guess.
  const [name, setName] = useState(() => (linkTo ? linkTo.n : suggestName(entry)));
  const [category, setCategory] = useState(lockedCategory ?? entry?.category ?? "");
  const [unit, setUnit] = useState(() => linkTo?.u ?? suggestUnit(lockedCategory ?? entry?.category ?? "adj", entry));

  const effUnit = category === "adj" ? unit : suggestUnit(category, chosen);
  const { cpu, why } = derivedCost(chosen, effUnit);
  // A name that already exists is only news when a new row is being created.
  const dup = linkTo ? null : findDuplicate(inventory, name);
  const ready = name.trim() && category;
  const unitMoved = linkTo && category === "adj" && (linkTo.u ?? null) !== unit;
  const commitLabel = addLabel ?? (linkTo ? `Link ${linkTo.n}` : "Add to inventory");

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{chosen?.name}</div>
      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 14 }}>
        {chosen?.vendor ? `${chosen.vendor} · ` : ""}{chosen?.sku} · {packLabel(chosen)}
        {chosen?.effective ? ` · list of ${chosen.effective}` : ""}
      </div>

      <div style={row}>
        <label style={field} htmlFor="adopt-name">{linkTo ? "Linking" : "Short name"}</label>
        {linkTo ? (
          <div style={{ fontSize: 13 }}>
            {linkTo.n}
            <span style={{ color: "#64748b" }}> — the ingredient already on your shelf, kept as it is</span>
          </div>
        ) : (
          <>
            <input id="adopt-name" value={name} onChange={(e) => setName(e.target.value)}
              style={{ ...inp, width: "100%", textAlign: "left" }} />
            <div style={note}>What prints on brew sheets and shows in every picker. The vendor's own name is a catalogue entry, not a brew-sheet line.</div>
          </>
        )}
      </div>

      {!linkTo && <div style={row}>
        <label style={field} htmlFor="adopt-cat">Category</label>
        {lockedCategory ? (
          <div style={{ fontSize: 13 }}>
            {categoryLabels[lockedCategory]}
            <span style={{ color: "#64748b" }}> — the table you're adding to</span>
          </div>
        ) : (
          <select id="adopt-cat" value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...sel, width: "100%" }}>
            <option value="">Choose one…</option>
            {ADOPT_CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabels[c]}</option>)}
          </select>
        )}
        {!lockedCategory && !entry?.category && (
          <div style={note}>
            The price list didn't say which this is, so it's yours to set — it decides which
            recipe table the ingredient can join.
          </div>
        )}
      </div>}

      {siblings.length > 1 && (
        <div style={row}>
          <label style={field} htmlFor="adopt-pack">Pack size</label>
          <select id="adopt-pack" value={sku} onChange={(e) => setSku(e.target.value)} style={{ ...sel, width: "100%" }}>
            {siblings.map((s) => (
              <option key={s.sku} value={s.sku}>{packLabel(s)} — {s.sku}</option>
            ))}
          </select>
          <div style={note}>This one comes in {siblings.length} sizes. The pack is what the price divides by, so pick the one you order.</div>
        </div>
      )}

      {category === "adj" && (
        <div style={row}>
          <label style={field} htmlFor="adopt-unit">Counted in</label>
          <select id="adopt-unit" value={unit} onChange={(e) => setUnit(e.target.value)} style={{ ...sel, width: "100%" }}>
            {ADJ_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
          {unitMoved && (
            <div style={{ ...note, color: "#92400e" }}>
              Changes what this ingredient is counted in on your shelf, from{" "}
              <strong>{linkTo.u || "no unit"}</strong> to <strong>{unit}</strong> — which is
              what lets a {packLabel(chosen)} pack turn into a price.
            </div>
          )}
        </div>
      )}

      <div style={{ ...row, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: "8px 10px" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Cost per {effUnit || "unit"}</div>
        {cpu == null ? (
          <div style={{ fontSize: 13, color: "#b45309", marginTop: 2 }}>
            unpriced — {costGaps[why]} You can still {linkTo ? "link" : "add"} it and type a price in yourself.
          </div>
        ) : (
          <div style={{ fontSize: 15, fontWeight: 700, color: "#92400e", marginTop: 2 }}>
            {money(cpu)} <span style={{ fontSize: 12, fontWeight: 400, color: "#64748b" }}>/ {effUnit}</span>
          </div>
        )}
      </div>

      {dup && (
        <div style={{ ...row, background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 6, padding: "8px 10px", fontSize: 13, color: "#92400e" }}>
          You already stock <strong>{dup.item.n}</strong> ({categoryLabels[dup.category]}). This adds a
          second row — rename it if they're the same thing.
        </div>
      )}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" style={btn} onClick={onCancel}>Cancel</button>
        <button type="button" style={{ ...addBtn, padding: "6px 14px", opacity: ready ? 1 : 0.5, cursor: ready ? "pointer" : "not-allowed" }}
          disabled={!ready}
          onClick={() => (linkTo
            ? onLink(category, linkTo.n, {
              ...linkFields(chosen, effUnit),
              ...(category === "adj" ? { u: effUnit } : null),
            }, chosen)
            : onAdopt(category, adoptedRow(chosen, { name, category, unit: effUnit }), chosen))}>
          {commitLabel}
        </button>
      </div>
    </div>
  );
}
