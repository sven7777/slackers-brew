// Pure recipe → Brew Day sheet view-model. Kept out of the React component so the
// printable layout can be unit-tested on plain data. Takes a recipe in the app's
// tuple shape (see defaults.js) and returns the rows the BrewDay tab renders.
//
// Quantities are single-batch; a double batch prints two copies (#1, #2) at the
// SAME amounts — it does not scale the numbers (see brew-day-sheets-roadmap).
// Yeast never prints on the Brew Day sheet (it belongs on the Cellar Summary).

import { brewDayStages, saltStages } from "./defaults";
import { fmtGravity, computeAbv } from "./gravity";

// Stage display order for the additions schedule. Only brew-day stages print
// here; cellar-stage additions (dry hop, fermentation, secondary, …) route to
// the future Cellar Summary sheet, so anything off this list is dropped.
const STAGE_ORDER = Object.fromEntries(brewDayStages.map((s, i) => [s, i]));
const isBrewDayStage = (stage) => stage in STAGE_ORDER;

export function buildBrewSheet(recipe) {
  if (!recipe) return null;
  const { n, s, og, fg, abv, mt, m = [], h = [], a = [], sa = [] } = recipe;

  const grainBill = m.map(([name, qty]) => ({ name, qty }));
  const totalGrain = grainBill.reduce((t, g) => t + (g.qty || 0), 0);

  // Hops (oz) + adjuncts (own unit) added on brew day, ordered by stage then by
  // descending time within a stage (60 → 5 min) — the order a brewer adds them.
  const additions = [
    ...h
      .filter(([, , stage]) => isBrewDayStage(stage))
      .map(([name, qty, stage, time]) => ({ name, qty, unit: "oz", stage, time: time ?? 0 })),
    ...a
      .filter(([, , , stage]) => isBrewDayStage(stage))
      .map(([name, qty, unit, stage, time]) => ({ name, qty, unit: unit || "", stage, time: time ?? 0 })),
  ].sort((x, y) => STAGE_ORDER[x.stage] - STAGE_ORDER[y.stage] || y.time - x.time);

  // Water salts grouped by addition stage (mash / sparge / boil); empty stages
  // are dropped so only the sections a recipe actually uses render.
  const saltsByStage = saltStages
    .map((stage) => ({ stage, salts: sa.filter(([, , st]) => st === stage).map(([name, qty]) => ({ name, qty })) }))
    .filter((g) => g.salts.length > 0);

  return {
    name: n,
    style: s,
    og: fmtGravity(og),
    fg: fmtGravity(fg),
    // ABV is derived from the target gravities when both are set; a stored
    // recipe abv only fills in when they aren't (e.g. hand-entered presets).
    abv: computeAbv(og, fg) ?? abv ?? null,
    mashTemp: mt ?? null,
    grainBill,
    totalGrain,
    additions,
    saltsByStage,
  };
}
