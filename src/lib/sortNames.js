// Alphabetical ordering for ingredient / recipe names, in one place so every
// list and picker sorts the same way.
//
// A plain `<` comparison is wrong for this data: it puts "2-Row" and
// "Crystal 80" in codepoint order and treats case as significant, so
// "CTZ" sorts before "Cascade". Intl.Collator with numeric collation gives the
// order a brewer expects — case-insensitive, and "Crystal 8" before
// "Crystal 80" before "Crystal 120".
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export const compareNames = (a, b) => collator.compare(String(a ?? ""), String(b ?? ""));

// Sort a list by name WITHOUT losing where each item came from: editing and
// removal address rows by their index in the stored array, so a display sort
// has to hand that index back. Returns [{item, index}] in name order; ties keep
// their stored order (a hop added at three stages stays boil → whirlpool → dry
// hop), which Array.prototype.sort guarantees.
export function sortedWithIndex(items = [], nameOf = (x) => x) {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => compareNames(nameOf(a.item), nameOf(b.item)));
}

// Names-only convenience for picker lists, which have no index to preserve.
export const sortedNames = (names = []) => [...names].sort(compareNames);
