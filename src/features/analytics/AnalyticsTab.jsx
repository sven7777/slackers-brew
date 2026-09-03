import { useMemo, useState } from "react";
import BeersPanel from "./BeersPanel";
import OverheadPanel from "./OverheadPanel";
import { costAllRecipes } from "../../lib/analytics";
import { priceAsOf } from "../../lib/inventoryValue";
import { segWrap, segBtn } from "../../styles";

// Analytics tab: the two questions that only exist across the whole book.
//
//   Beers — what each beer's INGREDIENTS cost, side by side.
//   Overhead — what a pint costs once labor and the cost of being open are
//     stacked on top of that.
//
// The split is the point. Ingredient COGS is the exact part, computed off real
// vendor prices, and it is about 6% of an $8.00 pint; keeping the two on one
// screen would let the precise number stand in for the big one. They share a
// single `costAllRecipes()` here so the Overhead view's ingredient layer is
// literally the average printed in the tile beside it, never a second opinion.
//
// The sub-nav is LOCAL state, like the Recipes tab's — which view you last
// looked at is not worth a round trip to the database, and `tab` is already a
// persisted index that renumbers when a tab is inserted (see CLAUDE.md).

const SUBVIEWS = [
  { key: "beers", label: "Beers" },
  { key: "overhead", label: "Overhead" },
];

export default function AnalyticsTab({ recs, malts, hops, yeast, adj, settings, openRecipeCost }) {
  const [view, setView] = useState("beers");

  const { rows, summary, blockers } = useMemo(
    () => costAllRecipes({ recs, malts, hops, yeast, adj, settings }),
    [recs, malts, hops, yeast, adj, settings]
  );

  // Oldest price behind these figures — the same date the Inventory tab and the
  // Cost panel print, so a year-old number looks like one everywhere.
  const asOf = useMemo(() => priceAsOf({ malts, hops, yeast, adj }), [malts, hops, yeast, adj]);

  return (
    <div>
      <div style={segWrap}>
        {SUBVIEWS.map((v) => (
          <button key={v.key} style={segBtn(view === v.key)} onClick={() => setView(v.key)}>{v.label}</button>
        ))}
      </div>

      {view === "beers" && (
        <BeersPanel rows={rows} summary={summary} blockers={blockers} asOf={asOf}
          openRecipeCost={openRecipeCost} />
      )}

      {/* Overhead renders whether or not a single recipe is priced: rent and
          payroll are real costs on day one, and the ingredient layer simply
          reports itself as missing. Gating this view on the recipe book would
          hide the larger number behind the smaller one. */}
      {view === "overhead" && (
        <OverheadPanel settings={settings} ingredientCostPerBbl={summary.avgCostPerBbl}
          costedBeers={summary.counted} />
      )}
    </div>
  );
}
