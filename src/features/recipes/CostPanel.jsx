import { useMemo } from "react";
import { batchVolume, computeRecipeCost, priceMapFrom, GAL_PER_KEG } from "../../lib/cogs";
import { card, hdr, cell, num, th, inp } from "../../styles";

// Cost panel (Recipes ▸ Cost): ingredient COGS for the selected recipe — batch
// total, cost per barrel, per keg, and per 16 oz pint — with each ingredient's
// cost per unit editable inline.
//
// Prices are GLOBAL, not per-recipe: they live on inventory rows, so editing
// Citra here changes it everywhere. The panel says so, because an input sitting
// inside one recipe's table strongly implies otherwise.
//
// Packaged volume comes from the recipe's own post-boil yield when the Brew
// Sheet has one, else the brewery default, less the brewhouse loss. Both live in
// Settings so a brewer can tune them as they measure.

const CATS = [
  { key: "malt", label: "🌾 Malts" },
  { key: "hop", label: "🌿 Hops" },
  { key: "yeast", label: "🧫 Yeast" },
  { key: "adj", label: "🧪 Adjuncts" },
];

// Values arrive from computeRecipeCost() already rounded up to the cent, so
// toFixed(2) is exact rather than a second rounding.
const money = (n) => n == null ? "—" : `$${n.toFixed(2)}`;
// Prices are stored rounded to the cent (see setInvCost / applyPrices), so two
// decimals here is the whole value, not a truncation of it — the field always
// agrees with the extended cost beside it.
const perUnit = (n) => n == null ? "" : n.toFixed(2);
// What the brewery default works out to in kegs, shown as the yield field's
// placeholder — the units the field asks for, not the percentage behind them.
const kegsFromLoss = (gal, lossPct) => (gal * (1 - lossPct / 100)) / GAL_PER_KEG;

