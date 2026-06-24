// Pure recipe → Cellar Summary sheet view-model. Like brewSheet.js, kept out of
// the React component so the printable layout + date math can be unit-tested on
// plain data. Takes a recipe (defaults.js tuple shape) plus an optional brew
// date and returns the rows the Cellar Summary tab renders.
//
// The recipe's per-day SCHEDULE (`sc`: [[day, action], …]) is the spine of the
// sheet: given a brew date, every action's calendar date is brewDate + day, and
// those dates fan out into the named boxes (cold crash, bung, dry hop, rouse,
// transfer, keg). Without a brew date the schedule still lists day offsets and
// every dated box is left blank for hand-entry. The recipe supplies WHAT (yeast,
// fermentation temp, dry-hop varieties + amounts, cellar additions); the
// schedule supplies WHEN.

import { brewDayStages } from "./defaults";

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

export function buildCellarSheet(recipe, brewDate) {
  if (!recipe) return null;
  const { n, s, ft, h = [], y = [], a = [], sc = [] } = recipe;
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

  // Dry hop: schedule says when, recipe hops at the `dryhop` stage say what.
  const dryHopItems = h.filter(([, , stage]) => stage === "dryhop").map(([name, qty]) => ({ name, qty }));
  const dryHopDates = datesOf((act) => act.toLowerCase().includes("dry hop"));

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
  const keg = firstDate(is("keg"));

  // Misc cellar additions = adjuncts added off brew day (fermentation, secondary,
  // fining, …). Brew-day adjuncts belong on the Brew Day sheet, so drop them.
  const misc = a
    .filter(([, , , stage]) => !brewDayStages.includes(stage))
    .map(([name, qty, unit]) => ({ name, qty, unit: unit || "" }));

  return {
    name: n,
    style: s,
    brewDate: brewDate || null,
    dateBrewed: brewDate ? addDays(brewDate, 0) : null,
    fermTemp: ft ?? null,
    yeast,
    dryHop: { dates: dryHopDates, items: dryHopItems },
    coldCrash,
    blowOffs,
    rouse,
    bung,
    transfer,
    keg,
    misc,
    schedule,
  };
}
