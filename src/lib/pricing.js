// Unit conversion + price normalization for the ingredient catalog.
//
// Vendors sell packs (a 55 lb bag of malt, a 500 g brick of yeast, a 5 lb tub of
// Whirlfloc tablets); recipes call for lbs, oz, packs, ml, or "each". Every
// costing number therefore crosses a unit boundary, and each crossing is a chance
// to be silently wrong by an order of magnitude. That conversion lives here,
// alone and unit-tested, rather than inline in the COGS math.
//
// The value the rest of the app consumes is `costPerUnit` — a price already
// expressed in the unit the recipe uses — so a bad conversion shows up as a wrong
// number in a visible column instead of hiding inside a formula.

// Everything mass-like, in grams. `pack` is a domain constant, not a physical
// unit: Slackers pitches one 500 g brick of dry yeast per batch, which is how
// BSG sells it, so recipe "packs" and vendor packs are the same thing.
export const PACK_GRAMS = 500;
const GRAMS = {
  g: 1,
  kg: 1000,
  oz: 28.349523125,
  lb: 453.59237,
  pack: PACK_GRAMS,
};

// Everything volume-like, in millilitres.
const ML = {
  ml: 1,
  l: 1000,
  gal: 3785.411784,
};

// Unit strings arrive from recipe tuples, the adjunct catalog, and hand-authored
// product rows, so spelling varies ("lbs", "L", "each"). Fold them to one key.
const ALIAS = {
  lbs: "lb", pound: "lb", pounds: "lb",
  ounce: "oz", ounces: "oz", ozs: "oz",
  gram: "g", grams: "g",
  kilogram: "kg", kilograms: "kg",
  liter: "l", litre: "l", liters: "l", litres: "l",
  milliliter: "ml", millilitre: "ml", milliliters: "ml", millilitres: "ml",
  gallon: "gal", gallons: "gal",
  packs: "pack", packet: "pack", packets: "pack",
  ea: "each", count: "each",
};

export function normalizeUnit(u) {
  if (u == null) return null;
  const k = String(u).trim().toLowerCase();
  if (!k) return null;
  return ALIAS[k] || k;
}

// Convert a quantity between two units of the same dimension.
// Returns null when the units aren't comparable (lb → ml, anything → each),
// which callers must treat as "unpriceable", never as zero.
export function convert(qty, from, to) {
  const f = normalizeUnit(from);
  const t = normalizeUnit(to);
  if (f == null || t == null || !Number.isFinite(qty)) return null;
  if (f === t) return qty;
  if (f in GRAMS && t in GRAMS) return (qty * GRAMS[f]) / GRAMS[t];
  if (f in ML && t in ML) return (qty * ML[f]) / ML[t];
  return null;
}

// How many recipe units a vendor pack contains.
//
// "each" is the awkward one: a count has no intrinsic size, so it only works
// when the product says what one unit weighs (Whirlfloc T tablets are 2.5 g).
// Without that, a 5 lb tub can't be turned into a tablet count and we return
// null rather than guess.
export function unitsPerPack(product, recipeUnit) {
  const { packQty, packUnit, unitMass } = product;
  const target = normalizeUnit(recipeUnit);
  if (target == null || !Number.isFinite(packQty)) return null;

  // A pack already counted in "each" (a pack of 10 peppers bought and used as a
  // unit) needs no mass at all — only a pack sold by weight does.
  const direct = convert(packQty, packUnit, target);
  if (direct != null) return direct;

  if (target === "each") {
    if (!unitMass) return null;
    const packG = convert(packQty, packUnit, "g");
    const oneG = convert(unitMass.qty, unitMass.unit, "g");
    if (packG == null || oneG == null || oneG <= 0) return null;
    return packG / oneG;
  }
  return null;
}

// Price of one recipe unit. Null when the product has no price yet (the four
// ingredients BSG doesn't carry) or the units don't reconcile — both of which
// must surface in the UI as "unpriced" rather than silently costing $0.
export function costPerUnit(product, recipeUnit) {
  if (!product || product.price == null || !Number.isFinite(product.price)) return null;
  const per = unitsPerPack(product, recipeUnit);
  if (per == null || per <= 0) return null;
  return product.price / per;
}
