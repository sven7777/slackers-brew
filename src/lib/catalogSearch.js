// Finding one product in the vendor's whole range.
//
// The catalog is 563 rows on the August 2026 list and only about 30 of them are
// ever ours, so the browser is a search box first and a list second. Three
// things narrow it, and they answer three different questions:
//
//   the query     "what is it called" — matched across name, vendor and SKU,
//                 because a brewer arrives with any one of the three.
//   the category  "which recipe table would it join" — including `unsorted`,
//                 the ~311 rows classify() honestly declined to guess at.
//   showAll       whether equipment and merchandise are in scope. They are real
//                 catalogue entries, so they are one toggle away rather than
//                 filtered out of existence, but a brewer looking for a malt
//                 should not be reading past Xtratuf boots to find it.

import { compareNames } from "./sortNames";
import { ADOPT_CATEGORIES } from "./adopt";

// Every term must match somewhere, in any order: "rahr pils" finds
// "Rahr North Star Pils™" and so does "pils rahr".
const haystack = (e) => `${e?.name ?? ""} ${e?.vendor ?? ""} ${e?.sku ?? ""}`.toLowerCase();

export function matchesQuery(entry, query) {
  const terms = String(query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const hay = haystack(entry);
  return terms.every((t) => hay.includes(t));
}

// The bucket a row is browsed under. `unsorted` is a first-class bucket rather
// than an absence: those rows are the point of leaving classify() cautious, and
// burying them would make the caution look like data loss.
export const bucketOf = (entry) => entry?.category ?? "unsorted";

// How many rows sit in each bucket, for the chips. Computed over the whole
// catalog (not the current results) so the chips are a stable map of what is in
// there rather than a readout of the query.
export function catalogCounts(entries = []) {
  const counts = {};
  for (const e of entries) {
    const b = bucketOf(e);
    counts[b] = (counts[b] ?? 0) + 1;
  }
  counts.total = entries.length;
  return counts;
}

// Which buckets are in scope, which is three different questions in one.
//
// `category` is a chip the brewer clicked: show me that bucket and nothing
// else.
//
// `lockedTo` is the browser opened from a recipe table, and it takes
// `unsorted` with it. ⚠️ That is not a convenience — it is the difference
// between a working panel and an empty one. classify() only ever names malt,
// yeast and `other`, so the Hops and Adjuncts tables would open onto a catalog
// of ZERO products while the mango purée, the honey and the coriander all sat
// in `unsorted` (311 of the 563 rows). "The list didn't say" has never meant
// "not an adjunct".
//
// Otherwise: every bucket a recipe could use — which is not the same as every
// row, and that difference is what the `showAll` toggle is for.
function scope({ category, lockedTo, showAll }) {
  if (category) return new Set([category]);
  if (lockedTo) return new Set([lockedTo, "unsorted"]);
  return new Set(showAll ? [...ADOPT_CATEGORIES, "unsorted", "other"] : [...ADOPT_CATEGORIES, "unsorted"]);
}

// Filter + sort. Name order, via the one comparator every list in this app
// sorts by (sortNames.js), so scanning the catalog reads like scanning the
// shelf.
export function searchCatalog(entries = [], { query = "", category = null, lockedTo = null, showAll = false } = {}) {
  const wanted = scope({ category, lockedTo, showAll });
  return entries
    .filter((e) => wanted.has(bucketOf(e)) && matchesQuery(e, query))
    .sort((a, b) => compareNames(a?.name, b?.name));
}
