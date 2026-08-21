import { useMemo } from "react";
import { computeRecipeCost, parseVolume, priceMapFrom } from "../../lib/cogs";
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

const money = (n) => n == null ? "—" : `$${n.toFixed(2)}`;
// The cost/unit input is bound to the STORED value, unrounded. Displaying a
// rounded price here would both disagree with the extended cost beside it
// (2-Row is $0.724/lb, not $0.72) and, worse, silently overwrite the real
// price with the truncated one the moment anyone edited the field.
const perUnit = (n) => n == null ? "" : String(n);

const statBox = { flex: 1, minWidth: 130, padding: "12px 14px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8 };
const statLabel = { fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" };
const statValue = { fontSize: 22, fontWeight: 800, color: "#92400e", marginTop: 2 };
const noteStyle = { fontSize: 12, color: "#64748b", padding: "8px 14px" };

export default function CostPanel({ recipe, dbl, setDbl, malts, hops, yeast, adj, setInvCost, settings }) {
  const priceMap = useMemo(() => priceMapFrom({ malts, hops, yeast, adj }), [malts, hops, yeast, adj]);

  const postBoilGal = parseVolume(recipe?.process?.postBoilYield)
    ?? parseVolume(settings?.postBoilYield)
    ?? null;
  const lossPct = Number.isFinite(settings?.lossPct) ? settings.lossPct : 0;

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
          <div style={statValue}>{r.costPerPint == null ? "—" : `$${r.costPerPint.toFixed(3)}`}</div>
        </div>
        <div style={{ ...statBox, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input type="checkbox" checked={!!dbl} onChange={e => setDbl(e.target.checked)} />
            Double batch
          </label>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
            {r.packagedBbl != null
              ? `${r.packagedBbl.toFixed(2)} bbl ≈ ${r.kegs.toFixed(1)} kegs ≈ ${Math.round(r.pints)} pints`
              : "no batch volume set"}
          </div>
        </div>
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

      {postBoilGal == null && (
        <div style={{ ...card, borderColor: "#fbbf24", background: "#fffbeb", marginBottom: 12 }}>
          <div style={{ padding: "10px 14px", fontSize: 13, color: "#92400e" }}>
            No batch volume — set <strong>Post-Boil Yield</strong> on the Brew Sheet, or a brewery
            default in Settings, to get cost per bbl and per keg.
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
                        type="number" step="0.0001" min="0"
                        value={perUnit(l.costPerUnit)}
                        placeholder="—"
                        aria-label={`Cost per ${l.unit} of ${l.name}`}
                        onChange={(e) => setInvCost(key, l.name, e.target.value)}
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
