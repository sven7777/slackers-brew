// Pure recipe → Cellar Summary sheet view-model. Like brewSheet.js, kept out of
// the React component so the printable layout + date math can be unit-tested on
// plain data. Takes a recipe (defaults.js tuple shape) plus an optional brew
// date and returns the rows the Cellar Summary tab renders.
//
// The recipe's per-day SCHEDULE (`sc`: [[day, action], …]) is the spine of the
// sheet: given a brew date, every action's calendar date is brewDate + day, and
// those dates fan out into the named boxes (cold crash, bung, dry hop, rouse,
// transfer, carb, keg). Without a brew date the schedule still lists day offsets and
// every dated box is left blank for hand-entry. The recipe supplies WHAT (yeast,
// fermentation temp, dry-hop varieties + amounts, cellar additions); the
// schedule supplies WHEN.

import { brewDayStages, dryHopStages, dryHopCharge, stageLabels, LEGACY_DRY_HOP_ACTION } from "./defaults";
import { fmtGravity } from "./gravity";

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Add `n` days to an ISO "YYYY-MM-DD" date, formatted as "Wed 7/4". Parsed as a
// local date (no argless Date()) so the result is timezone-stable and testable.
function addDays(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return `${WD[dt.getDay()]} ${dt.getMonth() + 1}/${dt.getDate()}`;
}

// Cold-crash actions read like "Step Crash 55" — pull the trailing temperature.
function crashTemp(action) {
  const m = /(\d+)\s*$/.exec(action);
  return m ? Number(m[1]) : null;
}

// Cellar addition stages in the order they happen. "fermentation" is the value
// the seeded recipes (and BeerSmith imports) actually use for primary, so it's
// listed alongside it rather than sorting as an unknown.
const MISC_STAGE_ORDER = [
  "fermentation", "primary", ...dryHopStages, "secondary", "fining", "rousing",
  "transfer", "keg", "bottling",
];

// The stages a schedule action can date. Anything else stays a write-in.
const MISC_STAGE_ACTIONS = { rousing: "rouse", transfer: "transfer", keg: "keg" };

// A stage off the list keeps its recipe order at the end: free text is allowed
// here, and inventing a position for it would reorder the sheet arbitrarily.
const miscStageRank = (stage) => {
  const i = MISC_STAGE_ORDER.indexOf(stage);
  return i === -1 ? MISC_STAGE_ORDER.length : i;
};

// Printed stage name: the shared label where one exists (dry-hop charges), else
// the raw stage title-cased ("secondary" → "Secondary").
const miscStageLabel = (stage) =>
  stageLabels[stage] ?? (stage ? stage.replace(/\b\w/g, (c) => c.toUpperCase()) : "");

export function buildCellarSheet(recipe, brewDate) {
  if (!recipe) return null;
  const { n, s, og = null, fg = null, ft, h = [], y = [], a = [], sc = [] } = recipe;
  const dateFor = (day) => (brewDate ? addDays(brewDate, day) : null);

  // Full schedule, ordered by day (stable within a day) with computed dates.
  const schedule = sc
    .map(([day, action], i) => ({ day, action, date: dateFor(day), i }))
    .sort((a, b) => a.day - b.day || a.i - b.i)
    .map(({ day, action, date }) => ({ day, action, date }));

  const datesOf = (pred) => schedule.filter((row) => pred(row.action)).map((row) => row.date);
  const firstDate = (pred) => datesOf(pred)[0] ?? null;
  const is = (name) => (action) => action.toLowerCase() === name;

  // Yeast (strain → Gen/Type box).
  const yeast = y.map(([name, qty]) => ({ name, qty }));

  // Dry hop: the schedule says WHEN, the recipe's hops say WHAT, and the charge
  // number is what pairs them. A double dry hop is two charges on two different
  // days; before the numbering there was nothing to join on, so the sheet could
  // only print a single date and did it on the first row alone.
  //
  // Charge 1 also absorbs the legacy unnumbered values, so a recipe that hasn't
  // been migrated (a localStorage device, an old backup) still prints correctly.
  const chargeOfAction = (action) => {
    const a = action.trim().toLowerCase();
    if (a === LEGACY_DRY_HOP_ACTION) return 1;
    const m = /^dry hop\s*([1-9])$/.exec(a);
    return m ? Number(m[1]) : null;
  };
  const dryHopCharges = dryHopStages
    .map((_, i) => {
      const charge = i + 1;
      const items = h
        .filter(([, , stage]) => dryHopCharge(stage) === charge)
        .map(([name, qty]) => ({ name, qty }));
      const dates = schedule.filter((row) => chargeOfAction(row.action) === charge).map((row) => row.date);
      return { charge, items, dates, date: dates[0] ?? null };
    })
    // An empty charge prints nothing. A single-charge beer therefore looks
    // exactly as it always did, and only a beer that IS double dry hopped
    // grows a second block.
    .filter((c) => c.items.length > 0 || c.dates.length > 0);

  // Cold-crash steps come straight off the schedule (Cr. 55 / 40 / 33 …) so a
  // recipe that crashes differently prints its own steps, not a fixed form.
  const coldCrash = schedule
    .filter((row) => row.action.toLowerCase().startsWith("step crash"))
    .map((row) => ({ temp: crashTemp(row.action), date: row.date }));

  // Blow-offs: every "Blow Off" / "Mini Blow Off" row, as dated entries.
  const blowOffs = schedule
    .filter((row) => row.action.toLowerCase().includes("blow off"))
    .map((row) => ({ label: row.action, date: row.date }));

  const rouse = datesOf(is("rouse"));
  const bung = firstDate((act) => act.toLowerCase().startsWith("bung"));
  const transfer = firstDate(is("transfer"));
  const carb = firstDate(is("carb"));
  const keg = firstDate(is("keg"));

  // Misc cellar additions = adjuncts added off brew day (fermentation, secondary,
  // fining, …). Brew-day adjuncts belong on the Brew Day sheet, so drop them.
  //
  // Each one carries WHEN in the process it goes in: "Mango Puree, 18 lbs" on
  // its own doesn't say whether that's at primary or at transfer, and the crew
  // reading the sheet on the tank has no other source for it. Where the stage
  // maps to a scheduled action (rousing / transfer / keg) the row also gets that
  // step's date; the rest print a blank date line, since a stage the schedule
  // doesn't pin down would only be a guess printed as a plan.
  const misc = a
    .filter(([, , , stage]) => !brewDayStages.includes(stage))
    .map(([name, qty, unit, stage]) => ({
      name,
      qty,
      unit: unit || "",
      stage: stage || "",
      stageLabel: miscStageLabel(stage),
      date: MISC_STAGE_ACTIONS[stage] ? firstDate(is(MISC_STAGE_ACTIONS[stage])) : null,
    }))
    // Process order, so the sheet reads top-to-bottom the way the tank does.
    // sort is stable, so two additions at the same stage keep recipe order.
    .sort((x, y) => miscStageRank(x.stage) - miscStageRank(y.stage));

  return {
    name: n,
    style: s,
    og: fmtGravity(og),
    fg: fmtGravity(fg),
    brewDate: brewDate || null,
    dateBrewed: brewDate ? addDays(brewDate, 0) : null,
    fermTemp: ft ?? null,
    yeast,
    dryHop: { charges: dryHopCharges },
    coldCrash,
    blowOffs,
    rouse,
    bung,
    transfer,
    carb,
    keg,
    misc,
    schedule,
  };
}
