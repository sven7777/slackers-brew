// Gravity display + ABV math shared by the printable sheet builders.

// Format a specific gravity for print: always 3 decimal places (1.06 → "1.060").
// Null/undefined (recipe target not set) stays null so the sheet leaves the box blank.
export function fmtGravity(v) {
  return v == null ? null : Number(v).toFixed(3);
}

// Standard ABV approximation from target gravities, rounded to 1 decimal.
// Returns null unless both gravities are present.
export function computeAbv(og, fg) {
  if (og == null || fg == null) return null;
  return Math.round((og - fg) * 131.25 * 10) / 10;
}
