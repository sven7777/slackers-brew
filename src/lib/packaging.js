import { GAL_PER_BBL } from "./cogs";

// Cost per packaged format.
//
// cogs.js derives cost/bbl, cost/keg and cost/pint from one volume, which
// covers the brewhouse view. The taproom sells two formats those figures don't
// answer for: the sixtel that goes out to accounts, and the 24 x 12 oz case.
// Both are the same batch total over a different denominator, so they belong
// beside the existing three rather than in a costing pass of their own.

// A sixtel is one sixth of a barrel. A case is 24 x 12 oz = 288 oz, against
// 31 gal = 3968 oz in a barrel, so a little under 13.8 cases to the bbl.
const SIXTELS_PER_BBL = 6;
const OZ_PER_BBL = GAL_PER_BBL * 128;
const OZ_PER_CASE = 24 * 12;
const CASES_PER_BBL = OZ_PER_BBL / OZ_PER_CASE;

const round2 = (n) => Math.round(n * 100) / 100;

// Derive the packaged-format costs from an already-computed recipe cost, so
// there is one costing pass and these can never disagree with the Cost panel.
export function packagingCosts(cost) {
  const bbl = cost.packagedBbl ?? 0;
  const total = cost.total;

  return {
    costPerSixtel: round2(total / (bbl * SIXTELS_PER_BBL)),
    costPerCase: round2(total / (bbl * CASES_PER_BBL)),
    unpricedCount: cost.missing.length,
  };
}
