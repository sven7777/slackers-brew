// Adding one ingredient row to a recipe.
//
// Small, but it lives here rather than inside RecEditTable because two things
// now do it: the Add picker, and adopting a product from the vendor catalog
// while editing a recipe (which is one action — "add this to my beer" — and so
// lands the ingredient on the shelf and in the recipe at once).
//
// The tuple shapes are the ones defaults.js documents: malt/yeast [name, qty];
// hop [name, qty, stage, time]; adjunct [name, qty, unit, stage, time]; salt
// [name, qty, stage]. New rows are seeded with their category's default stage
// and time so they print somewhere sensible until edited.

import { adjUnits } from "./defaults";

export const newRow = (cat, name, unit) => {
  if (cat === "h") return [name, 0, "boil", 0];
  // An adjunct's unit arrives with it when it is adopted from the catalog (the
  // brewer chose it in the adopt dialog); otherwise it is one of the built-in
  // adjuncts and adjUnits knows it. "each" is the last resort, not the
  // assumption — a honey measured in "each" would cost nothing sensible.
  if (cat === "a") return [name, 0, unit || adjUnits[name] || "each", "boil", 0];
  if (cat === "sa") return [name, 0, "mash"];
  return [name, 0];
};

export const addIngredient = (setRecs, ri, cat, name, unit) => {
  if (!name) return;
  setRecs((p) => p.map((r, i) => (i !== ri ? r : { ...r, [cat]: [...(r[cat] ?? []), newRow(cat, name, unit)] })));
};
