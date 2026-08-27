// Archiving an ingredient: "we don't stock this any more", without losing it.
//
// Slackers stopped buying Idaho 7, Lemondrop and Pink Boots 2025 (Derek,
// 2026-08-24). Until now the only way to say so was to delete the row, which
// throws away its price along with it — and a price is the one thing on an
// inventory row that is expensive to get back. So the rows stayed, and the
// shelf listed three things nobody stocks.
//
// Archived is therefore a display state, not a deletion:
//
//   * the row, its quantity and its price all survive untouched;
//   * `computeOrder()` deliberately does NOT consult this. If a recipe calls
//     for an archived ingredient you still need to buy it, and whatever is on
//     the shelf still counts against that need. Hiding a row from the shelf
//     must never quietly change what the brewery orders;
//   * the Inventory tab hides them by default and says how many it hid, which
//     is the same rule the unpriced count follows — a list that silently omits
//     part of itself reads as if it covered everything.

export const isArchived = (item) => item?.archived === true;

// The rows a view should show. Kept as a function rather than inlined because
// both the table and the value total have to agree on it: if the tab summed a
// different set of rows than it printed, the column would stop adding up to
// the total beside it.
export function visibleItems(items = [], showArchived = false) {
  return showArchived ? items : items.filter((it) => !isArchived(it));
}

export function archivedCount(items = []) {
  return items.filter(isArchived).length;
}

// Across all four categories at once, which is how the Inventory tab needs it.
export function visibleInventory({ malts = [], hops = [], yeast = [], adj = [] } = {}, showArchived = false) {
  return {
    malts: visibleItems(malts, showArchived),
    hops: visibleItems(hops, showArchived),
    yeast: visibleItems(yeast, showArchived),
    adj: visibleItems(adj, showArchived),
  };
}

export function totalArchived({ malts = [], hops = [], yeast = [], adj = [] } = {}) {
  return archivedCount(malts) + archivedCount(hops) + archivedCount(yeast) + archivedCount(adj);
}
