// What ingesting a price list would do to the stored catalog, computed BEFORE
// it does it — the same shape, and the same reasoning, as priceChanges().
//
// A catalog is not a snapshot to be replaced wholesale. Vendors rename things,
// repack them, and drop them, and each of those means something different to a
// brewery:
//
//   renamed      MRAH1102 "Rahr Standard 2-Row" became
//                "Rahr The Brewer's Standard™ 2-Row" between the June 2025 and
//                August 2026 lists. Same sack, same SKU, cosmetic.
//   repacked     AZZZ2901 "Mango Puree - 44.1 lb" became "- 44 lb". NOT
//                cosmetic: pack size is the denominator of every derived price,
//                so this silently moves a cost.
//   discontinued MRAH1105 "Rahr Premium Pilsner" is on the June 2025 list and
//                absent from the August 2026 one. This is the one that hurts:
//                a mapped SKU that stops appearing reads to priceChanges() as
//                `skipped: "absent"` — identical to a hop list not carrying
//                malts — so the price freezes at its last quote and nothing
//                says so. Slackers' Pils sat that way for a year.
//
// So the SKU is the identity and the name is an attribute, never the other way
// round: matching on names would turn every vendor rebrand into a duplicate
// product and every repack into a new one.

// The leading letters of a SKU, which is what identifies the range it belongs
// to: MRAH1105 -> "MRAH" (Rahr malts), BZZZ1971 -> "BZZZ" (the generic BSG
// bucket), HOP-CAS -> "HOP" (our own synthetic hop SKUs, which no vendor list
// uses because the spot hop list carries no SKUs at all).
function skuFamily(sku) {
  return (/^[A-Za-z]+/.exec(String(sku ?? "")) ?? [""])[0].toUpperCase();
}

// Compare freshly parsed catalog entries against the stored catalog.
//
// `mappedSkus` is the set of SKUs the brewery actually buys (the values of
// defaultProductMap, or whatever inventory currently points at). It is what
// makes `discontinued` meaningful: the vendor drops products constantly and
// almost none of them are ours. Only a SKU we depend on is worth an alarm.
//
// Returns:
//   added        in the file, not in the stored catalog
//   renamed      same SKU, different name
//   repacked     same SKU, both packs known and different — a cost change in
//                disguise (an unknown pack becoming known is not one)
//   unchanged    same SKU, same name and pack
//   discontinued stored AND mapped by us, but absent from this file
//   next         the catalog to store, ready to save
export function catalogChanges(stored, entries, mappedSkus = []) {
  const bySku = new Map((stored ?? []).map((e) => [e.sku, e]));
  const incoming = entries ?? [];
  const seen = new Set(incoming.map((e) => e.sku));

  const added = [];
  const renamed = [];
  const repacked = [];
  const unchanged = [];

  for (const e of incoming) {
    const was = bySku.get(e.sku);
    if (!was) { added.push(e); continue; }

    const nameMoved = (was.name ?? null) !== (e.name ?? null);

    // A repack is a COST change: the same product now comes in a different
    // quantity, so every price derived from it moves. That is only true when
    // both packs are known. A pack going from unknown to known is the parser
    // learning something, not the vendor changing anything, and flagging it as
    // a repack would put a "check this, it moves money" warning on a row where
    // no money moved. Known-to-unknown is likewise a reading we lost, not a
    // repack — it costs us the ability to price the row, which shows up as an
    // unpriced ingredient where that actually matters.
    const bothKnown = was.packQty != null && e.packQty != null;
    const packMoved = bothKnown && (
      was.packQty !== e.packQty || (was.packUnit ?? null) !== (e.packUnit ?? null)
    );

    // A row can be both renamed and repacked (the mango puree was). It is
    // reported in both lists on purpose: they are different consequences, and
    // the repack is the one that moves money.
    if (nameMoved) renamed.push({ ...e, from: was.name, to: e.name });
    if (packMoved) {
      repacked.push({
        ...e,
        from: { qty: was.packQty ?? null, unit: was.packUnit ?? null },
        to: { qty: e.packQty ?? null, unit: e.packUnit ?? null },
      });
    }
    if (!nameMoved && !packMoved) unchanged.push(e);
  }

  // A SKU we buy that this file no longer carries.
  //
  // Two things narrow it, and both are load-bearing.
  //
  // Mapped only: an unrestricted list would be hundreds of products the brewery
  // never bought — noise that would bury the one line that matters.
  //
  // ⚠️ And only within a SKU FAMILY the file actually covers. "Absent from this
  // file" means two completely different things depending on the file: the
  // Houston list carries no hops at all, so without this every hop in the
  // catalog would be reported as discontinued the moment a malt list was
  // imported. That is the exact confusion this feature exists to end — it is
  // what let a genuinely dead Pils SKU hide among the "not on this list" rows
  // for a year — so re-creating it here in a louder font would be worse than
  // not reporting at all. Comparing like with like means comparing a SKU
  // against a file that quotes its own family: MRAH1105 counts as missing only
  // when other MRAH rows are present to be missing from.
  const mapped = new Set(mappedSkus);
  const families = new Set(incoming.map((e) => skuFamily(e.sku)));
  const discontinued = (stored ?? []).filter(
    (e) => mapped.has(e.sku) && !seen.has(e.sku) && families.has(skuFamily(e.sku)),
  );

  // Merge rather than replace. A list covers one vendor's range on one day;
  // the hop list carries no malts and the malt list carries no hops, so
  // dropping what a file doesn't mention would empty the catalog every time a
  // different list is imported.
  const next = [...bySku.values()];
  const at = new Map(next.map((e, i) => [e.sku, i]));
  for (const e of incoming) {
    const i = at.get(e.sku);
    if (i == null) { at.set(e.sku, next.length); next.push(e); }
    // Keep a category a human has corrected: classify() only ever offers a
    // guess, and re-importing must not overwrite the answer with the guess.
    else next[i] = { ...e, category: bySku.get(e.sku)?.category ?? e.category };
  }

  return { added, renamed, repacked, unchanged, discontinued, next };
}
