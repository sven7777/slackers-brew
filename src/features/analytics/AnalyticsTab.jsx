import { useMemo, useState } from "react";
import BeersPanel from "./BeersPanel";
import OverheadPanel from "./OverheadPanel";
import PricingPanel from "./PricingPanel";
import { costAllRecipes } from "../../lib/analytics";
import { priceAsOf } from "../../lib/inventoryValue";
import { segWrap, segBtn } from "../../styles";

// Analytics tab: the questions that only exist across the whole book.
//
//   Beers — what each beer's INGREDIENTS cost, side by side.
//   Overhead — what a pint costs once labor and the cost of being open are
//     stacked on top of that.
//   Pricing — what it is sold for, and what is left of that price once tax,
//     card fees and excise have taken their cut.
//
// The split is the point. Ingredient COGS is the exact part, computed off real
// vendor prices, and it is about 6% of an $8.00 pint; keeping it on one screen
// with the modelled figures would let the precise number stand in for the big
// one. All three share a single `costAllRecipes()` here, so the Overhead view's
// ingredient layer is literally the average printed in the Beers tile beside it
// and the Pricing view prices against that same number — never a second opinion.
//
// The sub-nav is LOCAL state, like the Recipes tab's — which view you last
// looked at is not worth a round trip to the database, and `tab` is already a
// persisted index that renumbers when a tab is inserted (see CLAUDE.md).

const SUBVIEWS = [
  { key: "beers", label: "Beers" },
  { key: "overhead", label: "Overhead" },
  { key: "pricing", label: "Pricing" },
];

export default function AnalyticsTab({ recs, setRecs, malts, hops, yeast, adj, settings, setSettings, openRecipeCost }) {
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

      {/* Pricing reads the same `rows` the Beers view ranks and the same
          per-bbl average the Overhead view stacks, so a price recommended here
          is answering the cost printed one tab over — not a third opinion. */}
      {view === "pricing" && (
        <PricingPanel settings={settings} setSettings={setSettings} recs={recs} setRecs={setRecs}
          rows={rows} ingredientCostPerBbl={summary.avgCostPerBbl} />
      )}
    </div>
  );
}