const statBox = { flex: 1, minWidth: 130, padding: "12px 14px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8 };
const statLabel = { fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" };
const statValue = { fontSize: 22, fontWeight: 800, color: "#92400e", marginTop: 2 };
const noteStyle = { fontSize: 12, color: "#64748b", padding: "8px 14px" };

export default function CostPanel({ recipe, ri, setRecs, dbl, setDbl, malts, hops, yeast, adj, setInvCost, settings }) {
  const priceMap = useMemo(() => priceMapFrom({ malts, hops, yeast, adj }), [malts, hops, yeast, adj]);

  // Both fall back to the brewery default when unset — an empty Settings field
  // means "use the default", not "no loss". A recipe's own average keg yield,
  // when set, back-solves the loss % instead. See batchVolume().
  const { kettleGal: postBoilGal, lossPct, defaultLossPct, source, kegsRejected } = batchVolume({ recipe, settings });

  // Same write path the Brew Sheet uses for its planned readings: one key on
  // the recipe's `process` map, so this needs no column of its own.
  const setAvgKegs = (v) =>
    setRecs((p) => p.map((rec, i) => (i === ri ? { ...rec, process: { ...(rec.process || {}), avgKegs: v } } : rec)));

  const defaultKegs = postBoilGal != null ? kegsFromLoss(postBoilGal, defaultLossPct).toFixed(1) : "";

  const r = useMemo(
    () => computeRecipeCost({ recipe, priceMap, postBoilGal, lossPct, dbl }),
    [recipe, priceMap, postBoilGal, lossPct, dbl]
  );

  // Oldest price behind this number — a year-old figure should look like one.
  const asOf = useMemo(() => {
    const dates = [...malts, ...hops, ...yeast, ...adj]
      .filter(i => Number.isFinite(i?.cpu) && i?.pricedAt)
      .map(i => i.pricedAt)
      .sort();
    return dates[0] || null;
  }, [malts, hops, yeast, adj]);

  if (!recipe) return null;
  const linesFor = (cat) => r.lines.filter(l => l.category === cat);

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={statBox}>
          <div style={statLabel}>Batch total</div>
          <div style={statValue}>{money(r.total)}</div>
        </div>
        <div style={statBox}>
          <div style={statLabel}>Cost / bbl</div>
          <div style={statValue}>{money(r.costPerBbl)}</div>
        </div>
        <div style={statBox}>
          <div style={statLabel}>Cost / keg</div>
          <div style={statValue}>{money(r.costPerKeg)}</div>
        </div>
        <div style={statBox}>
          <div style={statLabel}>Cost / pint</div>
          <div style={statValue}>{money(r.costPerPint)}</div>
        </div>
        <div style={{ ...statBox, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input type="checkbox" checked={!!dbl} onChange={e => setDbl(e.target.checked)} />
            Double batch
          </label>
        </div>
      </div>

      {/* Yield basis. Every figure above is per PACKAGED bbl, so the volume it
          divides by — and the loss that separates that from the kettle — belongs
          on screen next to the money, not buried in Settings. */}
      <div style={{ ...card, marginBottom: 12 }}>
        <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 13, color: "#475569" }}>
          <label htmlFor="avg-kegs" style={{ fontWeight: 600 }}>Avg yield</label>
          <input
            id="avg-kegs" style={{ ...inp, width: 70 }} type="number" step="0.1" min="0"
            value={recipe?.process?.avgKegs ?? ""}
            placeholder={defaultKegs}
            onChange={(e) => setAvgKegs(e.target.value === "" ? "" : e.target.value)} />
          <span>kegs per batch</span>
          {/* The default loss % is rounded inline rather than through a helper:
              it reads off the batchVolume result AFTER the useMemo above, and a
              call there extends that object's mutable range past the memo — at
              which point the React Compiler gives up on the whole panel. */}
          <span style={{ color: "#94a3b8" }}>
            {source === "kegs"
              ? `— your measured yield for this beer, so ${lossPct.toFixed(1)}% loss`
              : `— blank uses the brewery default of ${Math.round(defaultLossPct * 10) / 10}% loss`}
          </span>
        </div>
        <div style={{ padding: "0 14px 10px", fontSize: 12, color: "#64748b" }}>
          {r.packagedBbl != null
            ? `${postBoilGal * (dbl ? 2 : 1)} gal less ${lossPct.toFixed(1)}% loss = ${r.packagedBbl.toFixed(2)} bbl ≈ ${r.kegs.toFixed(1)} kegs ≈ ${Math.round(r.pints)} pints`
            : "no batch volume set"}
        </div>
        {kegsRejected && (
          <div style={{ padding: "0 14px 10px", fontSize: 12, color: "#92400e" }}>
            That yield is more beer than the {postBoilGal} gal boil produces, so it's ignored
            and the brewery default is used. Check the Brew Sheet's Post-Boil Yield.
          </div>
        )}
      </div>

      {r.missing.length > 0 && (
        <div style={{ ...card, borderColor: "#fbbf24", background: "#fffbeb", marginBottom: 12 }}>
          <div style={{ padding: "10px 14px", fontSize: 13, color: "#92400e" }}>
            <strong>{r.missing.length} ingredient{r.missing.length > 1 ? "s" : ""} unpriced</strong> —{" "}
            {r.missing.map(m => m.name).join(", ")}. They are left out of the total, so the real
            cost is higher than shown. Enter a cost below to include them.
          </div>
        </div>
      )}

      {CATS.map(({ key, label }) => {
        const lines = linesFor(key);
        if (!lines.length) return null;
        return (
          <div style={card} key={key}>
            <div style={{ ...hdr, display: "flex", justifyContent: "space-between" }}>
              <span>{label}</span>
              <span>{money(r.byCategory[key])}</span>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>Ingredient</th>
                  <th style={{ ...th, textAlign: "right" }}>Qty</th>
                  <th style={{ ...th, textAlign: "right" }}>Cost / unit</th>
                  <th style={{ ...th, textAlign: "right" }}>Cost</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.name} style={l.cost == null ? { background: "#fffbeb" } : null}>
                    <td style={cell}>{l.name}</td>
                    <td style={num}>{l.qty} {l.unit}</td>
                    <td style={num}>
                      <input
                        style={{ ...inp, width: 96 }}
                        type="number" step="0.01" min="0"
                        value={perUnit(l.costPerUnit)}
                        placeholder="—"
                        aria-label={`Cost per ${l.unit} of ${l.name}`}
                        onChange={(e) => setInvCost(key, l.name, e.target.value, l.unit)}
                      />
                    </td>
                    <td style={{ ...num, fontWeight: 600 }}>
                      {l.cost == null ? <span style={{ color: "#b45309" }}>unpriced</span> : money(l.cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}

      <div style={{ ...card, marginBottom: 8 }}>
        <div style={noteStyle}>
          Ingredient cost only — no packaging, labor, or utilities. Water salts are excluded
          (dosed in grams, pennies per batch). Cost per pint is a 16 oz pour of{" "}
          <strong>packaged</strong> beer — it doesn't account for taproom pour loss (foam, line
          purge, tasters), so a pint actually sold costs a little more. Editing a cost here changes it for{" "}
          <strong>every</strong> recipe, since prices live on the ingredient, not the recipe.
          {asOf && <> Prices as of <strong>{asOf}</strong>.</>}
        </div>
      </div>
    </div>
  );
}
